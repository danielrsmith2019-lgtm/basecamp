'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { savePlan, getActivePlan, addWorkoutsBatch } from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import PlanWizard from '@/components/shared/PlanWizard';
import PlanEditor from '@/components/shared/PlanEditor';
import {
  Sparkles, Play, Pencil, X, Check, ChevronDown, ChevronUp,
  Calendar, Loader2, Lightbulb, MessageSquare,
} from 'lucide-react';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

const PHASE_COLORS = {
  base:        'text-run-accent bg-run-bg border-run-accent/20',
  foundation:  'text-run-accent bg-run-bg border-run-accent/20',
  build:       'text-lift-accent bg-lift-bg border-lift-accent/20',
  development: 'text-lift-accent bg-lift-bg border-lift-accent/20',
  peak:        'text-rest-accent bg-rest-bg border-rest-accent/20',
  performance: 'text-rest-accent bg-rest-bg border-rest-accent/20',
  taper:       'text-cardio-accent bg-cardio-bg border-cardio-accent/20',
  deload:      'text-bc-indigo-dark bg-bc-indigo-light border-bc-indigo/20',
};

const RUN_TYPE_LABELS = {
  // snake_case keys (from plan generator)
  easy:          'Easy Run',
  tempo:         'Tempo',
  interval:      'Intervals',
  intervals:     'Intervals',
  long_run:      'Long Run',
  recovery:      'Recovery',
  fartlek:       'Fartlek',
  race:          'Race',
  shakeout:      'Shakeout',
  // Natural language variants Claude sometimes returns
  'easy run':    'Easy Run',
  'long run':    'Long Run',
  'tempo run':   'Tempo',
  'tempo run':   'Tempo',
  'interval':    'Intervals',
  'speed work':  'Speed Work',
  'hill repeat': 'Hill Repeats',
  'hill repeats':'Hill Repeats',
  'progression': 'Progression',
  'strides':     'Strides',
};

// Normalize a runType key — handles "Long Run", "long_run", "LONG_RUN" etc.
function getRunLabel(runType) {
  if (!runType) return 'Run';
  const key = runType.toLowerCase().replace(/_/g, ' ');
  // Try space-normalized lookup first
  if (RUN_TYPE_LABELS[key]) return RUN_TYPE_LABELS[key];
  // Try underscore key
  const underscoreKey = runType.toLowerCase().replace(/\s+/g, '_');
  if (RUN_TYPE_LABELS[underscoreKey]) return RUN_TYPE_LABELS[underscoreKey];
  // Capitalize as fallback
  return runType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const REST_LABELS = {
  full_rest:       'Rest',
  off_running:     'No Run',
  off_lifting:     'No Lift',
  active_recovery: 'Active Recovery',
  // variants
  'full rest':     'Rest',
  rest:            'Rest',
};

function getRestLabel(restType) {
  if (!restType) return 'Rest';
  const key = restType.toLowerCase().replace(/_/g, ' ');
  if (REST_LABELS[key]) return REST_LABELS[key];
  const underscoreKey = restType.toLowerCase().replace(/\s+/g, '_');
  if (REST_LABELS[underscoreKey]) return REST_LABELS[underscoreKey];
  return restType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Persist insights collapsed state across sessions ──
function useInsightsCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('bc-plan-insights-collapsed') === 'true';
    } catch { return true; }
  });

  function toggle() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('bc-plan-insights-collapsed', String(next)); } catch {}
      return next;
    });
  }

  function forceOpen() {
    setCollapsed(false);
    try { localStorage.setItem('bc-plan-insights-collapsed', 'false'); } catch {}
  }
  return [collapsed, toggle, forceOpen];
}

export default function PlansPage() {
  const { user } = useAuth();
  const { refresh } = useWorkouts();

  const [view, setView] = useState('loading');
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showAIEditor, setShowAIEditor] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set([1, 2]));
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [insightsCollapsed, toggleInsights, openInsights] = useInsightsCollapsed();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const plan = await getActivePlan(user.id);
      if (plan) { setActivePlan(plan); setView('active'); }
      else { setView('empty'); }
    }
    load();
  }, [user]);

  function toggleWeek(weekNum) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(weekNum) ? next.delete(weekNum) : next.add(weekNum);
      return next;
    });
  }

  function expandAll(plan) { setExpandedWeeks(new Set(plan.weeks.map(w => w.weekNumber))); }
  function collapseAll() { setExpandedWeeks(new Set()); }

  function handlePlanGenerated(plan) {
    setGeneratedPlan(plan);
    setExpandedWeeks(new Set([1, 2]));
    setView('preview');
    openInsights(); // Always show insights on new plan
  }

  function updateRun(weekIdx, runIdx, field, value) {
    setGeneratedPlan(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated.weeks[weekIdx].runs[runIdx][field] = value;
      return updated;
    });
  }

  function updateLift(weekIdx, liftIdx, field, value) {
    setGeneratedPlan(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated.weeks[weekIdx].lifts[liftIdx][field] = value;
      return updated;
    });
  }

  function updateExercise(weekIdx, liftIdx, exIdx, field, value) {
    setGeneratedPlan(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated.weeks[weekIdx].lifts[liftIdx].exercises[exIdx][field] = value;
      return updated;
    });
  }

  function toggleRestDay(weekIdx, day) {
    setGeneratedPlan(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      const week = updated.weeks[weekIdx];
      if (week.restDays.includes(day)) {
        week.restDays = week.restDays.filter(d => d !== day);
      } else {
        week.runs = week.runs.filter(r => r.dayOfWeek !== day);
        week.lifts = week.lifts.filter(l => l.dayOfWeek !== day);
        week.restDays.push(day);
      }
      return updated;
    });
  }

  // Apply AI editor changes to the live plan
  function handleAIPlanUpdate(updatedPlan) {
    if (view === 'preview') {
      setGeneratedPlan(updatedPlan);
    } else if (view === 'active') {
      setActivePlan(prev => ({ ...prev, plan_data: updatedPlan }));
    }
  }

  async function handleActivate() {
    if (!user || !generatedPlan) return;
    setActivating(true);
    setError(null);
    try {
      const saved = await savePlan(user.id, {
        name: generatedPlan.name || 'Training Plan',
        description: generatedPlan.description || '',
        plan_type: generatedPlan.plan_type || generatedPlan.planType || 'hybrid',
        plan_data: generatedPlan,
        is_active: true,
        progress: { completed: 0, total: countTotalSessions(generatedPlan) },
      });
      if (!saved) throw new Error('Failed to save plan');

      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      await supabase.from('workouts').delete().eq('user_id', user.id).eq('status', 'planned');

      const workoutEntries = planToWorkouts(generatedPlan);
      if (workoutEntries.length > 0) {
        const created = await addWorkoutsBatch(user.id, workoutEntries);
        if (created.length === 0) console.warn('No workouts created from plan');
      }

      setActivePlan({ ...saved, plan_data: generatedPlan });
      setGeneratedPlan(null);
      setView('active');
      refresh?.();
    } catch (err) {
      console.error('Activation error:', err);
      setError('Failed to activate plan. Please try again.');
    } finally {
      setActivating(false);
    }
  }

  function planToWorkouts(plan) {
    const workouts = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + daysUntilMonday);

    plan.weeks.forEach((week, weekIdx) => {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + weekIdx * 7);
      const restDayNames = new Set(
        (week.restDays || []).map(entry => typeof entry === 'object' ? entry.dayOfWeek : entry)
      );

      (week.runs || []).forEach(run => {
        const dayOffset = DAY_ORDER.indexOf(run.dayOfWeek);
        if (dayOffset === -1 || restDayNames.has(run.dayOfWeek)) return;
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        workouts.push({
          date: date.toISOString().split('T')[0], type: 'run', status: 'planned',
          details: {
            runType: run.runType || 'easy',
            runDescription: getRunLabel(run.runType),
            plannedDistance: run.distance,
            targetPace: run.targetPace || '',
            duration: run.duration,
            notes: run.notes || '',
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
        });
      });

      (week.lifts || []).forEach(lift => {
        const dayOffset = DAY_ORDER.indexOf(lift.dayOfWeek);
        if (dayOffset === -1 || restDayNames.has(lift.dayOfWeek)) return;
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        workouts.push({
          date: date.toISOString().split('T')[0], type: 'lift', status: 'planned',
          details: {
            sessionName: lift.sessionName || 'Strength Session',
            muscleGroups: lift.muscleGroups || [],
            exercises: (lift.exercises || []).map(ex => ({ name: ex.name, sets: ex.sets, reps: ex.reps, notes: ex.notes || '' })),
            duration: lift.duration,
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
        });
      });

      (week.restDays || []).forEach(entry => {
        const dayName = typeof entry === 'object' ? entry.dayOfWeek : entry;
        const restType = typeof entry === 'object' ? entry.restType : 'full_rest';
        const dayOffset = DAY_ORDER.indexOf(dayName);
        if (dayOffset === -1) return;
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        workouts.push({
          date: date.toISOString().split('T')[0], type: 'rest', status: 'planned',
          details: { restType, weekNumber: week.weekNumber, phase: week.phase },
        });
      });
    });

    return workouts;
  }

  function countTotalSessions(plan) {
    return plan.weeks.reduce((sum, w) => sum + (w.runs?.length || 0) + (w.lifts?.length || 0), 0);
  }

  // ── Loading ──
  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="text-tertiary animate-spin" />
      </div>
    );
  }

  // ── Wizard ──
  if (view === 'wizard') {
    return (
      <PlanWizard
        onComplete={handlePlanGenerated}
        onCancel={() => setView(activePlan ? 'active' : 'empty')}
      />
    );
  }

  // ── Empty ──
  if (view === 'empty') {
    return (
      <div className="bc-empty min-h-[50vh]">
        <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center mb-4">
          <Calendar size={28} className="text-bc-indigo" />
        </div>
        <p className="bc-empty-title">No Active Plan</p>
        <p className="bc-empty-text mb-6">
          Generate an AI-powered training plan tailored to your goals, fitness level, and schedule.
        </p>
        <button onClick={() => setView('wizard')}
          className="flex items-center gap-2 px-6 py-3 bg-bc-indigo hover:opacity-90
                     active:scale-95 text-white text-sm font-semibold rounded-[10px] transition-all">
          <Sparkles size={16} /> Generate Your Plan
        </button>
      </div>
    );
  }

  const displayPlan = view === 'preview' ? generatedPlan : activePlan?.plan_data;

  if (!displayPlan || !displayPlan.weeks) {
    return (
      <div className="bc-empty py-12">
        <p className="bc-empty-title">No plan data available.</p>
        <button onClick={() => setView('wizard')} className="text-bc-blue text-sm mt-2 hover:underline">
          Generate a new plan
        </button>
      </div>
    );
  }

  return (
    <div className="pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-[17px] font-semibold text-primary">
            {displayPlan.name || 'Training Plan'}
          </h2>
          {displayPlan.description && (
            <p className="text-sm text-secondary mt-1 max-w-lg">{displayPlan.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="bc-caption">{displayPlan.total_weeks || displayPlan.weeks.length} weeks</span>
            <span className="bc-caption">·</span>
            <span className="bc-caption">{countTotalSessions(displayPlan)} sessions</span>
            {view === 'active' && (
              <>
                <span className="bc-caption">·</span>
                <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px]">Active</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Edit button — available on both preview and active */}
          <button
            onClick={() => setShowAIEditor(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px]
                       bg-bc-indigo-light text-bc-indigo hover:opacity-80 transition-colors min-h-[44px]">
            <MessageSquare size={12} />
            Edit with AI
          </button>

          {view === 'preview' && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-colors min-h-[44px]
                  ${editMode ? 'bg-bc-blue text-white' : 'bg-canvas border border-border text-secondary hover:text-primary'}`}>
                {editMode ? <Check size={12} /> : <Pencil size={12} />}
                {editMode ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={handleActivate}
                disabled={activating}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-bc-indigo hover:opacity-90
                           disabled:opacity-50 text-white text-xs font-semibold rounded-[10px] transition-all min-h-[44px]">
                {activating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {activating ? 'Activating…' : 'Activate'}
              </button>
            </>
          )}
          {view === 'active' && (
            <button onClick={() => setView('wizard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-border
                         text-secondary text-xs rounded-[10px] hover:text-primary transition-colors min-h-[44px]">
              <Sparkles size={12} /> New Plan
            </button>
          )}
        </div>
      </div>

      {/* ── Expand / Collapse all ── */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => expandAll(displayPlan)} className="bc-caption hover:text-secondary transition-colors min-h-[44px]">
          Expand all
        </button>
        <span className="bc-caption">·</span>
        <button onClick={collapseAll} className="bc-caption hover:text-secondary transition-colors min-h-[44px]">
          Collapse all
        </button>
      </div>

      {/* ── Plan Insights — CHANGED: collapsed by default, persisted ── */}
      {displayPlan.plan_insights?.length > 0 && (
        <div className="mb-4">
          <button
            onClick={toggleInsights}
            className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors mb-2 min-h-[44px]">
            <Lightbulb size={14} className="text-bc-orange" />
            <span className="font-medium">Why your plan is built this way</span>
            <span className="text-tertiary">({displayPlan.plan_insights.length} insights)</span>
            {insightsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {!insightsCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayPlan.plan_insights.map((insight, idx) => {
                const categoryColors = {
                  scheduling:    'border-bc-blue/20 bg-bc-blue-light/40',
                  interference:  'border-bc-red/20 bg-bc-red-light/40',
                  periodization: 'border-rest-accent/20 bg-rest-bg',
                  recovery:      'border-run-accent/20 bg-run-bg',
                  progression:   'border-cardio-accent/20 bg-cardio-bg',
                  deload:        'border-bc-indigo/20 bg-bc-indigo-light/40',
                  nutrition_note:'border-bc-teal/20 bg-bc-teal-light/40',
                };
                const colorClass = categoryColors[insight.category] || 'border-border bg-canvas';
                return (
                  <div key={idx} className={`p-3 rounded-[14px] border ${colorClass}`}>
                    <span className="bc-caption uppercase">{insight.category}</span>
                    <p className="text-xs font-semibold text-primary mb-1 mt-0.5">{insight.title}</p>
                    <p className="text-[11px] text-secondary leading-relaxed">{insight.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-3 bg-bc-red-light border border-bc-red/20 rounded-[14px]">
          <p className="text-bc-red-dark text-xs">{error}</p>
        </div>
      )}

      {/* ── Week rows ── */}
      <div className="space-y-3">
        {displayPlan.weeks.map((week, weekIdx) => {
          const isExpanded = expandedWeeks.has(week.weekNumber);
          const phaseStyle = PHASE_COLORS[week.phase] || PHASE_COLORS.base;

          return (
            <div key={week.weekNumber} className="bc-card-flush">
              <button
                onClick={() => toggleWeek(week.weekNumber)}
                className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors min-h-[44px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bc-data text-sm font-bold text-primary w-16">Week {week.weekNumber}</span>
                  <span className={`bc-pill text-[10px] font-medium capitalize border ${phaseStyle}`}>{week.phase}</span>
                  <span className="bc-caption hidden sm:inline">
                    {week.totalMileage && `${week.totalMileage} mi`}
                    {week.runs?.length > 0 && ` · ${week.runs.length} run${week.runs.length !== 1 ? 's' : ''}`}
                    {week.lifts?.length > 0 && ` · ${week.lifts.length} lift${week.lifts.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="bc-caption sm:hidden">
                    {(week.runs?.length || 0) + (week.lifts?.length || 0)} sessions
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-tertiary flex-shrink-0" /> : <ChevronDown size={14} className="text-tertiary flex-shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="overflow-x-auto -mx-4 px-4 sm:overflow-visible sm:mx-0 sm:px-0">
                    <div className="grid grid-cols-7 gap-1.5 mt-3 min-w-[560px] sm:min-w-0">
                      {DAY_ORDER.map(day => {
                        const run = week.runs?.find(r => r.dayOfWeek === day);
                        const lift = week.lifts?.find(l => l.dayOfWeek === day);
                        const restEntry = Array.isArray(week.restDays)
                          ? week.restDays.find(r => typeof r === 'object' ? r.dayOfWeek === day : r === day)
                          : null;
                        const isRest = !!restEntry;
                        const restType = typeof restEntry === 'object' ? restEntry?.restType : 'full_rest';

                        const REST_COLORS = { full_rest: 'text-rest-accent', off_running: 'text-run-mid', off_lifting: 'text-lift-mid', active_recovery: 'text-cardio-accent' };

                        return (
                          <div key={day} className="min-h-[100px]">
                            <p className="text-[10px] text-tertiary text-center mb-1 uppercase tracking-wider">{DAY_SHORT[day]}</p>
                            <div className={`rounded-[10px] p-2 h-full transition-colors border ${
                              isRest ? 'bg-rest-bg border-rest-accent/20' :
                              run && lift ? 'bg-surface border-border' :
                              run ? 'bg-run-bg border-run-accent/20' :
                              lift ? 'bg-lift-bg border-lift-accent/20' :
                              'bg-canvas border-border'
                            }`}>
                              {isRest && (
                                <div className="flex flex-col items-center justify-center h-full min-h-[80px]">
                                  <span className={`text-[10px] font-medium ${REST_COLORS[restType] || 'text-rest-accent'}`}>{getRestLabel(restType)}</span>
                                  {editMode && <button onClick={() => toggleRestDay(weekIdx, day)} className="mt-1 text-[9px] text-tertiary hover:text-bc-red min-h-[44px] flex items-center">remove</button>}
                                </div>
                              )}
                              {run && (
                                <div className="mb-1.5">
                                  <div className="flex items-center gap-1 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-run-accent" />
                                    <span className="text-[10px] font-medium text-run-accent uppercase">{getRunLabel(run.runType)}</span>
                                  </div>
                                  {editMode ? (
                                    <input type="number" value={run.distance || ''}
                                      onChange={e => updateRun(weekIdx, week.runs.indexOf(run), 'distance', Number(e.target.value))}
                                      className="bc-input !py-0.5 !px-1.5 !text-[10px] bc-data" step="0.5" />
                                  ) : (
                                    <>
                                      <p className="bc-data text-xs text-primary">{run.distance} mi</p>
                                      {run.targetPace && <p className="text-[9px] text-tertiary">{run.targetPace}</p>}
                                    </>
                                  )}
                                </div>
                              )}
                              {lift && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-lift-accent" />
                                    <span className="text-[10px] font-medium text-lift-accent truncate">
                                      {editMode ? (
                                        <input type="text" value={lift.sessionName || ''}
                                          onChange={e => updateLift(weekIdx, week.lifts.indexOf(lift), 'sessionName', e.target.value)}
                                          className="bc-input !py-0.5 !px-1.5 !text-[10px]" />
                                      ) : (lift.sessionName || 'Strength')}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-tertiary">{lift.exercises?.length || 0} exercises</p>
                                  {lift.muscleGroups && <p className="text-[9px] text-tertiary truncate">{lift.muscleGroups.join(', ')}</p>}
                                </div>
                              )}
                              {!isRest && !run && !lift && (
                                <div className="flex items-center justify-center h-full min-h-[80px]">
                                  {editMode ? (
                                    <button onClick={() => toggleRestDay(weekIdx, day)} className="text-[9px] text-tertiary hover:text-rest-accent min-h-[44px] flex items-center">+ rest</button>
                                  ) : <span className="text-[9px] text-tertiary">—</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Session details — view mode */}
                  {isExpanded && !editMode && (
                    <div className="mt-4 space-y-3">
                      {week.runs?.map((run, runIdx) => (
                        <div key={`run-${runIdx}`} className="flex items-start gap-3 p-3 bg-run-bg rounded-[14px] border border-run-accent/20">
                          <div className="w-1 rounded-full bg-run-accent self-stretch" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-run-accent capitalize">{DAY_SHORT[run.dayOfWeek]} — {getRunLabel(run.runType)}</span>
                              <span className="bc-data text-xs text-primary">{run.distance} mi</span>
                              {run.targetPace && <span className="text-[10px] text-tertiary">@ {run.targetPace}</span>}
                              {run.duration && <span className="text-[10px] text-tertiary">{run.duration} min</span>}
                            </div>
                            {run.notes && <p className="text-[10px] text-secondary mt-1">{run.notes}</p>}
                          </div>
                        </div>
                      ))}
                      {week.lifts?.map((lift, liftIdx) => (
                        <div key={`lift-${liftIdx}`} className="p-3 bg-lift-bg rounded-[14px] border border-lift-accent/20">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-lift-accent" />
                            <span className="text-xs font-medium text-lift-accent">{DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}</span>
                            {lift.duration && <span className="text-[10px] text-tertiary">{lift.duration} min</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-3">
                            {lift.exercises?.map((ex, exIdx) => (
                              <div key={exIdx} className="flex items-baseline gap-2">
                                <span className="text-[10px] text-primary">{ex.name}</span>
                                <span className="bc-data text-[10px] text-tertiary">{ex.sets}×{ex.reps}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Session details — edit mode */}
                  {isExpanded && editMode && (
                    <div className="mt-4 space-y-3">
                      {week.lifts?.map((lift, liftIdx) => (
                        <div key={`edit-lift-${liftIdx}`} className="p-3 bg-lift-bg rounded-[14px] border border-lift-accent/20">
                          <p className="text-xs font-medium text-lift-accent mb-2">{DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}</p>
                          <div className="space-y-2">
                            {lift.exercises?.map((ex, exIdx) => (
                              <div key={exIdx} className="flex items-center gap-2">
                                <input type="text" value={ex.name}
                                  onChange={e => updateExercise(weekIdx, liftIdx, exIdx, 'name', e.target.value)}
                                  className="bc-input !py-1 !px-2 !text-[10px] flex-1" />
                                <input type="number" value={ex.sets}
                                  onChange={e => updateExercise(weekIdx, liftIdx, exIdx, 'sets', Number(e.target.value))}
                                  className="bc-input bc-data !py-1 !px-2 !text-[10px] w-12 text-center" />
                                <span className="text-[10px] text-tertiary">×</span>
                                <input type="text" value={ex.reps}
                                  onChange={e => updateExercise(weekIdx, liftIdx, exIdx, 'reps', e.target.value)}
                                  className="bc-input bc-data !py-1 !px-2 !text-[10px] w-16 text-center" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── AI Editor modal ── */}
      {showAIEditor && (
        <PlanEditor
          plan={displayPlan}
          onPlanUpdate={handleAIPlanUpdate}
          onClose={() => setShowAIEditor(false)}
        />
      )}
    </div>
  );
}