'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { savePlan, getActivePlan, addWorkoutsBatch } from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import PlanWizard from '@/components/shared/PlanWizard';
import PlanEditor from '@/components/shared/PlanEditor';
import LogForm from '@/components/shared/LogForm';
import {
  Sparkles, Play, Pencil, X, Check, ChevronDown, ChevronUp,
  Calendar, Loader2, Lightbulb, MessageSquare, AlertTriangle,
} from 'lucide-react';

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_SHORT = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' };

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

function getPlanWeekStartDate(weekNumber) {
  const now = new Date();
  const dow = now.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToMonday, 12, 0, 0);
  monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
  return monday;
}

function getPlanDayDate(weekNumber, dayName) {
  const weekStart = getPlanWeekStartDate(weekNumber);
  const offsets = { monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:6 };
  const d = new Date(weekStart);
  d.setDate(d.getDate() + (offsets[dayName] ?? 0));
  return d;
}

function formatShortDate(d) {
  return d.toLocaleDateString('en-US', { month:'numeric', day:'numeric' });
}

const TODAY_STR = new Date().toLocaleDateString('en-CA');

const RUN_TYPE_LABELS = {
  easy:'Easy Run', tempo:'Tempo', interval:'Intervals', intervals:'Intervals',
  long_run:'Long Run', recovery:'Recovery', fartlek:'Fartlek', race:'Race',
  shakeout:'Shakeout', 'easy run':'Easy Run', 'long run':'Long Run',
  'tempo run':'Tempo', 'speed work':'Speed Work', 'hill repeat':'Hill Repeats',
  'hill repeats':'Hill Repeats', 'progression':'Progression', 'strides':'Strides',
};

function getRunLabel(runType) {
  if (!runType) return 'Run';
  const key = runType.toLowerCase().replace(/_/g,' ');
  if (RUN_TYPE_LABELS[key]) return RUN_TYPE_LABELS[key];
  const uk = runType.toLowerCase().replace(/\s+/g,'_');
  if (RUN_TYPE_LABELS[uk]) return RUN_TYPE_LABELS[uk];
  return runType.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function useInsightsCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return localStorage.getItem('bc-plan-insights-collapsed') === 'true'; } catch { return true; }
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
    try { localStorage.setItem('bc-plan-insights-collapsed','false'); } catch {}
  }
  return [collapsed, toggle, forceOpen];
}

export default function PlansPage() {
  const { user } = useAuth();
  const { refresh, workouts: allWorkouts, saveWorkout } = useWorkouts();

  const [view,               setView]               = useState('loading');
  const [generatedPlan,      setGeneratedPlan]       = useState(null);
  const [activePlan,         setActivePlan]          = useState(null);
  const [editMode,           setEditMode]            = useState(false);
  const [showAIEditor,       setShowAIEditor]        = useState(false);
  const [logTarget,          setLogTarget]           = useState(null);
  const [expandedWeeks,      setExpandedWeeks]       = useState(new Set([1,2]));
  const [activating,         setActivating]          = useState(false);
  const [reactivating,       setReactivating]        = useState(false);
  const [error,              setError]               = useState(null);
  const [insightsCollapsed, toggleInsights, openInsights] = useInsightsCollapsed();
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('bc-plan-dismissed-suggestions') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const plan = await getActivePlan(user.id);
      if (plan) { setActivePlan(plan); setView('active'); }
      else { setView('empty'); }
    }
    load();
  }, [user]);

  function toggleWeek(n) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function expandAll(plan) { setExpandedWeeks(new Set(plan.weeks.map(w => w.weekNumber))); }
  function collapseAll()   { setExpandedWeeks(new Set()); }

  function handlePlanGenerated(plan) {
    setGeneratedPlan(plan);
    setExpandedWeeks(new Set([1,2]));
    setView('preview');
    openInsights();
  }

  function updateRun(wI, rI, field, val) {
    setGeneratedPlan(prev => {
      const u = JSON.parse(JSON.stringify(prev));
      u.weeks[wI].runs[rI][field] = val;
      return u;
    });
  }
  function updateLift(wI, lI, field, val) {
    setGeneratedPlan(prev => {
      const u = JSON.parse(JSON.stringify(prev));
      u.weeks[wI].lifts[lI][field] = val;
      return u;
    });
  }
  function updateExercise(wI, lI, eI, field, val) {
    setGeneratedPlan(prev => {
      const u = JSON.parse(JSON.stringify(prev));
      u.weeks[wI].lifts[lI].exercises[eI][field] = val;
      return u;
    });
  }

  function handleAIPlanUpdate(updatedPlan) {
    if (view === 'preview') setGeneratedPlan(updatedPlan);
    else if (view === 'active') setActivePlan(prev => ({ ...prev, plan_data: updatedPlan }));
  }

  async function handleActivate() {
    if (!user || !generatedPlan) return;
    setActivating(true); setError(null);
    try {
      const saved = await savePlan(user.id, {
        name: generatedPlan.name || 'Training Plan',
        description: generatedPlan.description || '',
        plan_type: generatedPlan.plan_type || generatedPlan.planType || 'hybrid',
        plan_data: generatedPlan,
        is_active: true,
        progress: { completed:0, total:countTotalSessions(generatedPlan) },
      });
      if (!saved) throw new Error('Failed to save plan');
      const { createClient } = await import('@/lib/supabase');
      const sb = createClient();
      await sb.from('workouts').delete().eq('user_id',user.id).eq('status','planned');
      const entries = planToWorkouts(generatedPlan);
      if (entries.length > 0) await addWorkoutsBatch(user.id, entries);
      setActivePlan({ ...saved, plan_data: generatedPlan });
      setGeneratedPlan(null);
      setView('active');
      refresh?.();
    } catch(err) {
      setError('Failed to activate plan. Please try again.');
    } finally { setActivating(false); }
  }

  async function handleReactivate() {
    if (!user || !activePlan?.plan_data) return;
    setReactivating(true); setError(null);
    try {
      const { createClient } = await import('@/lib/supabase');
      const sb = createClient();
      const today = new Date().toLocaleDateString('en-CA');
      await sb.from('workouts').delete().eq('user_id',user.id).eq('status','planned').gte('date',today);
      const entries = planToWorkouts(activePlan.plan_data, today);
      if (entries.length > 0) await addWorkoutsBatch(user.id, entries);
      refresh?.(); setError(null);
    } catch(err) {
      setError('Failed to reactivate plan. Please try again.');
    } finally { setReactivating(false); }
  }

  function planToWorkouts(plan, fromDate = null) {
    const workouts = [];
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const startDow = now.getDay();
    const startDayIdx = startDow === 0 ? 6 : startDow - 1;
    function localDateStr(d) { return d.toLocaleDateString('en-CA'); }
    function dayOffsetFrom(targetDay) {
      const ti = DAY_ORDER.indexOf(targetDay);
      if (ti === -1) return -1;
      return (ti - startDayIdx + 7) % 7;
    }
    plan.weeks.forEach((week, wIdx) => {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + wIdx * 7);
      const restDays = new Set((week.restDays||[]).map(e => typeof e==='object' ? e.dayOfWeek : e));
      (week.runs||[]).forEach(run => {
        const off = dayOffsetFrom(run.dayOfWeek);
        if (off === -1 || restDays.has(run.dayOfWeek)) return;
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + off);
        const ds = localDateStr(d);
        if (fromDate && ds < fromDate) return;
        workouts.push({ date:ds, type:'run', status:'planned', details:{
          runType: run.runType||'easy', runDescription: getRunLabel(run.runType),
          plannedDistance: run.distance, targetPace: run.targetPace||'',
          duration: run.duration, notes: run.notes||'',
          weekNumber: week.weekNumber, phase: week.phase,
        }});
      });
      (week.lifts||[]).forEach(lift => {
        const off = dayOffsetFrom(lift.dayOfWeek);
        if (off === -1 || restDays.has(lift.dayOfWeek)) return;
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + off);
        const ds = localDateStr(d);
        if (fromDate && ds < fromDate) return;
        workouts.push({ date:ds, type:'lift', status:'planned', details:{
          sessionName: lift.sessionName||'Strength Session',
          muscleGroups: lift.muscleGroups||[],
          exercises: (lift.exercises||[]).map(ex=>({ name:ex.name, sets:ex.sets, reps:ex.reps, notes:ex.notes||'' })),
          duration: lift.duration, weekNumber: week.weekNumber, phase: week.phase,
        }});
      });
      (week.restDays||[]).forEach(entry => {
        const dayName = typeof entry==='object' ? entry.dayOfWeek : entry;
        const restType = typeof entry==='object' ? entry.restType : 'full_rest';
        const off = dayOffsetFrom(dayName);
        if (off === -1) return;
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + off);
        const ds = localDateStr(d);
        if (fromDate && ds < fromDate) return;
        workouts.push({ date:ds, type:'rest', status:'planned', details:{ restType, weekNumber:week.weekNumber, phase:week.phase }});
      });
    });
    return workouts;
  }

  function countTotalSessions(plan) {
    return plan.weeks.reduce((s,w) => s + (w.runs?.length||0) + (w.lifts?.length||0), 0);
  }

  // Workout status map — must be before early returns
  const workoutStatusMap = useMemo(() => {
    const map = {};
    (allWorkouts||[]).forEach(w => {
      const key = `${w.date}-${w.type}`;
      if (!map[key] || w.status==='completed') map[key] = w.status;
    });
    return map;
  }, [allWorkouts]);

  // Full workout map for detail lookup (exercises logged etc)
  const workoutDetailMap = useMemo(() => {
    const map = {};
    (allWorkouts||[]).forEach(w => {
      const key = `${w.date}-${w.type}`;
      if (!map[key] || w.status==='completed') map[key] = w;
    });
    return map;
  }, [allWorkouts]);

  function getSessionStatus(dateStr, type) {
    return workoutStatusMap[`${dateStr}-${type}`] || 'planned';
  }

  if (view === 'loading') return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="text-tertiary animate-spin"/>
    </div>
  );

  if (view === 'wizard') return (
    <PlanWizard onComplete={handlePlanGenerated} onCancel={() => setView(activePlan ? 'active' : 'empty')}/>
  );

  if (view === 'empty') return (
    <div className="bc-empty min-h-[50vh]">
      <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center mb-4">
        <Calendar size={28} className="text-bc-indigo"/>
      </div>
      <p className="bc-empty-title">No Active Plan</p>
      <p className="bc-empty-text mb-6">Generate an AI-powered training plan tailored to your goals, fitness level, and schedule.</p>
      <button onClick={() => setView('wizard')}
        className="flex items-center gap-2 px-6 py-3 bg-bc-indigo hover:opacity-90 active:scale-95 text-white text-sm font-semibold rounded-[10px] transition-all">
        <Sparkles size={16}/> Generate Your Plan
      </button>
    </div>
  );

  const displayPlan = view === 'preview' ? generatedPlan : activePlan?.plan_data;

  if (!displayPlan?.weeks) return (
    <div className="bc-empty py-12">
      <p className="bc-empty-title">No plan data available.</p>
      <button onClick={() => setView('wizard')} className="text-bc-blue text-sm mt-2 hover:underline">Generate a new plan</button>
    </div>
  );

  return (
    <div className="pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-[17px] font-semibold text-primary">{displayPlan.name || 'Training Plan'}</h2>
          {displayPlan.description && <p className="text-sm text-secondary mt-1 max-w-lg">{displayPlan.description}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="bc-caption">{displayPlan.total_weeks || displayPlan.weeks.length} weeks</span>
            <span className="bc-caption">·</span>
            <span className="bc-caption">{countTotalSessions(displayPlan)} sessions</span>
            {view === 'active' && <><span className="bc-caption">·</span><span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px]">Active</span></>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAIEditor(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] bg-bc-indigo-light text-bc-indigo hover:opacity-80 transition-colors min-h-[44px]">
            <MessageSquare size={12}/> Edit with AI
          </button>

          {view === 'preview' && (<>
            <button onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-colors min-h-[44px]
                ${editMode ? 'bg-bc-blue text-white' : 'bg-canvas border border-border text-secondary hover:text-primary'}`}>
              {editMode ? <Check size={12}/> : <Pencil size={12}/>}
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={handleActivate} disabled={activating}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bc-indigo hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-[10px] transition-all min-h-[44px]">
              {activating ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
              {activating ? 'Activating…' : 'Activate'}
            </button>
          </>)}

          {view === 'active' && (<>
            <button onClick={async () => {
              if (editMode) {
                try {
                  const { savePlan } = await import('@/lib/database');
                  await savePlan(user.id, { ...activePlan, plan_data:displayPlan, is_active:true }, activePlan.id);
                } catch(e) { console.error('Failed to save edits:', e); }
              }
              setEditMode(!editMode);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-colors min-h-[44px]
              ${editMode ? 'bg-bc-green text-white' : 'bg-canvas border border-border text-secondary hover:text-primary'}`}>
              {editMode ? <Check size={12}/> : <Pencil size={12}/>}
              {editMode ? 'Save Edits' : 'Edit Plan'}
            </button>
            <button onClick={handleReactivate} disabled={reactivating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-border text-secondary text-xs rounded-[10px] hover:text-primary transition-colors min-h-[44px] disabled:opacity-40">
              {reactivating ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
              {reactivating ? 'Syncing…' : 'Reactivate'}
            </button>
            <button onClick={() => setView('wizard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-border text-secondary text-xs rounded-[10px] hover:text-primary transition-colors min-h-[44px]">
              <Sparkles size={12}/> New Plan
            </button>
          </>)}
        </div>
      </div>

      {/* ── Expand / Collapse ── */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => expandAll(displayPlan)} className="bc-caption hover:text-secondary transition-colors min-h-[44px]">Expand all</button>
        <span className="bc-caption">·</span>
        <button onClick={collapseAll} className="bc-caption hover:text-secondary transition-colors min-h-[44px]">Collapse all</button>
      </div>

      {/* ── Schedule Suggestions ── */}
      {displayPlan.schedule_suggestions?.filter(s => !dismissedSuggestions.has(s.title)).length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-bc-orange flex-shrink-0"/>
            <span className="text-xs font-semibold text-primary">Schedule Suggestions</span>
            <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
              {displayPlan.schedule_suggestions.filter(s => !dismissedSuggestions.has(s.title)).length} items
            </span>
          </div>
          <div className="space-y-2">
            {displayPlan.schedule_suggestions.filter(s => !dismissedSuggestions.has(s.title)).map((s,idx) => {
              const border = s.severity==='warning' ? 'border-bc-red/20 bg-bc-red-light/40' :
                             s.severity==='suggestion' ? 'border-bc-orange/20 bg-bc-orange-light/40' :
                             'border-bc-blue/20 bg-bc-blue-light/40';
              return (
                <div key={idx} className={`p-3 rounded-[14px] border ${border}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-primary flex-1">{s.title}</p>
                    <button onClick={() => setDismissedSuggestions(prev => {
                      const next = new Set([...prev, s.title]);
                      try { localStorage.setItem('bc-plan-dismissed-suggestions', JSON.stringify([...next])); } catch {}
                      return next;
                    })} className="text-tertiary hover:text-secondary flex-shrink-0 min-w-[24px] min-h-[24px] flex items-center justify-center">
                      <X size={12}/>
                    </button>
                  </div>
                  <p className="text-[11px] text-secondary leading-relaxed mb-2">{s.explanation}</p>
                  {s.actionable && s.action && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-tertiary">Suggested:</span>
                      <span className="text-[10px] font-medium text-primary italic">{s.action}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Plan Insights ── */}
      {displayPlan.plan_insights?.filter(i => !i.actionable).length > 0 && (
        <div className="mb-4">
          <button onClick={toggleInsights}
            className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors mb-2 min-h-[44px]">
            <Lightbulb size={14} className="text-bc-orange"/>
            <span className="font-medium">Why your plan is built this way</span>
            <span className="text-tertiary">({displayPlan.plan_insights.filter(i=>!i.actionable).length} insights)</span>
            {insightsCollapsed ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}
          </button>
          {!insightsCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayPlan.plan_insights.filter(i=>!i.actionable).map((insight,idx) => {
                const cc = { scheduling:'border-bc-blue/20 bg-bc-blue-light/40', interference:'border-bc-red/20 bg-bc-red-light/40', periodization:'border-rest-accent/20 bg-rest-bg', recovery:'border-run-accent/20 bg-run-bg', progression:'border-cardio-accent/20 bg-cardio-bg', deload:'border-bc-indigo/20 bg-bc-indigo-light/40' };
                return (
                  <div key={idx} className={`p-3 rounded-[14px] border ${cc[insight.category]||'border-border bg-canvas'}`}>
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
          const wStart = getPlanWeekStartDate(week.weekNumber);
          const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
          const wStartStr = wStart.toLocaleDateString('en-CA');
          const isCurrentWeek = wStartStr <= TODAY_STR && TODAY_STR <= wEnd.toLocaleDateString('en-CA');

          return (
            <div key={week.weekNumber} className="bc-card-flush">
              <button onClick={() => toggleWeek(week.weekNumber)}
                className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors min-h-[44px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>Week {week.weekNumber}</span>
                  <span className={`bc-pill text-[10px] font-medium capitalize border ${phaseStyle}`}>{week.phase}</span>
                  <span className={`bc-caption ${isCurrentWeek ? 'text-bc-blue font-semibold' : ''}`}>
                    {isCurrentWeek ? 'This week · ' : ''}{formatShortDate(wStart)}–{formatShortDate(wEnd)}
                  </span>
                  <span className="bc-caption hidden sm:inline">
                    {week.totalMileage ? `· ${week.totalMileage} mi` : ''}
                    {week.runs?.length > 0 ? ` · ${week.runs.length} run${week.runs.length!==1?'s':''}` : ''}
                    {week.lifts?.length > 0 ? ` · ${week.lifts.length} lift${week.lifts.length!==1?'s':''}` : ''}
                  </span>
                  <span className="bc-caption sm:hidden">{(week.runs?.length||0)+(week.lifts?.length||0)} sessions</span>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-tertiary flex-shrink-0"/> : <ChevronDown size={14} className="text-tertiary flex-shrink-0"/>}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">

                  {/* ── Desktop: 7-col grid ── */}
                  <div className="hidden sm:block overflow-x-auto mt-3">
                    <div className="grid grid-cols-7 gap-1" style={{minWidth:560}}>
                      {DAY_ORDER.map(day => {
                        const run = week.runs?.find(r => r.dayOfWeek===day);
                        const lift = week.lifts?.find(l => l.dayOfWeek===day);
                        const restEntry = Array.isArray(week.restDays) ? week.restDays.find(r => typeof r==='object' ? r.dayOfWeek===day : r===day) : null;
                        const isRest = !!restEntry;
                        const restType = typeof restEntry==='object' ? restEntry?.restType : 'full_rest';
                        const dayDate = getPlanDayDate(week.weekNumber, day);
                        const dayStr = dayDate.toLocaleDateString('en-CA');
                        const isToday = dayStr === TODAY_STR;
                        const runStatus = run ? getSessionStatus(dayStr,'run') : null;
                        const liftStatus = lift ? getSessionStatus(dayStr,'lift') : null;
                        const allDone = (run ? runStatus==='completed':true) && (lift ? liftStatus==='completed':true) && (run||lift);
                        const anySkipped = runStatus==='skipped' || liftStatus==='skipped';
                        const headerBg = isToday ? 'bg-bc-blue' : allDone ? 'bg-bc-green-light' : anySkipped ? 'bg-bc-red-light' : 'bg-canvas';
                        return (
                          <div key={day}>
                            <div className={`text-center py-1.5 rounded-t-[8px] mb-0.5 ${headerBg}`}>
                              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday?'text-white':'text-tertiary'}`}>{DAY_SHORT[day]}</p>
                              <p className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>{dayDate.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</p>
                            </div>
                            <div className={`rounded-b-[8px] rounded-t-[2px] p-1.5 min-h-[90px] border ${
                              isRest ? 'bg-rest-bg border-rest-accent/20' :
                              run && lift ? 'bg-surface border-border' :
                              run ? 'bg-run-bg border-run-accent/20' :
                              lift ? 'bg-lift-bg border-lift-accent/20' : 'bg-canvas border-transparent'
                            }`}>
                              {isRest && <div className="flex items-center justify-center h-full min-h-[70px]"><span className="text-[9px] font-medium text-rest-accent">Rest</span></div>}
                              {run && (
                                <div className="mb-1">
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <div className="w-1 h-1 rounded-full bg-run-accent flex-shrink-0"/>
                                    <span className="text-[9px] font-semibold text-run-accent uppercase truncate">{getRunLabel(run.runType)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <p className="text-[11px] font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{run.distance} mi</p>
                                    {runStatus==='completed' && <span className="text-[8px] font-bold text-bc-green-dark">✓</span>}
                                    {runStatus==='skipped'   && <span className="text-[8px] font-bold text-bc-red">✗</span>}
                                  </div>
                                  {run.targetPace && <p className="text-[9px] text-tertiary">{run.targetPace}</p>}
                                </div>
                              )}
                              {lift && (
                                <div>
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <div className="w-1 h-1 rounded-full bg-lift-accent flex-shrink-0"/>
                                    <span className="text-[9px] font-semibold text-lift-accent truncate">{lift.sessionName||'Strength'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <p className="text-[9px] text-tertiary">{lift.exercises?.length||0} ex</p>
                                    {liftStatus==='completed' && <span className="text-[8px] font-bold text-bc-green-dark">✓</span>}
                                    {liftStatus==='skipped'   && <span className="text-[8px] font-bold text-bc-red">✗</span>}
                                  </div>
                                </div>
                              )}
                              {!isRest && !run && !lift && (
                                <div className="flex items-center justify-center min-h-[70px]">
                                  <span className="text-[9px] text-tertiary opacity-30">—</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Mobile: horizontal scroll strip ── */}
                  <div className="sm:hidden mt-3 -mx-4">
                    <div className="flex gap-2 overflow-x-auto px-4 pb-2" style={{scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
                      {DAY_ORDER.map(day => {
                        const run = week.runs?.find(r => r.dayOfWeek===day);
                        const lift = week.lifts?.find(l => l.dayOfWeek===day);
                        const restEntry = Array.isArray(week.restDays) ? week.restDays.find(r => typeof r==='object' ? r.dayOfWeek===day : r===day) : null;
                        const isRest = !!restEntry;
                        const isEmpty = !run && !lift && !isRest;
                        const dayDate = getPlanDayDate(week.weekNumber, day);
                        const dayStr = dayDate.toLocaleDateString('en-CA');
                        const isToday = dayStr === TODAY_STR;
                        const runStatus = run ? getSessionStatus(dayStr,'run') : null;
                        const liftStatus = lift ? getSessionStatus(dayStr,'lift') : null;
                        return (
                          <div key={day} className="flex-shrink-0 flex flex-col"
                            style={{width: isEmpty ? 44 : (run && lift) ? 120 : 108}}>
                            <div className={`flex flex-col items-center py-1.5 rounded-t-[10px] mb-0.5 ${isToday?'bg-bc-blue':'bg-canvas'}`}>
                              <span className={`text-[10px] font-bold uppercase ${isToday?'text-white':'text-tertiary'}`}>{DAY_SHORT[day]}</span>
                              <span className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>{dayDate.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</span>
                            </div>
                            <div className={`rounded-b-[10px] rounded-t-[2px] p-2 flex-1 border ${
                              isToday ? 'border-bc-blue/30' :
                              isRest ? 'border-rest-accent/20 bg-rest-bg' :
                              run && lift ? 'border-border bg-surface' :
                              run ? 'border-run-accent/20 bg-run-bg' :
                              lift ? 'border-lift-accent/20 bg-lift-bg' :
                              'border-transparent bg-canvas opacity-30'
                            }`} style={{minHeight:80}}>
                              {run && (
                                <div className="mb-1.5">
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <div className="w-1 h-1 rounded-full bg-run-accent flex-shrink-0"/>
                                    <span className="text-[9px] font-semibold text-run-accent uppercase truncate">{getRunLabel(run.runType)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <p className="text-[12px] font-bold text-primary leading-none" style={{fontVariantNumeric:'tabular-nums'}}>
                                      {run.distance} <span className="text-[9px] font-normal text-tertiary">mi</span>
                                    </p>
                                    {runStatus==='completed' && <span className="text-[9px] font-bold text-bc-green-dark">✓</span>}
                                    {runStatus==='skipped'   && <span className="text-[9px] text-bc-red">✗</span>}
                                  </div>
                                  {run.targetPace && <p className="text-[9px] text-tertiary mt-0.5">{run.targetPace}</p>}
                                </div>
                              )}
                              {lift && (
                                <div>
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <div className="w-1 h-1 rounded-full bg-lift-accent flex-shrink-0"/>
                                    <span className="text-[9px] font-semibold text-lift-accent truncate">{(lift.sessionName||'Lift').split(' ')[0]}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <p className="text-[9px] text-tertiary">{lift.exercises?.length||0} ex</p>
                                    {liftStatus==='completed' && <span className="text-[9px] font-bold text-bc-green-dark">✓</span>}
                                    {liftStatus==='skipped'   && <span className="text-[9px] text-bc-red">✗</span>}
                                  </div>
                                </div>
                              )}
                              {isRest && !run && !lift && <div className="flex items-center justify-center h-full"><span className="text-[9px] text-rest-accent font-medium">Rest</span></div>}
                              {isEmpty && <div className="flex items-center justify-center h-full"><span className="text-[9px] text-tertiary">—</span></div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Session detail cards — grouped by day, runs + lifts together ── */}
                  {/* Matches Schedule page quality: shows exercises, sets×reps, completion status */}
                  {!editMode && (
                    <div className="mt-4 space-y-3">
                      {/* Build day-grouped sessions */}
                      {DAY_ORDER.map(day => {
                        const run = week.runs?.find(r => r.dayOfWeek===day);
                        const lift = week.lifts?.find(l => l.dayOfWeek===day);
                        if (!run && !lift) return null;

                        const dayDate = getPlanDayDate(week.weekNumber, day);
                        const dayStr = dayDate.toLocaleDateString('en-CA');
                        const isToday = dayStr === TODAY_STR;
                        const isPast = dayStr < TODAY_STR;
                        const runStatus = run ? getSessionStatus(dayStr,'run') : null;
                        const liftStatus = lift ? getSessionStatus(dayStr,'lift') : null;

                        return (
                          <div key={day} className={`rounded-[16px] border overflow-hidden ${isToday ? 'border-bc-blue/40' : 'border-border'}`}>
                            {/* Day header */}
                            <div className={`flex items-center justify-between px-4 py-2 ${isToday ? 'bg-bc-blue' : isPast ? 'bg-canvas' : 'bg-canvas/50'}`}>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase ${isToday ? 'text-white' : 'text-primary'}`}>
                                  {DAY_SHORT[day]}
                                </span>
                                <span className={`text-[10px] ${isToday ? 'text-white/80' : 'text-tertiary'}`}>
                                  {dayDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                                </span>
                                {isToday && <span className="text-[10px] font-semibold text-white/90">· Today</span>}
                              </div>
                              {/* Day completion summary */}
                              <div className="flex items-center gap-1.5">
                                {runStatus==='completed'  && <span className="text-[10px] text-white bg-bc-green/80 px-1.5 py-0.5 rounded-full font-semibold">Run ✓</span>}
                                {runStatus==='skipped'    && <span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Run ✗</span>}
                                {liftStatus==='completed' && <span className="text-[10px] text-white bg-bc-blue/80 px-1.5 py-0.5 rounded-full font-semibold">Lift ✓</span>}
                                {liftStatus==='skipped'   && <span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Lift ✗</span>}
                              </div>
                            </div>

                            {/* Run session */}
                            {run && (
                              <div className={`px-4 py-3 ${lift ? 'border-b border-border/50' : ''} ${runStatus==='completed' ? 'bg-bc-green-light/30' : runStatus==='skipped' ? 'opacity-50' : 'bg-run-bg/30'}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 self-stretch rounded-full bg-run-accent flex-shrink-0 min-h-[16px]"/>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-run-accent">{getRunLabel(run.runType)}</span>
                                  </div>
                                  <button onClick={() => setLogTarget({ type:'run', status: runStatus==='completed'?'completed':'planned', date:dayStr, details:{ runType:run.runType, plannedDistance:run.distance, targetPace:run.targetPace||'', duration:run.duration, notes:run.notes||'', weekNumber:week.weekNumber, phase:week.phase } })}
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${
                                      runStatus==='completed' ? 'bg-bc-green-light text-bc-green-dark' :
                                      runStatus==='skipped'   ? 'bg-bc-red-light text-bc-red-dark' :
                                      'bg-bc-blue text-white'
                                    }`}>
                                    {runStatus==='completed' ? '✓ Done' : runStatus==='skipped' ? '✗ Skipped' : 'Log It'}
                                  </button>
                                </div>
                                <div className="flex items-center gap-3 pl-3">
                                  <span className="text-base font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{run.distance} <span className="text-xs font-normal text-tertiary">mi</span></span>
                                  {run.targetPace && <span className="text-[10px] text-secondary">@ {run.targetPace}/mi</span>}
                                  {run.duration && <span className="text-[10px] text-tertiary">{run.duration} min</span>}
                                </div>
                                {run.notes && <p className="text-[10px] text-secondary italic mt-1 pl-3">{run.notes}</p>}
                              </div>
                            )}

                            {/* Lift session */}
                            {lift && (
                              <div className={`px-4 py-3 ${liftStatus==='completed' ? 'bg-bc-blue-light/20' : liftStatus==='skipped' ? 'opacity-50' : 'bg-lift-bg/30'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 self-stretch rounded-full bg-lift-accent flex-shrink-0 min-h-[16px]"/>
                                    <div>
                                      <span className="text-xs font-bold text-lift-accent">{lift.sessionName}</span>
                                      {lift.duration && <span className="text-[10px] text-tertiary ml-2">{lift.duration} min</span>}
                                    </div>
                                  </div>
                                  <button onClick={() => setLogTarget({ type:'lift', status: liftStatus==='completed'?'completed':'planned', date:dayStr, details:{ sessionName:lift.sessionName, muscleGroups:lift.muscleGroups||[], exercises:(lift.exercises||[]).map(ex=>({name:ex.name, sets:ex.sets, reps:ex.reps})), duration:lift.duration, weekNumber:week.weekNumber, phase:week.phase } })}
                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${
                                      liftStatus==='completed' ? 'bg-bc-green-light text-bc-green-dark' :
                                      liftStatus==='skipped'   ? 'bg-bc-red-light text-bc-red-dark' :
                                      'bg-bc-blue text-white'
                                    }`}>
                                    {liftStatus==='completed' ? '✓ Done' : liftStatus==='skipped' ? '✗ Skipped' : 'Log It'}
                                  </button>
                                </div>
                                {/* Exercises */}
                                {lift.exercises?.length > 0 && (
                                  <div className="pl-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {lift.exercises.map((ex,eI) => {
                                      const setsNum = Array.isArray(ex.sets) ? ex.sets.length : ex.sets;
                                      const repsVal = Array.isArray(ex.sets) ? (ex.sets[0]?.reps ?? ex.sets[0]?.targetReps ?? ex.reps) : ex.reps;
                                      return (
                                        <div key={eI} className="flex items-center justify-between gap-2 px-2 py-1 bg-white/50 rounded-[8px]">
                                          <span className="text-[11px] text-primary truncate flex-1">{ex.name}</span>
                                          {setsNum && repsVal && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-lift-bg rounded-full border border-lift-accent/20">
                                              <span className="text-[11px] font-bold text-lift-accent" style={{fontVariantNumeric:'tabular-nums'}}>{setsNum}×{repsVal}</span>
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {lift.muscleGroups?.length > 0 && (
                                  <div className="pl-3 flex gap-1 mt-1.5 flex-wrap">
                                    {lift.muscleGroups.slice(0,3).map(mg => (
                                      <span key={mg} className="text-[9px] px-1.5 py-0.5 bg-lift-bg border border-lift-accent/20 rounded-full text-lift-accent">{mg}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Edit mode — desktop only */}
                  {editMode && (
                    <div className="hidden sm:block mt-4 space-y-3">
                      {week.lifts?.map((lift,lI) => (
                        <div key={`edit-lift-${lI}`} className="p-3 bg-lift-bg rounded-[14px] border border-lift-accent/20">
                          <p className="text-xs font-medium text-lift-accent mb-2">{DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}</p>
                          <div className="space-y-2">
                            {lift.exercises?.map((ex,eI) => (
                              <div key={eI} className="flex items-center gap-2">
                                <input type="text" value={ex.name} onChange={e => updateExercise(weekIdx,lI,eI,'name',e.target.value)} className="bc-input !py-1 !px-2 !text-[10px] flex-1"/>
                                <input type="number" value={ex.sets} onChange={e => updateExercise(weekIdx,lI,eI,'sets',Number(e.target.value))} className="bc-input bc-data !py-1 !px-2 !text-[10px] w-12 text-center"/>
                                <span className="text-[10px] text-tertiary">×</span>
                                <input type="text" value={ex.reps} onChange={e => updateExercise(weekIdx,lI,eI,'reps',e.target.value)} className="bc-input bc-data !py-1 !px-2 !text-[10px] w-16 text-center"/>
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
      {showAIEditor && <PlanEditor plan={displayPlan} onPlanUpdate={handleAIPlanUpdate} onClose={() => setShowAIEditor(false)}/>}

      {/* ── Log form ── */}
      {logTarget && (
        <LogForm
          workout={logTarget}
          onSave={w => { saveWorkout(w); refresh?.(); setLogTarget(null); }}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}