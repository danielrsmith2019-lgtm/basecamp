'use client';

/**
 * Plans Page — Generate, preview, edit, and activate training plans.
 * 
 * Flow: Generate (wizard) → Preview (calendar) → Edit (optional) → Activate
 * Activation saves the plan to Supabase and injects all sessions as "planned" workouts.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { savePlan, getActivePlan, getAllPlans, updatePlan, addWorkoutsBatch } from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import PlanWizard from '@/components/shared/PlanWizard';
import {
  Sparkles, Play, Pencil, X, Check, ChevronDown, ChevronUp,
  Calendar, Loader2, Archive, Trash2, Lightbulb,
} from 'lucide-react';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

const PHASE_COLORS = {
  base: 'text-green-400 bg-green-400/10 border-green-400/20',
  foundation: 'text-green-400 bg-green-400/10 border-green-400/20',
  build: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  development: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  peak: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  performance: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  taper: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  deload: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};

const RUN_TYPE_LABELS = {
  easy: 'Easy Run',
  tempo: 'Tempo',
  interval: 'Intervals',
  long_run: 'Long Run',
  recovery: 'Recovery',
  fartlek: 'Fartlek',
};

export default function PlansPage() {
  const { user } = useAuth();
  const { addNewWorkout, refresh } = useWorkouts();

  const [view, setView] = useState('loading'); // loading | empty | wizard | preview | active
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set([1, 2]));
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [showInsights, setShowInsights] = useState(true);

  // ── Load active plan on mount ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      const plan = await getActivePlan(user.id);
      if (plan) {
        setActivePlan(plan);
        setView('active');
      } else {
        setView('empty');
      }
    }
    load();
  }, [user]);

  // ── Toggle week expansion ──
  function toggleWeek(weekNum) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(weekNum) ? next.delete(weekNum) : next.add(weekNum);
      return next;
    });
  }

  // ── Expand / collapse all ──
  function expandAll(plan) {
    const all = new Set(plan.weeks.map(w => w.weekNumber));
    setExpandedWeeks(all);
  }

  function collapseAll() {
    setExpandedWeeks(new Set());
  }

  // ── Plan generation complete ──
  function handlePlanGenerated(plan) {
    setGeneratedPlan(plan);
    setExpandedWeeks(new Set([1, 2]));
    setView('preview');
  }

  // ── Edit handlers ──
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
        // Remove any run or lift on that day
        week.runs = week.runs.filter(r => r.dayOfWeek !== day);
        week.lifts = week.lifts.filter(l => l.dayOfWeek !== day);
        week.restDays.push(day);
      }
      return updated;
    });
  }

  // ── Activate plan ──
  async function handleActivate() {
    if (!user || !generatedPlan) return;
    setActivating(true);
    setError(null);

    try {
      // 1. Save the plan to Supabase
      const saved = await savePlan(user.id, {
        name: generatedPlan.name || 'Hybrid Training Plan',
        description: generatedPlan.description || '',
        plan_type: generatedPlan.plan_type || 'hybrid',
        plan_data: generatedPlan,
        is_active: true,
        progress: { completed: 0, total: countTotalSessions(generatedPlan) },
      });

      if (!saved) {
        throw new Error('Failed to save plan');
      }
      // 2. Delete ALL existing planned workouts (including rest days)
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      await supabase
        .from('workouts')
        .delete()
        .eq('user_id', user.id)
        .in('status', ['planned']);
      // 2. Convert plan sessions into workout entries
      const workoutEntries = planToWorkouts(generatedPlan);

      // 3. Batch insert all planned workouts
      if (workoutEntries.length > 0) {
        const created = await addWorkoutsBatch(user.id, workoutEntries);
        if (created.length === 0) {
          console.warn('No workouts were created from the plan');
        }
      }

      // 4. Update state
      setActivePlan({ ...saved, plan_data: generatedPlan });
      setGeneratedPlan(null);
      setView('active');

    } catch (err) {
      console.error('Activation error:', err);
      setError('Failed to activate plan. Please try again.');
    } finally {
      setActivating(false);
    }
  }

  // ── Convert plan weeks into dated workout entries ──
  function planToWorkouts(plan) {
    const workouts = [];
    const today = new Date();

    // Find the next Monday as the start date
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + daysUntilMonday);

    plan.weeks.forEach((week, weekIdx) => {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + weekIdx * 7);
      // Build a set of rest day names so we can skip runs/lifts on those days
      const restDayNames = new Set(
        (week.restDays || []).map(entry =>
          typeof entry === 'object' ? entry.dayOfWeek : entry
        )
      );

      // Runs
      (week.runs || []).forEach(run => {
        const dayOffset = DAY_ORDER.indexOf(run.dayOfWeek);
        if (dayOffset === -1 || restDayNames.has(run.dayOfWeek)) return;

        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);

        workouts.push({
          date: date.toISOString().split('T')[0],
          type: 'run',
          status: 'planned',
          details: {
            runType: run.runType || 'easy',
            runDescription: RUN_TYPE_LABELS[run.runType] || run.runType,
            plannedDistance: run.distance,
            targetPace: run.targetPace || '',
            duration: run.duration,
            notes: run.notes || '',
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
        });
      });

      // Lifts
      (week.lifts || []).forEach(lift => {
        const dayOffset = DAY_ORDER.indexOf(lift.dayOfWeek);
        if (dayOffset === -1 || restDayNames.has(lift.dayOfWeek)) return;

        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);

        workouts.push({
          date: date.toISOString().split('T')[0],
          type: 'lift',
          status: 'planned',
          details: {
            sessionName: lift.sessionName || 'Strength Session',
            muscleGroups: lift.muscleGroups || [],
            exercises: (lift.exercises || []).map(ex => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              notes: ex.notes || '',
            })),
            duration: lift.duration,
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
        });
      });

      // Rest days — handle both string format and object format
      (week.restDays || []).forEach(entry => {
        const dayName = typeof entry === 'object' ? entry.dayOfWeek : entry;
        const restType = typeof entry === 'object' ? entry.restType : 'full_rest';
        const dayOffset = DAY_ORDER.indexOf(dayName);
        if (dayOffset === -1) return;

        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);

        workouts.push({
          date: date.toISOString().split('T')[0],
          type: 'rest',
          status: 'planned',
          details: {
            restType,
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
        });
      });
    });

    return workouts;
  }

  function countTotalSessions(plan) {
    return plan.weeks.reduce((sum, w) => sum + (w.runs?.length || 0) + (w.lifts?.length || 0), 0);
  }

  // ── LOADING ──
  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="text-muted animate-spin" />
      </div>
    );
  }

  // ── WIZARD ──
  if (view === 'wizard') {
    return (
      <div>
        <PlanWizard
          onComplete={handlePlanGenerated}
          onCancel={() => setView(activePlan ? 'active' : 'empty')}
        />
      </div>
    );
  }

  // ── EMPTY STATE ──
  if (view === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
          <Calendar size={28} className="text-accent" />
        </div>
        <h2 className="text-lg font-bold text-primary mb-2">No Active Plan</h2>
        <p className="text-sm text-secondary mb-6 max-w-sm">
          Generate an AI-powered hybrid training plan tailored to your goals, fitness level, and schedule.
        </p>
        <button
          onClick={() => setView('wizard')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Sparkles size={16} />
          Generate Your Plan
        </button>
      </div>
    );
  }

  // ── Get the plan to display (generated preview or active) ──
  const displayPlan = view === 'preview' ? generatedPlan : activePlan?.plan_data;

  if (!displayPlan || !displayPlan.weeks) {
    return (
      <div className="text-center py-12">
        <p className="text-muted text-sm">No plan data available.</p>
        <button onClick={() => setView('wizard')} className="text-accent text-sm mt-2">
          Generate a new plan
        </button>
      </div>
    );
  }

  // ── PLAN DISPLAY (Preview or Active) ──
  return (
    <div className="pb-10">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-primary">{displayPlan.name || 'Training Plan'}</h2>
          {displayPlan.description && (
            <p className="text-sm text-secondary mt-1 max-w-lg">{displayPlan.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted">{displayPlan.total_weeks || displayPlan.weeks.length} weeks</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{countTotalSessions(displayPlan)} sessions</span>
            {view === 'active' && (
              <>
                <span className="text-xs text-muted">·</span>
                <span className="stride-badge bg-green-400/20 text-green-400 text-[10px]">Active</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {view === 'preview' && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  editMode
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-gray-700 text-secondary hover:text-primary'
                }`}
              >
                {editMode ? <Check size={12} /> : <Pencil size={12} />}
                {editMode ? 'Done Editing' : 'Edit'}
              </button>
              <button
                onClick={handleActivate}
                disabled={activating}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
              >
                {activating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {activating ? 'Activating...' : 'Activate Plan'}
              </button>
            </>
          )}
          {view === 'active' && (
            <button
              onClick={() => setView('wizard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-gray-700 text-secondary text-xs rounded-lg hover:text-primary transition-colors"
            >
              <Sparkles size={12} />
              New Plan
            </button>
          )}
        </div>
      </div>

      {/* ── Expand/Collapse All ── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => expandAll(displayPlan)}
          className="text-[10px] text-muted hover:text-secondary transition-colors"
        >
          Expand all
        </button>
        <span className="text-[10px] text-muted">·</span>
        <button
          onClick={collapseAll}
          className="text-[10px] text-muted hover:text-secondary transition-colors"
        >
          Collapse all
        </button>
      </div>

      {/* ── Plan Insights ── */}
      {displayPlan.plan_insights && displayPlan.plan_insights.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors mb-2"
          >
            <Lightbulb size={14} className="text-yellow-400" />
            <span className="font-medium">Why your plan is built this way</span>
            <span className="text-muted">({displayPlan.plan_insights.length} insights)</span>
            {showInsights ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showInsights && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayPlan.plan_insights.map((insight, idx) => {
                const categoryColors = {
                  scheduling: 'border-blue-500/20 bg-blue-500/5',
                  interference: 'border-red-500/20 bg-red-500/5',
                  periodization: 'border-purple-500/20 bg-purple-500/5',
                  recovery: 'border-green-500/20 bg-green-500/5',
                  progression: 'border-orange-500/20 bg-orange-500/5',
                  deload: 'border-yellow-500/20 bg-yellow-500/5',
                  nutrition_note: 'border-cyan-500/20 bg-cyan-500/5',
                };
                const colorClass = categoryColors[insight.category] || 'border-gray-700 bg-surface';

                return (
                  <div key={idx} className={`p-3 rounded-xl border ${colorClass}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted">{insight.category}</span>
                    </div>
                    <p className="text-xs font-medium text-primary mb-1">{insight.title}</p>
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
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* ── Week Rows ── */}
      <div className="space-y-3">
        {displayPlan.weeks.map((week, weekIdx) => {
          const isExpanded = expandedWeeks.has(week.weekNumber);
          const phaseStyle = PHASE_COLORS[week.phase] || PHASE_COLORS.base;

          return (
            <div key={week.weekNumber} className="stride-card overflow-hidden">
              {/* Week Header */}
              <button
                onClick={() => toggleWeek(week.weekNumber)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="stride-data text-sm font-bold text-primary w-16">
                    Week {week.weekNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border ${phaseStyle}`}>
                    {week.phase}
                  </span>
                  <span className="text-xs text-muted hidden sm:inline">
                    {week.totalMileage && `${week.totalMileage} mi`}
                    {week.runs?.length > 0 && ` · ${week.runs.length} run${week.runs.length !== 1 ? 's' : ''}`}
                    {week.lifts?.length > 0 && ` · ${week.lifts.length} lift${week.lifts.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
              </button>

              {/* Week Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800">
                  <div className="grid grid-cols-7 gap-1.5 mt-3">
                    {DAY_ORDER.map(day => {
                      const run = week.runs?.find(r => r.dayOfWeek === day);
                      const lift = week.lifts?.find(l => l.dayOfWeek === day);
                      // Handle both old format (string array) and new format (object array)
                      const restEntry = Array.isArray(week.restDays)
                        ? week.restDays.find(r => typeof r === 'object' ? r.dayOfWeek === day : r === day)
                        : null;
                      const isRest = !!restEntry;
                      const restType = typeof restEntry === 'object' ? restEntry?.restType : 'full_rest';

                      const REST_LABELS = {
                        full_rest: 'Full Rest',
                        off_running: 'Off Running',
                        off_lifting: 'Off Lifting',
                        active_recovery: 'Active Recovery',
                      };
                      const REST_COLORS = {
                        full_rest: 'text-purple-400',
                        off_running: 'text-green-300',
                        off_lifting: 'text-blue-300',
                        active_recovery: 'text-yellow-400',
                      };

                      return (
                        <div key={day} className="min-h-[100px]">
                          {/* Day Label */}
                          <p className="text-[10px] text-muted text-center mb-1 uppercase tracking-wider">
                            {DAY_SHORT[day]}
                          </p>

                          {/* Day Content */}
                          <div className={`rounded-lg p-2 h-full transition-colors ${
                            isRest ? 'bg-purple-500/5 border border-purple-500/10' :
                            run && lift ? 'bg-surface border border-gray-800' :
                            run ? 'bg-green-500/5 border border-green-500/10' :
                            lift ? 'bg-blue-500/5 border border-blue-500/10' :
                            'bg-surface border border-gray-800'
                          }`}>
                            {/* Rest Day */}
                            {isRest && (
                              <div className="flex flex-col items-center justify-center h-full min-h-[80px]">
                                <span className={`text-[10px] font-medium ${REST_COLORS[restType] || 'text-purple-400'}`}>
                                  {REST_LABELS[restType] || 'Rest'}
                                </span>
                                {editMode && (
                                  <button
                                    onClick={() => toggleRestDay(weekIdx, day)}
                                    className="mt-1 text-[9px] text-muted hover:text-red-400"
                                  >
                                    remove
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Run Card */}
                            {run && (
                              <div className="mb-1.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                  <span className="text-[10px] font-medium text-green-400 uppercase">
                                    {RUN_TYPE_LABELS[run.runType] || run.runType}
                                  </span>
                                </div>
                                {editMode ? (
                                  <input
                                    type="number"
                                    value={run.distance || ''}
                                    onChange={(e) => updateRun(weekIdx, week.runs.indexOf(run), 'distance', Number(e.target.value))}
                                    className="w-full px-1.5 py-0.5 bg-[#0A0F1A] border border-gray-700 rounded text-[10px] text-white font-mono"
                                    step="0.5"
                                  />
                                ) : (
                                  <>
                                    <p className="stride-data text-xs text-primary">
                                      {run.distance} mi
                                    </p>
                                    {run.targetPace && (
                                      <p className="text-[9px] text-muted">{run.targetPace}</p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Lift Card */}
                            {lift && (
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                  <span className="text-[10px] font-medium text-blue-400 truncate">
                                    {editMode ? (
                                      <input
                                        type="text"
                                        value={lift.sessionName || ''}
                                        onChange={(e) => updateLift(weekIdx, week.lifts.indexOf(lift), 'sessionName', e.target.value)}
                                        className="w-full px-1.5 py-0.5 bg-[#0A0F1A] border border-gray-700 rounded text-[10px] text-white"
                                      />
                                    ) : (
                                      lift.sessionName || 'Strength'
                                    )}
                                  </span>
                                </div>
                                <p className="text-[9px] text-muted">
                                  {lift.exercises?.length || 0} exercises
                                </p>
                                {lift.muscleGroups && (
                                  <p className="text-[9px] text-muted truncate">
                                    {lift.muscleGroups.join(', ')}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Empty day */}
                            {!isRest && !run && !lift && (
                              <div className="flex items-center justify-center h-full min-h-[80px]">
                                {editMode ? (
                                  <button
                                    onClick={() => toggleRestDay(weekIdx, day)}
                                    className="text-[9px] text-muted hover:text-purple-400"
                                  >
                                    + rest
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-muted">—</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded exercise details */}
                  {isExpanded && !editMode && (
                    <div className="mt-4 space-y-3">
                      {/* Run details */}
                      {week.runs?.map((run, runIdx) => (
                        <div key={`run-${runIdx}`} className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                          <div className="w-1 h-full rounded-full bg-green-400 self-stretch" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-green-400 capitalize">
                                {DAY_SHORT[run.dayOfWeek]} — {RUN_TYPE_LABELS[run.runType] || run.runType}
                              </span>
                              <span className="stride-data text-xs text-primary">{run.distance} mi</span>
                              {run.targetPace && <span className="text-[10px] text-muted">@ {run.targetPace}</span>}
                              {run.duration && <span className="text-[10px] text-muted">{run.duration} min</span>}
                            </div>
                            {run.notes && <p className="text-[10px] text-secondary mt-1">{run.notes}</p>}
                          </div>
                        </div>
                      ))}

                      {/* Lift details */}
                      {week.lifts?.map((lift, liftIdx) => (
                        <div key={`lift-${liftIdx}`} className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-xs font-medium text-blue-400">
                              {DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}
                            </span>
                            {lift.duration && <span className="text-[10px] text-muted">{lift.duration} min</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-3">
                            {lift.exercises?.map((ex, exIdx) => (
                              <div key={exIdx} className="flex items-baseline gap-2">
                                <span className="text-[10px] text-primary">{ex.name}</span>
                                <span className="stride-data text-[10px] text-muted">
                                  {ex.sets}×{ex.reps}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit mode: exercise editing */}
                  {isExpanded && editMode && (
                    <div className="mt-4 space-y-3">
                      {week.lifts?.map((lift, liftIdx) => (
                        <div key={`edit-lift-${liftIdx}`} className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                          <p className="text-xs font-medium text-blue-400 mb-2">
                            {DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}
                          </p>
                          <div className="space-y-2">
                            {lift.exercises?.map((ex, exIdx) => (
                              <div key={exIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={ex.name}
                                  onChange={(e) => updateExercise(weekIdx, liftIdx, exIdx, 'name', e.target.value)}
                                  className="flex-1 px-2 py-1 bg-[#0A0F1A] border border-gray-700 rounded text-[10px] text-white"
                                />
                                <input
                                  type="number"
                                  value={ex.sets}
                                  onChange={(e) => updateExercise(weekIdx, liftIdx, exIdx, 'sets', Number(e.target.value))}
                                  className="w-12 px-2 py-1 bg-[#0A0F1A] border border-gray-700 rounded text-[10px] text-white font-mono text-center"
                                />
                                <span className="text-[10px] text-muted">×</span>
                                <input
                                  type="text"
                                  value={ex.reps}
                                  onChange={(e) => updateExercise(weekIdx, liftIdx, exIdx, 'reps', e.target.value)}
                                  className="w-16 px-2 py-1 bg-[#0A0F1A] border border-gray-700 rounded text-[10px] text-white font-mono text-center"
                                />
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
    </div>
  );
}