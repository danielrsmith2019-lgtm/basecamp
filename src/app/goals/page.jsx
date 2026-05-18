'use client';

import { useState, useMemo } from 'react';
import { useWorkouts } from '@/lib/WorkoutContext';
import { formatDate, parsePace } from '@/utils/runUtils';
import { calculateE1RM, formatVolume } from '@/utils/liftUtils';
import ProgressRing from '@/components/shared/ProgressRing';
import {
  Flame, Trophy, Target, Footprints, Dumbbell, BarChart3,
  CalendarCheck, Repeat, Scale, Flag, Mountain, ClipboardList,
  Check, Zap, TrendingUp, Plus, X, ChevronDown, ChevronUp,
  Weight, Timer, Ruler, Heart, Star,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// BUILT-IN GOAL TEMPLATES
// ═══════════════════════════════════════════════════════

const GOAL_TEMPLATES = {
  running: [
    { id: 'run-plan-completion',   title: 'Complete Training Plan',  description: 'Finish all planned runs.',                             icon: ClipboardList, compute: computePlanCompletion },
    { id: 'run-weekly-mileage',    title: 'Weekly Mileage Target',   description: 'Hit 25+ miles in a single week.',                      icon: CalendarCheck,  target: 25, compute: computeWeeklyMileage },
    { id: 'run-race-pace',         title: 'Sub-4:00 Marathon Pace',  description: 'Average pace under 9:09/mi on long runs.',             icon: Flag,           targetPace: 9.15, compute: computeRacePace },
    { id: 'run-long-run-distance', title: 'Long Run 10+ Miles',      description: 'Complete a long run of 10 miles or more.',             icon: Mountain,       target: 10, compute: computeLongRunDistance },
  ],
  lifting: [
    { id: 'lift-bench-pr',         title: 'Bench Press 225 lbs',     description: 'Estimated 1RM of 225 lbs on bench press.',             icon: Dumbbell,       exercise: 'Barbell Bench Press', target: 225, compute: computeLiftE1RM },
    { id: 'lift-squat-pr',         title: 'Squat 315 lbs',           description: 'Estimated 1RM of 315 lbs on back squat.',              icon: Target,         exercise: 'Barbell Back Squat',  target: 315, compute: computeLiftE1RM },
    { id: 'lift-plan-completion',  title: 'Complete All Lifts',      description: 'Finish all planned lifting sessions.',                 icon: ClipboardList,  compute: computeLiftPlanCompletion },
    { id: 'lift-weekly-volume',    title: '20k Weekly Volume',       description: 'Hit 20,000 lbs total volume in a single week.',        icon: BarChart3,      target: 20000, compute: computeWeeklyVolume },
  ],
  combined: [
    { id: 'combined-training-days', title: 'Train 5 Days/Week',      description: 'Complete at least 5 training sessions per week.',      icon: Flame,          target: 5,  compute: computeTrainingDays },
    { id: 'combined-streak',        title: '14-Day Streak',          description: 'Complete a planned workout for 14 consecutive days.',  icon: TrendingUp,     target: 14, compute: computeStreak },
    { id: 'combined-consistency',   title: '80% Overall Adherence',  description: 'Complete at least 80% of all planned workouts.',      icon: Check,          target: 80, compute: computeOverallAdherence },
    { id: 'combined-balance',       title: 'Balanced Training',      description: '3 runs AND 3 lifts/week for 4 weeks.',                icon: Scale,          target: 4,  compute: computeTrainingBalance },
  ],
};

const SECTION_COLORS = {
  running:  '#34C759',
  lifting:  '#007AFF',
  combined: '#AF52DE',
  custom:   '#FF9500',
};

// ── Custom goal type options ──
const CUSTOM_GOAL_TYPES = [
  { value: 'weight_loss',    label: 'Weight Loss',        Icon: Weight,      unit: 'lbs',     placeholder: '10' },
  { value: 'run_distance',   label: 'Run Distance',       Icon: Footprints,  unit: 'miles',   placeholder: '100' },
  { value: 'workout_count',  label: 'Workout Count',      Icon: CalendarCheck, unit: 'sessions', placeholder: '50' },
  { value: 'streak_days',    label: 'Streak',             Icon: Flame,       unit: 'days',    placeholder: '30' },
  { value: 'lift_sessions',  label: 'Lift Sessions',      Icon: Dumbbell,    unit: 'sessions', placeholder: '20' },
  { value: 'run_sessions',   label: 'Run Sessions',       Icon: Footprints,  unit: 'runs',    placeholder: '20' },
  { value: 'weekly_miles',   label: 'Weekly Miles',       Icon: Mountain,    unit: 'mi/week', placeholder: '30' },
  { value: 'time_goal',      label: 'Training Time',      Icon: Timer,       unit: 'hours',   placeholder: '50' },
  { value: 'custom',         label: 'Custom',             Icon: Star,        unit: '',        placeholder: '100' },
];

// ── Local storage helpers ──
function loadCustomGoals() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('bc-custom-goals') || '[]'); } catch { return []; }
}

function saveCustomGoals(goals) {
  try { localStorage.setItem('bc-custom-goals', JSON.stringify(goals)); } catch {}
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function GoalsPage() {
  const { workouts, isLoaded } = useWorkouts();
  const [activeTab, setActiveTab]         = useState('all');
  const [customGoals, setCustomGoals]     = useState(loadCustomGoals);
  const [showAddGoal, setShowAddGoal]     = useState(false);

  // New goal form state
  const [newGoalType,    setNewGoalType]    = useState('weight_loss');
  const [newGoalTitle,   setNewGoalTitle]   = useState('');
  const [newGoalTarget,  setNewGoalTarget]  = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [newGoalNote,    setNewGoalNote]    = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');

  const goals = useMemo(() => {
    if (workouts.length === 0) return { running: [], lifting: [], combined: [] };
    return {
      running:  GOAL_TEMPLATES.running.map(g  => ({ ...g, ...g.compute(workouts, g) })),
      lifting:  GOAL_TEMPLATES.lifting.map(g  => ({ ...g, ...g.compute(workouts, g) })),
      combined: GOAL_TEMPLATES.combined.map(g => ({ ...g, ...g.compute(workouts, g) })),
    };
  }, [workouts]);

  // Compute custom goal progress
  const customGoalsComputed = useMemo(() =>
    customGoals.map(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
      return {
        ...g,
        percentage: pct,
        progressText: `${g.current} / ${g.target} ${g.unit}`,
        status: pct >= 100 ? 'ahead' : pct >= 50 ? 'on-track' : 'behind',
      };
    }),
  [customGoals]);

  const allBuiltIn    = [...goals.running, ...goals.lifting, ...goals.combined];
  const completedGoals = [...allBuiltIn, ...customGoalsComputed].filter(g => g.percentage >= 100);
  const activeGoals    = [...allBuiltIn, ...customGoalsComputed].filter(g => g.percentage < 100);

  const tabs = [
    { key: 'all',      label: 'All',      count: allBuiltIn.length + customGoalsComputed.length, Icon: null },
    { key: 'running',  label: 'Running',  count: goals.running.length,    Icon: Footprints },
    { key: 'lifting',  label: 'Lifting',  count: goals.lifting.length,    Icon: Dumbbell   },
    { key: 'combined', label: 'Combined', count: goals.combined.length,   Icon: Zap        },
    { key: 'custom',   label: 'Mine',     count: customGoalsComputed.length, Icon: Star    },
  ];

  function addCustomGoal() {
    if (!newGoalTarget || parseFloat(newGoalTarget) <= 0) return;
    const typeConfig = CUSTOM_GOAL_TYPES.find(t => t.value === newGoalType);
    const goal = {
      id:       `custom-${Date.now()}`,
      type:     newGoalType,
      title:    newGoalTitle || typeConfig?.label || 'My Goal',
      note:     newGoalNote,
      target:   parseFloat(newGoalTarget),
      current:  parseFloat(newGoalCurrent) || 0,
      unit:     typeConfig?.unit || '',
      deadline: newGoalDeadline,
      createdAt: new Date().toISOString(),
      icon:     typeConfig?.Icon || Star,
    };
    const updated = [...customGoals, goal];
    setCustomGoals(updated);
    saveCustomGoals(updated);
    // Reset form
    setNewGoalTitle(''); setNewGoalTarget(''); setNewGoalCurrent('');
    setNewGoalNote(''); setNewGoalDeadline(''); setNewGoalType('weight_loss');
    setShowAddGoal(false);
  }

  function updateCustomGoalProgress(id, newCurrent) {
    const updated = customGoals.map(g =>
      g.id === id ? { ...g, current: parseFloat(newCurrent) || 0 } : g
    );
    setCustomGoals(updated);
    saveCustomGoals(updated);
  }

  function deleteCustomGoal(id) {
    const updated = customGoals.filter(g => g.id !== id);
    setCustomGoals(updated);
    saveCustomGoals(updated);
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="bc-caption uppercase tracking-wider">Goals</h2>
        <button onClick={() => setShowAddGoal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-bc-orange text-white text-xs font-semibold rounded-[10px] hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
          style={{ background: '#FF9500' }}>
          <Plus size={13} /> My Goal
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className="bc-card flex items-center gap-6 mb-5 py-4">
        <div className="flex flex-col items-center flex-1">
          <span className="bc-stat text-bc-green-dark">{completedGoals.length}</span>
          <span className="bc-label mt-1">Achieved</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center flex-1">
          <span className="bc-stat text-primary">{activeGoals.length}</span>
          <span className="bc-label mt-1">In Progress</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center flex-1">
          <span className="bc-stat text-bc-orange-dark">
            {[...allBuiltIn, ...customGoalsComputed].length > 0
              ? Math.round([...allBuiltIn, ...customGoalsComputed].reduce((s, g) => s + g.percentage, 0) / ([...allBuiltIn, ...customGoalsComputed].length))
              : 0}%
          </span>
          <span className="bc-label mt-1">Avg Progress</span>
        </div>
      </div>

      {/* ── Tab bar — FIXED: truncate labels on mobile ── */}
      <div className="bc-tab-bar mb-5 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="bc-tab flex items-center justify-center gap-1 flex-shrink-0"
              style={{
                background:   isActive ? '#007AFF' : 'transparent',
                color:        isActive ? '#FFFFFF' : '#8E8E93',
                fontWeight:   isActive ? 600 : 500,
                borderRadius: '10px',
                flex: '1 1 0',
                minWidth: 0,
                padding: '6px 8px',
              }}>
              {tab.Icon && (
                <tab.Icon size={12} strokeWidth={2}
                  style={{ color: isActive ? '#FFFFFF' : '#AEAEB2', flexShrink: 0 }} />
              )}
              <span className="truncate text-xs">{tab.label}</span>
              <span style={{
                fontSize: '9px', fontFamily: 'var(--font-mono)',
                color: isActive ? 'rgba(255,255,255,0.7)' : '#AEAEB2',
                flexShrink: 0,
              }}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Add Custom Goal panel ── */}
      {showAddGoal && (
        <div className="bc-card mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-primary">New Personal Goal</p>
            <button onClick={() => setShowAddGoal(false)}
              className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Goal type selector */}
          <div className="mb-4">
            <label className="bc-caption uppercase tracking-wider block mb-2">Goal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CUSTOM_GOAL_TYPES.map(type => {
                const isSelected = newGoalType === type.value;
                return (
                  <button key={type.value} onClick={() => setNewGoalType(type.value)}
                    className="flex items-center gap-2 p-2.5 rounded-[12px] border text-left transition-all"
                    style={{
                      background:   isSelected ? '#FF950014' : '#F9F9FB',
                      border:       isSelected ? '1.5px solid #FF9500' : '1.5px solid transparent',
                    }}>
                    <type.Icon size={14} strokeWidth={2} style={{ color: isSelected ? '#FF9500' : '#AEAEB2', flexShrink: 0 }} />
                    <span className="text-xs font-medium truncate" style={{ color: isSelected ? '#FF9500' : '#8E8E93' }}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal details */}
          <div className="space-y-3">
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Goal Name (optional)</label>
              <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                placeholder={CUSTOM_GOAL_TYPES.find(t => t.value === newGoalType)?.label || 'My Goal'}
                className="bc-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">
                  Target ({CUSTOM_GOAL_TYPES.find(t => t.value === newGoalType)?.unit || 'units'}) *
                </label>
                <input type="number" value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)}
                  placeholder={CUSTOM_GOAL_TYPES.find(t => t.value === newGoalType)?.placeholder || '100'}
                  className="bc-input bc-data" />
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Current Progress</label>
                <input type="number" value={newGoalCurrent} onChange={e => setNewGoalCurrent(e.target.value)}
                  placeholder="0" className="bc-input bc-data" />
              </div>
            </div>
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Target Date (optional)</label>
              <input type="date" value={newGoalDeadline} onChange={e => setNewGoalDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]} className="bc-input" />
            </div>
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Note (optional)</label>
              <input type="text" value={newGoalNote} onChange={e => setNewGoalNote(e.target.value)}
                placeholder="Why this goal matters..." className="bc-input" />
            </div>
            <button onClick={addCustomGoal} disabled={!newGoalTarget || parseFloat(newGoalTarget) <= 0}
              className="bc-btn-primary w-full disabled:opacity-40 min-h-[44px]"
              style={{ background: '#FF9500' }}>
              Add Goal
            </button>
          </div>
        </div>
      )}

      {/* ── Goal sections ── */}
      {(activeTab === 'all' || activeTab === 'running') && goals.running.length > 0 && (
        <GoalSection title="Running Goals" goals={goals.running} accentColor={SECTION_COLORS.running} />
      )}
      {(activeTab === 'all' || activeTab === 'lifting') && goals.lifting.length > 0 && (
        <GoalSection title="Lifting Goals" goals={goals.lifting} accentColor={SECTION_COLORS.lifting} />
      )}
      {(activeTab === 'all' || activeTab === 'combined') && goals.combined.length > 0 && (
        <GoalSection title="Combined Goals" goals={goals.combined} accentColor={SECTION_COLORS.combined} />
      )}

      {/* ── Custom goals ── */}
      {(activeTab === 'all' || activeTab === 'custom') && (
        <div className="mb-8">
          {(activeTab === 'all' || customGoalsComputed.length > 0) && (
            <p className="bc-caption uppercase tracking-wider mb-3">My Goals</p>
          )}
          {customGoalsComputed.length === 0 ? (
            <div className="bc-card text-center py-8">
              <Star size={28} className="text-tertiary mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-primary mb-1">No personal goals yet</p>
              <p className="bc-caption mb-4">Set weight loss, mileage, habit goals — anything you want to track.</p>
              <button onClick={() => setShowAddGoal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[10px] text-white mx-auto min-h-[44px]"
                style={{ background: '#FF9500' }}>
                <Plus size={13} /> Add Your First Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customGoalsComputed.map(goal => (
                <CustomGoalCard
                  key={goal.id}
                  goal={goal}
                  onUpdateProgress={updateCustomGoalProgress}
                  onDelete={deleteCustomGoal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Achievements ── */}
      {completedGoals.length > 0 && (
        <div className="mt-4">
          <p className="bc-caption uppercase tracking-wider mb-3">Achievements</p>
          <div className="grid grid-cols-2 gap-3">
            {completedGoals.map(goal => {
              const GoalIc = goal.icon;
              const isCustom = goal.id?.startsWith('custom-');
              const sectionColor = isCustom ? SECTION_COLORS.custom :
                GOAL_TEMPLATES.running.find(g => g.id === goal.id) ? SECTION_COLORS.running :
                GOAL_TEMPLATES.lifting.find(g => g.id === goal.id) ? SECTION_COLORS.lifting :
                SECTION_COLORS.combined;
              return (
                <div key={goal.id} className="bc-card p-4 text-center border-l-4 border-bc-green">
                  <div className="flex justify-center mb-2">
                    <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {GoalIc && <GoalIc size={20} strokeWidth={2} style={{ color: sectionColor }} />}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-primary">{goal.title}</p>
                  <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px] mt-2">✓ Achieved</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// BUILT-IN GOAL SECTION
// ═══════════════════════════════════════════════════════

function GoalSection({ title, goals, accentColor }) {
  if (!goals || goals.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="bc-caption uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {goals.map((goal, i) => (
          <GoalCard key={goal.id ?? i} goal={goal} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// BUILT-IN GOAL CARD
// ═══════════════════════════════════════════════════════

function GoalCard({ goal, accentColor }) {
  const isComplete   = goal.percentage >= 100;
  const statusConfig = getGoalStatus(goal);
  const GoalIcon     = goal.icon;

  return (
    <div className={`bc-card p-4 ${isComplete ? 'border-l-4 border-bc-green' : ''}`}>
      <div className="flex gap-3">
        <ProgressRing percentage={goal.percentage} size={64} strokeWidth={5}
          color={isComplete ? '#34C759' : accentColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {GoalIcon && (
              <div style={{ width: 20, height: 20, borderRadius: '5px', background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GoalIcon size={12} strokeWidth={2} style={{ color: accentColor }} />
              </div>
            )}
            <h4 className="text-sm font-semibold text-primary truncate">{goal.title}</h4>
          </div>
          <p className="text-xs text-secondary mb-1.5 line-clamp-2">{goal.description}</p>
          <p className="bc-data text-xs text-primary mb-1.5">{goal.progressText}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`bc-pill text-[10px] ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
            {goal.projectedDate && !isComplete && (
              <span className="text-[10px] text-tertiary">{goal.projectedDate}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// CUSTOM GOAL CARD — with inline progress update
// ═══════════════════════════════════════════════════════

function CustomGoalCard({ goal, onUpdateProgress, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(goal.current));
  const isComplete = goal.percentage >= 100;
  const GoalIcon = goal.icon || Star;
  const statusConfig = getGoalStatus(goal);

  function handleSave() {
    onUpdateProgress(goal.id, editValue);
    setEditing(false);
  }

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`bc-card p-4 ${isComplete ? 'border-l-4 border-bc-green' : 'border-l-4'}`}
      style={{ borderLeftColor: isComplete ? '#34C759' : '#FF9500' }}>
      <div className="flex gap-3">
        <ProgressRing percentage={goal.percentage} size={64} strokeWidth={5}
          color={isComplete ? '#34C759' : '#FF9500'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div style={{ width: 20, height: 20, borderRadius: '5px', background: '#FF950018', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GoalIcon size={12} strokeWidth={2} style={{ color: '#FF9500' }} />
              </div>
              <h4 className="text-sm font-semibold text-primary truncate">{goal.title}</h4>
            </div>
            <button onClick={() => onDelete(goal.id)}
              className="w-6 h-6 rounded-full bg-canvas flex items-center justify-center text-tertiary hover:text-bc-red transition-colors flex-shrink-0">
              <X size={11} />
            </button>
          </div>

          {goal.note && <p className="text-xs text-secondary mb-1.5 truncate">{goal.note}</p>}

          {/* Progress update */}
          {editing ? (
            <div className="flex items-center gap-2 mb-1.5">
              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                className="bc-input bc-data !py-1 !px-2 !text-xs flex-1"
                style={{ minHeight: '32px' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
              <span className="text-xs text-tertiary flex-shrink-0">{goal.unit}</span>
              <button onClick={handleSave}
                className="px-2 py-1 bg-bc-green text-white text-xs rounded-[8px] font-medium flex-shrink-0 min-h-[32px]"
                style={{ background: '#34C759' }}>
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 mb-1.5 text-left hover:opacity-70 transition-opacity">
              <p className="bc-data text-xs text-primary">{goal.progressText}</p>
              <span className="text-[10px] text-bc-blue">edit</span>
            </button>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`bc-pill text-[10px] ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
            {daysLeft !== null && !isComplete && daysLeft > 0 && (
              <span className="text-[10px] text-tertiary">{daysLeft}d left</span>
            )}
            {daysLeft !== null && !isComplete && daysLeft <= 0 && (
              <span className="text-[10px] text-bc-red">Deadline passed</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════

function getGoalStatus(goal) {
  if (goal.percentage >= 100)     return { label: 'Achieved',    icon: '✓', bg: 'bg-bc-green-light',  text: 'text-bc-green-dark'  };
  if (goal.status === 'ahead')    return { label: 'Ahead',       icon: '↑', bg: 'bg-bc-green-light',  text: 'text-bc-green-dark'  };
  if (goal.status === 'on-track') return { label: 'On Track',    icon: '→', bg: 'bg-bc-blue-light',   text: 'text-bc-blue-dark'   };
  if (goal.status === 'behind')   return { label: 'Behind',      icon: '↓', bg: 'bg-bc-orange-light', text: 'text-bc-orange-dark' };
  return                                 { label: 'In Progress', icon: '→', bg: 'bg-surface-alt',     text: 'text-secondary'      };
}


// ═══════════════════════════════════════════════════════
// COMPUTE FUNCTIONS (unchanged)
// ═══════════════════════════════════════════════════════

function getWeeksOfData(workouts) {
  const dates = workouts.map(w => w.date).sort();
  if (dates.length < 2) return 1;
  const first = new Date(dates[0] + 'T00:00:00');
  const last  = new Date(dates[dates.length - 1] + 'T00:00:00');
  return Math.max(1, Math.ceil((last - first) / (7 * 24 * 60 * 60 * 1000)));
}

function computePlanCompletion(workouts) {
  const runs = workouts.filter(w => w.type === 'run');
  const notSkipped = runs.filter(w => w.status !== 'skipped');
  const completed  = runs.filter(w => w.status === 'completed');
  const total      = notSkipped.length || 1;
  const percentage = Math.round((completed.length / total) * 100);
  const pastDue    = runs.filter(w => w.date <= new Date().toISOString().split('T')[0]);
  const adherence  = pastDue.length > 0 ? pastDue.filter(w => w.status === 'completed').length / pastDue.length : 1;
  return { percentage, progressText: `${completed.length} of ${total} runs completed`, status: adherence >= 0.85 ? 'ahead' : adherence >= 0.65 ? 'on-track' : 'behind', projectedDate: null };
}

function computeWeeklyMileage(workouts, goal) {
  const runs = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(monday.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  const mondayStr = monday.toISOString().split('T')[0];
  const thisWeekMiles = runs.filter(w => w.date >= mondayStr).reduce((s, w) => s + (w.details.actualDistance || 0), 0);
  const weekBuckets = {};
  runs.forEach(w => {
    const d = new Date(w.date + 'T00:00:00');
    const wMon = new Date(d);
    wMon.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
    const key = wMon.toISOString().split('T')[0];
    weekBuckets[key] = (weekBuckets[key] || 0) + (w.details.actualDistance || 0);
  });
  const bestWeek = Math.max(0, ...Object.values(weekBuckets));
  const percentage = Math.round((bestWeek / goal.target) * 100);
  const daysLeft = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek);
  return { percentage, progressText: `Best: ${bestWeek.toFixed(1)} mi · This week: ${thisWeekMiles.toFixed(1)} mi`, status: thisWeekMiles >= goal.target * 0.6 ? 'on-track' : 'behind', projectedDate: percentage >= 100 ? null : `${daysLeft}d left this week` };
}

function computeRacePace(workouts, goal) {
  const longRuns = workouts.filter(w => w.type === 'run' && w.status === 'completed' && (w.details.runType === 'Long Run' || (w.details.actualDistance || 0) >= 8) && w.details.actualPace);
  if (!longRuns.length) return { percentage: 0, progressText: 'No qualifying long runs yet', status: 'behind', projectedDate: null };
  const paces = longRuns.map(r => parsePace(r.details.actualPace)).filter(Boolean);
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const percentage = avgPace <= goal.targetPace ? 100 : Math.round(((11 - avgPace) / (11 - goal.targetPace)) * 100);
  const avgMin = Math.floor(avgPace);
  const avgSec = Math.round((avgPace - avgMin) * 60);
  return { percentage: Math.max(0, percentage), progressText: `Avg pace: ${avgMin}:${avgSec.toString().padStart(2,'0')}/mi (${longRuns.length} runs)`, status: avgPace <= goal.targetPace ? 'ahead' : avgPace <= goal.targetPace + 0.5 ? 'on-track' : 'behind', projectedDate: null };
}

function computeLongRunDistance(workouts, goal) {
  const runs = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const longest = runs.reduce((max, w) => Math.max(max, w.details.actualDistance || 0), 0);
  const percentage = Math.round((longest / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `Longest: ${longest} mi of ${goal.target} mi`, status: percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeLiftE1RM(workouts, goal) {
  const lifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
  let bestE1RM = 0;
  lifts.forEach(s => (s.details.exercises || []).forEach(ex => {
    if (ex.name !== goal.exercise || !Array.isArray(ex.sets)) return;
    ex.sets.forEach(set => {
      if (!set.completed || !set.weight || !set.reps) return;
      const e = calculateE1RM(set.weight, set.reps);
      if (e > bestE1RM) bestE1RM = e;
    });
  }));
  const percentage = goal.target > 0 ? Math.round((bestE1RM / goal.target) * 100) : 0;
  let projectedDate = null;
  if (bestE1RM > 0 && bestE1RM < goal.target) {
    const weeklyGain = bestE1RM / getWeeksOfData(workouts) * 0.02;
    if (weeklyGain > 0) {
      const projected = new Date();
      projected.setDate(projected.getDate() + Math.ceil((goal.target - bestE1RM) / (weeklyGain * 10)) * 7);
      projectedDate = formatDate(projected.toISOString().split('T')[0]);
    }
  }
  return { percentage: Math.min(100, percentage), progressText: bestE1RM > 0 ? `e1RM: ${bestE1RM} lbs of ${goal.target} lbs` : `No ${goal.exercise} data`, status: percentage >= 70 ? 'on-track' : 'behind', projectedDate };
}

function computeLiftPlanCompletion(workouts) {
  const lifts = workouts.filter(w => w.type === 'lift');
  const completed = lifts.filter(w => w.status === 'completed');
  const total = lifts.filter(w => w.status !== 'skipped').length || 1;
  const percentage = Math.round((completed.length / total) * 100);
  return { percentage, progressText: `${completed.length} of ${total} lift sessions`, status: percentage >= 85 ? 'ahead' : percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeWeeklyVolume(workouts, goal) {
  const lifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
  const weekBuckets = {};
  lifts.forEach(w => {
    const d = new Date(w.date + 'T00:00:00');
    const wMon = new Date(d);
    wMon.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
    const key = wMon.toISOString().split('T')[0];
    weekBuckets[key] = (weekBuckets[key] || 0) + (w.details.totalVolume || 0);
  });
  const bestWeek = Math.max(0, ...Object.values(weekBuckets));
  const percentage = Math.round((bestWeek / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `Best: ${formatVolume(bestWeek)} of ${formatVolume(goal.target)}`, status: percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeTrainingDays(workouts, goal) {
  const completed = workouts.filter(w => w.status === 'completed' && ['run','lift','cardio'].includes(w.type));
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(monday.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  const mondayStr = monday.toISOString().split('T')[0];
  const daysThisWeek = new Set(completed.filter(w => w.date >= mondayStr).map(w => w.date)).size;
  const weekCounts = [];
  for (let i = 0; i < 4; i++) {
    const wStart = new Date(monday); wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 7);
    weekCounts.push(new Set(completed.filter(w => w.date >= wStart.toISOString().split('T')[0] && w.date < wEnd.toISOString().split('T')[0]).map(w => w.date)).size);
  }
  const avgDays = weekCounts.reduce((a, b) => a + b, 0) / weekCounts.length;
  const percentage = Math.round((avgDays / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `This week: ${daysThisWeek}/${goal.target} · Avg: ${avgDays.toFixed(1)}/wk`, status: avgDays >= goal.target ? 'ahead' : avgDays >= goal.target * 0.7 ? 'on-track' : 'behind', projectedDate: null };
}

function computeStreak(workouts, goal) {
  const completedDates = new Set(workouts.filter(w => w.status === 'completed').map(w => w.date));
  let streak = 0;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if (completedDates.has(todayStr)) streak++;
  const check = new Date(now);
  check.setDate(check.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const s = check.toISOString().split('T')[0];
    if (completedDates.has(s)) { streak++; check.setDate(check.getDate() - 1); } else break;
  }
  const allDates = [...completedDates].sort();
  let longest = 0, cur = 1;
  for (let i = 1; i < allDates.length; i++) {
    const diff = (new Date(allDates[i]+'T00:00:00') - new Date(allDates[i-1]+'T00:00:00')) / 86400000;
    if (diff === 1) cur++; else { longest = Math.max(longest, cur); cur = 1; }
  }
  longest = Math.max(longest, cur);
  return { percentage: Math.min(100, Math.round((streak / goal.target) * 100)), progressText: `Current: ${streak} days · Best: ${longest} days`, status: streak >= goal.target ? 'ahead' : streak >= goal.target * 0.5 ? 'on-track' : 'behind', projectedDate: streak < goal.target ? `${goal.target - streak} more days` : null };
}

function computeOverallAdherence(workouts, goal) {
  const now = new Date().toISOString().split('T')[0];
  const past = workouts.filter(w => w.date <= now && w.type !== 'rest');
  const completed = past.filter(w => w.status === 'completed');
  const adherence = Math.round((completed.length / (past.length || 1)) * 100);
  return { percentage: Math.min(100, Math.round((adherence / goal.target) * 100)), progressText: `${adherence}% adherence (${completed.length}/${past.length})`, status: adherence >= goal.target ? 'ahead' : adherence >= goal.target * 0.8 ? 'on-track' : 'behind', projectedDate: null };
}

function computeTrainingBalance(workouts, goal) {
  const completed = workouts.filter(w => w.status === 'completed');
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
  let balanced = 0;
  for (let i = 0; i < Math.min(goal.target + 2, 8); i++) {
    const wStart = new Date(monday); wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 7);
    const week = completed.filter(w => w.date >= wStart.toISOString().split('T')[0] && w.date < wEnd.toISOString().split('T')[0]);
    if (week.filter(w => w.type === 'run').length >= 3 && week.filter(w => w.type === 'lift').length >= 3) balanced++;
  }
  const percentage = Math.round((balanced / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `${balanced} of ${goal.target} balanced weeks`, status: balanced >= goal.target ? 'ahead' : balanced >= goal.target * 0.5 ? 'on-track' : 'behind', projectedDate: balanced < goal.target ? `${goal.target - balanced} more weeks` : null };
}