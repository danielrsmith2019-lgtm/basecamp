'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { savePlan, getActivePlan, addWorkoutsBatch } from '@/lib/database';
import { updateUserSettings } from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import PlanWizard from '@/components/shared/PlanWizard';
import PlanImportWizard from '@/components/shared/PlanImportWizard';
import PlanEditor from '@/components/shared/PlanEditor';
import LogForm from '@/components/shared/LogForm';
import DayTimeline from '@/components/shared/DayTimeline';
import CalendarView from '@/components/shared/CalendarView';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import {
  Sparkles, Play, Pencil, X, Check, ChevronDown, ChevronUp,
  Calendar, Loader2, Lightbulb, MessageSquare, AlertTriangle,
} from 'lucide-react';

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_SHORT = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' };
const DAY_FROM_JS = {0:'sunday',1:'monday',2:'tuesday',3:'wednesday',4:'thursday',5:'friday',6:'saturday'};

const PHASE_COLORS = {
  base:'text-run-accent bg-run-bg border-run-accent/20',
  foundation:'text-run-accent bg-run-bg border-run-accent/20',
  build:'text-lift-accent bg-lift-bg border-lift-accent/20',
  development:'text-lift-accent bg-lift-bg border-lift-accent/20',
  peak:'text-rest-accent bg-rest-bg border-rest-accent/20',
  performance:'text-rest-accent bg-rest-bg border-rest-accent/20',
  taper:'text-cardio-accent bg-cardio-bg border-cardio-accent/20',
  deload:'text-bc-indigo-dark bg-bc-indigo-light border-bc-indigo/20',
};

function fmtShort(d) { return d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'}); }
const TODAY_STR = new Date().toLocaleDateString('en-CA');

const RUN_LABELS = {
  easy:'Easy Run',tempo:'Tempo',interval:'Intervals',intervals:'Intervals',
  long_run:'Long Run',recovery:'Recovery',fartlek:'Fartlek',race:'Race',shakeout:'Shakeout',
  'easy run':'Easy Run','long run':'Long Run','tempo run':'Tempo','speed work':'Speed Work',
  'hill repeat':'Hill Repeats','hill repeats':'Hill Repeats','progression':'Progression','strides':'Strides',
};
function getRunLabel(rt) {
  if (!rt) return 'Run';
  const k = rt.toLowerCase().replace(/_/g,' ');
  if (RUN_LABELS[k]) return RUN_LABELS[k];
  return rt.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function useInsightsCollapsed() {
  const [c, setC] = useState(() => {
    if (typeof window==='undefined') return true;
    try { return localStorage.getItem('bc-plan-insights-collapsed')==='true'; } catch { return true; }
  });
  const toggle = () => setC(p => { const n=!p; try{localStorage.setItem('bc-plan-insights-collapsed',String(n));}catch{} return n; });
  const open   = () => { setC(false); try{localStorage.setItem('bc-plan-insights-collapsed','false');}catch{} };
  return [c, toggle, open];
}

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { refresh, workouts: allWorkouts, saveWorkout, rescheduleWorkout, isLoaded } = useWorkouts();

  const [view,           setView]           = useState('loading');
  const [generatedPlan,  setGeneratedPlan]  = useState(null);
  const [activePlan,     setActivePlan]     = useState(null);
  const [editMode,       setEditMode]       = useState(false);
  const [savingEdits,    setSavingEdits]    = useState(false);
  const [editingSession, setEditingSession] = useState(null); // { workoutId, field, value }
  const [showAIEditor,   setShowAIEditor]   = useState(false);
  const [logTarget,      setLogTarget]      = useState(null);
  const [expandedWeeks,  setExpandedWeeks]  = useState(() => new Set([1, 2]));
  const [activating,     setActivating]     = useState(false);
  const [reactivating,   setReactivating]   = useState(false);
  const [error,          setError]          = useState(null);
  const [planMenuOpen,   setPlanMenuOpen]   = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [pastWeeksOpen,  setPastWeeksOpen]  = useState(false);
  const [selectedWorkout,setSelectedWorkout]= useState(null);
  const [showNewLogForm, setShowNewLogForm] = useState(false);
  const [insightsCollapsed, toggleInsights, openInsights] = useInsightsCollapsed();
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    if (typeof window==='undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('bc-plan-dismissed-suggestions')||'[]')); }
    catch { return new Set(); }
  });

  // History state
  const [historyMode, setHistoryMode] = useState('list');
  const [showPast,    setShowPast]    = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const plan = await getActivePlan(user.id);
      if (plan) { setActivePlan(plan); setView('active'); }
      else { setView('empty'); }
    }
    load();
  }, [user]);

  // Save an inline edit to a planned workout row
  async function saveSessionEdit(workoutId, detailUpdates) {
    const existing = allWorkouts.find(w => w.id === workoutId);
    if (!existing) return;
    setSavingEdits(true);
    try {
      await saveWorkout({
        ...existing,
        details: { ...existing.details, ...detailUpdates },
      });
    } finally {
      setSavingEdits(false);
      setEditingSession(null);
    }
  }

  // Reschedule a planned session to a new date.
  // If the old date becomes empty after the move, add a rest row there.
  async function rescheduleSession(workoutId, oldDate, newDate) {
    if (oldDate === newDate) return;
    setSavingEdits(true);
    try {
      // Move the workout
      const success = await rescheduleWorkout(workoutId, newDate);
      if (!success) return;

      // Check if old date is now empty (no other sessions)
      // Give context a moment to update, then check
      await new Promise(r => setTimeout(r, 100));
      const remaining = allWorkouts.filter(w =>
        w.date === oldDate && w.id !== workoutId && w.type !== 'rest'
      );
      if (remaining.length === 0) {
        // Find weekNumber/phase from the moved workout
        const moved = allWorkouts.find(w => w.id === workoutId);
        const wn = moved?.details?.weekNumber;
        const ph = moved?.details?.phase;
        // Add a rest row on the now-empty day
        await saveWorkout({
          date: oldDate, type: 'rest', status: 'planned',
          details: { restType:'full_rest', weekNumber:wn, phase:ph },
        });
      }
      refresh?.();
    } finally {
      setSavingEdits(false);
    }
  }

  function toggleWeek(n) { setExpandedWeeks(p => { const s=new Set(p); s.has(n)?s.delete(n):s.add(n); return s; }); }
  function expandAll(plan) { setExpandedWeeks(new Set(plan.weeks.map(w=>w.weekNumber))); }
  function collapseAll() { setExpandedWeeks(new Set()); }
  function handlePlanGenerated(plan) { setGeneratedPlan(plan); setExpandedWeeks(new Set([1,2])); setView('preview'); openInsights(); }

  function handleAIPlanUpdate(plan) {
    if (view==='preview') setGeneratedPlan(plan);
    else setActivePlan(p=>({...p, plan_data:plan}));
  }

  async function handleActivate() {
    if (!user||!generatedPlan) return;
    setActivating(true); setError(null);
    try {
      const saved = await savePlan(user.id,{
        name:generatedPlan.name||'Training Plan', description:generatedPlan.description||'',
        plan_type:generatedPlan.plan_type||generatedPlan.planType||'hybrid',
        plan_data:generatedPlan, is_active:true,
        progress:{completed:0,total:countSessions(generatedPlan)},
      });
      if (!saved) throw new Error('Failed');
      const { createClient } = await import('@/lib/supabase');
      const sb = createClient();
      await sb.from('workouts').delete().eq('user_id',user.id).eq('status','planned');
      const entries = planToWorkouts(generatedPlan);
      if (!entries.length) {
        console.warn('planToWorkouts returned 0 entries', generatedPlan);
        throw new Error('Plan generated no sessions — check your inputs and try again.');
      }
      await addWorkoutsBatch(user.id, entries);
      setActivePlan({...saved,plan_data:generatedPlan}); setGeneratedPlan(null); setView('active'); refresh?.();

      // ── Auto-save race goal to user_settings so Goals page populates ──
      // Find any race run in the plan and extract its date + metadata
      try {
        const raceRun = entries.find(e => e.type === 'run' && e.details?.isRaceDay);
        if (raceRun && user) {
          await updateUserSettings(user.id, {
            race_date:      raceRun.date,
            race_name:      raceRun.details.raceName || generatedPlan.raceName || generatedPlan.name || 'Race',
            race_distance:  generatedPlan.raceDistance || generatedPlan.race_distance || 'marathon',
            race_goal_time: generatedPlan.goalTime || generatedPlan.goal_time || raceRun.details.goalTime || '',
          });
        }
      } catch (e) { console.error('Failed to save race goal:', e); }

    } catch (err) {
      console.error('Activation error:', err);
      setError(err.message || 'Failed to activate plan. Please try again.');
    } finally { setActivating(false); }
  }

  async function handleReactivate() {
    if (!user||!activePlan?.plan_data) return;
    setReactivating(true); setError(null);
    try {
      const { createClient } = await import('@/lib/supabase');
      const sb = createClient();
      const today = new Date().toLocaleDateString('en-CA');
      await sb.from('workouts').delete().eq('user_id',user.id).eq('status','planned').gte('date',today);
      const entries = planToWorkouts(activePlan.plan_data, today);
      if (entries.length) await addWorkoutsBatch(user.id, entries);
      refresh?.(); setError(null);
    } catch { setError('Failed to reactivate plan. Please try again.'); }
    finally { setReactivating(false); }
  }

  function planToWorkouts(plan, fromDate=null) {
    if (!plan?.weeks?.length) return [];
    const out=[], now=new Date();
    const startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0);
    const sdow=now.getDay(), sIdx=sdow===0?6:sdow-1;
    const lds=d=>d.toLocaleDateString('en-CA');
    const dayOff=t=>{const ti=DAY_ORDER.indexOf(t);if(ti===-1)return -1;return(ti-sIdx+7)%7;};
    plan.weeks.forEach((week,wIdx)=>{
      const ws=new Date(startDate); ws.setDate(startDate.getDate()+wIdx*7);
      const rest=new Set((week.restDays||[]).map(e=>typeof e==='object'?e.dayOfWeek:e));
      (week.runs||[]).forEach(run=>{
        const isRace = (run.runType||'').toLowerCase() === 'race';
        // Race days are never blocked by rest days — they take priority
        const off=dayOff(run.dayOfWeek); if(off===-1) return;
        if(!isRace && rest.has(run.dayOfWeek)) return;
        const d=new Date(ws);d.setDate(ws.getDate()+off);const ds=lds(d);
        if(fromDate&&ds<fromDate)return;
        out.push({date:ds,type:'run',status:'planned',details:{
          runType:run.runType||'easy',runDescription:getRunLabel(run.runType),
          plannedDistance:run.distance,targetPace:run.targetPace||'',
          duration:run.duration,notes:run.notes||run.description||'',
          weekNumber:week.weekNumber,phase:week.phase,dayOfWeek:run.dayOfWeek,
          isRaceDay: isRace,
          goalTime: run.goalTime||null,
          raceName: run.raceName||plan.raceName||null,
        }});
      });
      (week.lifts||[]).forEach(lift=>{
        const off=dayOff(lift.dayOfWeek); if(off===-1||rest.has(lift.dayOfWeek))return;
        const d=new Date(ws);d.setDate(ws.getDate()+off);const ds=lds(d);
        if(fromDate&&ds<fromDate)return;
        out.push({date:ds,type:'lift',status:'planned',details:{
          sessionName:lift.sessionName||'Strength Session',muscleGroups:lift.muscleGroups||[],
          exercises:(lift.exercises||[]).map(ex=>({name:ex.name,sets:ex.sets,reps:ex.reps,notes:ex.notes||''})),
          duration:lift.duration,weekNumber:week.weekNumber,phase:week.phase,dayOfWeek:lift.dayOfWeek,
        }});
      });
      (week.restDays||[]).forEach(entry=>{
        const dayName=typeof entry==='object'?entry.dayOfWeek:entry;
        const restType=typeof entry==='object'?entry.restType:'full_rest';
        const off=dayOff(dayName); if(off===-1)return;
        const d=new Date(ws);d.setDate(ws.getDate()+off);const ds=lds(d);
        if(fromDate&&ds<fromDate)return;
        out.push({date:ds,type:'rest',status:'planned',details:{restType,weekNumber:week.weekNumber,phase:week.phase}});
      });
    });
    return out;
  }

  function countSessions(plan) {
    return plan.weeks.reduce((s,w)=>s+(w.runs?.length||0)+(w.lifts?.length||0),0);
  }

  // ══════════════════════════════════════════════════════════
  // SINGLE SOURCE OF TRUTH: workout rows keyed by weekNumber
  //
  // This is the core of the refactor. Instead of reading session
  // placement from plan_data JSON, we build a map from the actual
  // workouts DB rows. The plan JSON provides phase/metadata only.
  //
  // weekWorkoutMap: { weekNumber → { dateStr → [workout, ...] } }
  // This means: if a run moved from Saturday to Friday in the DB,
  // it shows on Friday in the grid automatically — no JSON update needed.
  // ══════════════════════════════════════════════════════════
  const weekWorkoutMap = useMemo(() => {
    const map = {};
    (allWorkouts || []).forEach(w => {
      const wn = w.details?.weekNumber;
      if (!wn) return;
      if (!map[wn]) map[wn] = {};
      if (!map[wn][w.date]) map[wn][w.date] = [];
      map[wn][w.date].push(w);
    });
    return map;
  }, [allWorkouts]);

  // Plan start date: earliest week-1 workout date
  const planStartDate = useMemo(() => {
    if (view === 'preview') return new Date().toLocaleDateString('en-CA');
    const week1 = (allWorkouts||[])
      .filter(w => w.details?.weekNumber === 1)
      .sort((a,b) => a.date.localeCompare(b.date));
    if (week1.length > 0) return week1[0].date;
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate()+(dow===0?-6:1-dow), 12,0,0);
    return mon.toLocaleDateString('en-CA');
  }, [allWorkouts, view]);

  // Week start date helper — anchored to planStartDate
  function getWeekStartDate(weekNumber) {
    const base = new Date(planStartDate + 'T12:00:00');
    const result = new Date(base);
    result.setDate(base.getDate() + (weekNumber - 1) * 7);
    return result;
  }

  // Get all dates in a given week number (Mon–Sun)
  function getWeekDates(weekNumber) {
    const start = getWeekStartDate(weekNumber);
    return Array.from({length:7}, (_,i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d.toLocaleDateString('en-CA');
    });
  }

  // Auto-expand current week
  useEffect(() => {
    if (!activePlan?.plan_data?.weeks || view !== 'active' || !planStartDate) return;
    const base = new Date(planStartDate + 'T12:00:00');
    const todayDate = new Date(TODAY_STR + 'T12:00:00');
    const diffDays = Math.floor((todayDate - base) / (1000*60*60*24));
    const currentWeekNum = Math.max(1, Math.ceil((diffDays + 1) / 7));
    setExpandedWeeks(prev => { const next=new Set(prev); next.add(currentWeekNum); return next; });
    setTimeout(() => {
      const el = document.getElementById(`week-${currentWeekNum}`);
      if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 200);
  }, [planStartDate, view, activePlan?.plan_data]);

  // History data for calendar
  const { pastDates, weekGroups } = useMemo(() => {
    const map={};
    [...allWorkouts].sort((a,b)=>a.date.localeCompare(b.date)).forEach(w=>{
      if(!map[w.date])map[w.date]=[];map[w.date].push(w);
    });
    const all=Object.entries(map);
    const past=all.filter(([d])=>d<TODAY_STR);
    const upcoming=all.filter(([d])=>d>=TODAY_STR);
    const wm={};
    upcoming.forEach(([date,dw])=>{
      const d=new Date(date+'T12:00:00'),dow=d.getDay();
      const mon=new Date(d);mon.setDate(d.getDate()-(dow===0?6:dow-1));
      const key=mon.toLocaleDateString('en-CA');
      if(!wm[key])wm[key]={monday:mon,days:[]};
      wm[key].days.push([date,dw]);
    });
    const wg=Object.entries(wm).sort(([a],[b])=>a.localeCompare(b)).map(([key,{monday,days}])=>{
      const sun=new Date(monday);sun.setDate(monday.getDate()+6);
      const pc={};days.forEach(([,dw])=>dw.forEach(w=>{const p=w.details?.phase;if(p)pc[p]=(pc[p]||0)+1;}));
      const phase=Object.keys(pc).sort((a,b)=>pc[b]-pc[a])[0]||null;
      const weekNumber=days[0]?.[1]?.[0]?.details?.weekNumber||null;
      const isCurrent=monday.toLocaleDateString('en-CA')<=TODAY_STR&&TODAY_STR<=sun.toLocaleDateString('en-CA');
      const label=monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'–'+sun.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      return {key,monday,days,phase,weekNumber,isCurrent,label};
    });
    return {pastDates:past,weekGroups:wg};
  },[allWorkouts]);

  // ── Loading / Wizard / Empty ──
  if (view==='loading') return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="text-tertiary animate-spin"/>
    </div>
  );
  if (view==='wizard') return (
    <PlanWizard onComplete={handlePlanGenerated} onCancel={()=>setView(activePlan?'active':'empty')}/>
  );
  if (view==='empty') return (
    <div className="pb-10">
      <div className="bc-empty min-h-[50vh]">
        <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center mb-4">
          <Calendar size={28} className="text-bc-indigo"/>
        </div>
        <p className="bc-empty-title">No Active Plan</p>
        <p className="bc-empty-text mb-6">Generate an AI-powered training plan tailored to your goals, fitness level, and schedule.</p>
        <button onClick={()=>setView('wizard')}
          className="flex items-center gap-2 px-6 py-3 bg-bc-indigo hover:opacity-90 active:scale-95 text-white text-sm font-semibold rounded-[10px] transition-all">
          <Sparkles size={16}/> Generate Your Plan
        </button>
        <button onClick={()=>setShowImportWizard(true)}
          className="flex items-center gap-2 px-6 py-3 border border-border text-secondary text-sm font-semibold rounded-[10px] hover:bg-canvas hover:text-primary transition-all">
          Import existing plan
        </button>
      </div>
      {showImportWizard && (
        <PlanImportWizard
          onComplete={() => { setShowImportWizard(false); setView('active'); location.reload(); }}
          onClose={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );

  const displayPlan = view==='preview' ? generatedPlan : activePlan?.plan_data;
  if (!displayPlan?.weeks) return (
    <div className="bc-empty py-12">
      <p className="bc-empty-title">No plan data available.</p>
      <button onClick={()=>setView('wizard')} className="text-bc-blue text-sm mt-2 hover:underline">Generate a new plan</button>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // renderWeekRow — now reads session placement from DB rows,
  // not from plan_data JSON. Plan JSON only provides metadata.
  // ══════════════════════════════════════════════════════════
  function renderWeekRow(week, wIdx, isPastSection) {
    const isExpanded = expandedWeeks.has(week.weekNumber);
    const ps = PHASE_COLORS[week.phase] || PHASE_COLORS.base;
    const wStart = getWeekStartDate(week.weekNumber);
    const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
    const wStartStr = wStart.toLocaleDateString('en-CA');
    const isCurWk = wStartStr <= TODAY_STR && TODAY_STR <= wEnd.toLocaleDateString('en-CA');

    // ── DB rows for this week ──
    // This is the single source of truth for what's scheduled when.
    // weekDates: all 7 dates in this week (Mon–Sun)
    const weekDates = getWeekDates(week.weekNumber);
    const weekDbRows = weekWorkoutMap[week.weekNumber] || {};

    // For preview mode (plan not yet activated), fall back to plan JSON dates
    // so the grid still renders something before activation
    const isPreview = view === 'preview';

    // Build a per-date map of sessions for this week
    // Each date has: { run: workout|null, lift: workout|null, rest: workout|null }
    const dateSessionMap = {};
    weekDates.forEach(dateStr => {
      const rows = weekDbRows[dateStr] || [];
      dateSessionMap[dateStr] = {
        run:  rows.find(w => w.type === 'run')  || null,
        lift: rows.find(w => w.type === 'lift') || null,
        rest: rows.find(w => w.type === 'rest') || null,
        date: dateStr,
      };
    });

    // For preview mode: derive sessions from plan JSON using computed dates
    if (isPreview) {
      const base = new Date(planStartDate + 'T12:00:00');
      week.runs?.forEach(run => {
        const off = {monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:6}[run.dayOfWeek] ?? 0;
        const d = new Date(base); d.setDate(base.getDate() + (week.weekNumber-1)*7 + off);
        const ds = d.toLocaleDateString('en-CA');
        if (!dateSessionMap[ds]) dateSessionMap[ds] = {run:null,lift:null,rest:null,date:ds};
        dateSessionMap[ds].run = {
          id: null, date: ds, type: 'run', status: 'planned',
          details: { runType:run.runType, plannedDistance:run.distance, targetPace:run.targetPace||'',
                     duration:run.duration, notes:run.notes||'', weekNumber:week.weekNumber, phase:week.phase, dayOfWeek:run.dayOfWeek }
        };
      });
      week.lifts?.forEach(lift => {
        const off = {monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:6}[lift.dayOfWeek] ?? 0;
        const d = new Date(base); d.setDate(base.getDate() + (week.weekNumber-1)*7 + off);
        const ds = d.toLocaleDateString('en-CA');
        if (!dateSessionMap[ds]) dateSessionMap[ds] = {run:null,lift:null,rest:null,date:ds};
        dateSessionMap[ds].lift = {
          id: null, date: ds, type: 'lift', status: 'planned',
          details: { sessionName:lift.sessionName, muscleGroups:lift.muscleGroups||[],
                     exercises:lift.exercises||[], duration:lift.duration,
                     weekNumber:week.weekNumber, phase:week.phase, dayOfWeek:lift.dayOfWeek }
        };
      });
    }

    // Session count from DB (not JSON) for the week header
    const dbRunCount  = weekDates.filter(ds => dateSessionMap[ds]?.run).length;
    const dbLiftCount = weekDates.filter(ds => dateSessionMap[ds]?.lift).length;
    const dbTotalMiles = weekDates.reduce((s,ds) => {
      const r = dateSessionMap[ds]?.run;
      return s + (r?.details?.plannedDistance || 0);
    }, 0);

    // Completion summary for week header
    const weekCompletedRuns  = weekDates.filter(ds => dateSessionMap[ds]?.run?.status === 'completed').length;
    const weekCompletedLifts = weekDates.filter(ds => dateSessionMap[ds]?.lift?.status === 'completed').length;

    return (
      <div key={week.weekNumber} className="bc-card-flush" id={`week-${week.weekNumber}`}>
        <button onClick={() => toggleWeek(week.weekNumber)}
          className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors min-h-[44px]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>Week {week.weekNumber}</span>
            <span className={`bc-pill text-[10px] font-medium capitalize border ${ps}`}>{week.phase}</span>
            {isPreview && week.weekNumber === 1 && (
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px] border border-bc-orange/20">Preview — not yet active</span>
            )}
            <span className={`bc-caption ${isCurWk ? 'text-bc-blue font-semibold' : ''}`}>
              {isCurWk ? 'This week · ' : ''}{fmtShort(wStart)}–{fmtShort(wEnd)}
            </span>
            <span className="bc-caption hidden sm:inline">
              {dbTotalMiles > 0 ? `· ${dbTotalMiles.toFixed(1)} mi` : ''}
              {dbRunCount > 0 ? ` · ${dbRunCount} run${dbRunCount !== 1 ? 's' : ''}` : ''}
              {dbLiftCount > 0 ? ` · ${dbLiftCount} lift${dbLiftCount !== 1 ? 's' : ''}` : ''}
            </span>
            <span className="bc-caption sm:hidden">{dbRunCount + dbLiftCount} sessions</span>
          </div>
          {isExpanded
            ? <ChevronUp size={14} className="text-tertiary flex-shrink-0"/>
            : <ChevronDown size={14} className="text-tertiary flex-shrink-0"/>}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-border">

            {/* ── Desktop 7-col grid — reads from DB rows ── */}
            <div className="hidden sm:block overflow-x-auto mt-3">
              <div className="grid grid-cols-7 gap-1" style={{minWidth:560}}>
                {weekDates.map((dateStr, dayIdx) => {
                  const sessions = dateSessionMap[dateStr] || {};
                  const run  = sessions.run;
                  const lift = sessions.lift;
                  const rest = sessions.rest;
                  const isRest = !!rest && !run && !lift;
                  const isEmpty = !run && !lift && !rest;
                  const d = new Date(dateStr + 'T12:00:00');
                  const dayName = DAY_FROM_JS[d.getDay()];
                  const isToday = dateStr === TODAY_STR;
                  const rs = run?.status || null;
                  const ls = lift?.status || null;
                  const allDone = (run ? rs==='completed':true) && (lift ? ls==='completed':true) && (run||lift);
                  const anySkip = rs==='skipped' || ls==='skipped';
                  const hBg = isToday ? 'bg-bc-blue' : allDone ? 'bg-bc-green-light' : anySkip ? 'bg-bc-red-light' : 'bg-canvas';

                  return (
                    <div key={dateStr}>
                      <div className={`text-center py-1.5 rounded-t-[8px] mb-0.5 ${hBg}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday?'text-white':'text-tertiary'}`}>
                          {DAY_SHORT[dayName] || d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,3)}
                        </p>
                        <p className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>
                          {d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}
                        </p>
                      </div>
                      <div className={`rounded-b-[8px] p-1.5 min-h-[90px] border ${
                        isRest ? 'bg-rest-bg border-rest-accent/20' :
                        run && lift ? 'bg-surface border-border' :
                        run ? 'bg-run-bg border-run-accent/20' :
                        lift ? 'bg-lift-bg border-lift-accent/20' :
                        'bg-canvas border-transparent'
                      }`}>
                        {isRest && <div className="flex items-center justify-center h-full min-h-[70px]"><span className="text-[9px] font-medium text-rest-accent">Rest</span></div>}
                        {run && (
                          <div className={`mb-1 ${run.details?.isRaceDay ? 'rounded-[6px] p-0.5' : ''}`}
                            style={{
                              ...(run.details?.isRaceDay ? {background:'#FFF0F0',border:'1px solid #FF3B3040'} : {}),
                              cursor:rs==='completed'||rs==='skipped'?'pointer':'default'
                            }}
                            onClick={rs==='completed'||rs==='skipped' ? ()=>setSelectedWorkout(run) : undefined}>
                            <div className="flex items-center gap-0.5 mb-0.5">
                              {run.details?.isRaceDay
                                ? <span className="text-[9px]">🏁</span>
                                : <div className="w-1 h-1 rounded-full bg-run-accent"/>}
                              <span className={`text-[9px] font-bold uppercase truncate ${run.details?.isRaceDay ? 'text-bc-red' : 'text-run-accent'}`}>
                                {run.details?.isRaceDay ? 'Race Day' : getRunLabel(run.details?.runType)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className={`text-[11px] font-bold ${run.details?.isRaceDay ? 'text-bc-red' : 'text-primary'}`} style={{fontVariantNumeric:'tabular-nums'}}>
                                {run.details?.isRaceDay && run.details?.raceName
                                  ? run.details.raceName
                                  : `${run.details?.plannedDistance} mi`}
                              </p>
                              {rs==='completed' && <span className="text-[8px] font-bold text-bc-green-dark">✓</span>}
                              {rs==='skipped'   && <span className="text-[8px] font-bold text-bc-red">✗</span>}
                            </div>
                            {run.details?.goalTime && <p className="text-[9px] text-bc-red-dark">Goal: {run.details.goalTime}</p>}
                            {!run.details?.isRaceDay && run.details?.targetPace && <p className="text-[9px] text-tertiary">{run.details.targetPace}</p>}
                          </div>
                        )}
                        {lift && (
                          <div
                            onClick={ls==='completed'||ls==='skipped' ? ()=>setSelectedWorkout(lift) : undefined}
                            style={{cursor:ls==='completed'||ls==='skipped'?'pointer':'default'}}>
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <div className="w-1 h-1 rounded-full bg-lift-accent"/>
                              <span className="text-[9px] font-semibold text-lift-accent truncate">
                                {lift.details?.sessionName || 'Strength'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[9px] text-tertiary">{lift.details?.exercises?.length||0} ex</p>
                              {ls==='completed' && <span className="text-[8px] font-bold text-bc-green-dark">✓</span>}
                              {ls==='skipped'   && <span className="text-[8px] font-bold text-bc-red">✗</span>}
                            </div>
                          </div>
                        )}
                        {isEmpty && <div className="flex items-center justify-center min-h-[70px]"><span className="text-[9px] text-tertiary opacity-30">—</span></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile scroll strip — reads from DB rows ── */}
            <div className="sm:hidden mt-3 -mx-4">
              <div className="flex gap-2 overflow-x-auto px-4 pb-2"
                style={{scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
                {weekDates.map((dateStr, dayIdx) => {
                  const sessions = dateSessionMap[dateStr] || {};
                  const run  = sessions.run;
                  const lift = sessions.lift;
                  const rest = sessions.rest;
                  const isRest = !!rest && !run && !lift;
                  const isEmpty = !run && !lift && !rest;
                  const d = new Date(dateStr + 'T12:00:00');
                  const dayName = DAY_FROM_JS[d.getDay()];
                  const isToday = dateStr === TODAY_STR;
                  const rs = run?.status || null;
                  const ls = lift?.status || null;
                  const cellWidth = isEmpty ? 44 : (run && lift) ? 120 : 108;

                  return (
                    <div key={dateStr} className="flex-shrink-0 flex flex-col"
                      style={{width: cellWidth}}>
                      <div className={`flex flex-col items-center py-1.5 rounded-t-[10px] mb-0.5 ${isToday?'bg-bc-blue':'bg-canvas'}`}>
                        <span className={`text-[10px] font-bold uppercase ${isToday?'text-white':'text-tertiary'}`}>
                          {DAY_SHORT[dayName] || d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,3)}
                        </span>
                        <span className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>
                          {d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}
                        </span>
                      </div>
                      <div className={`rounded-b-[10px] p-2 flex-1 border ${
                        isToday ? 'border-bc-blue/30' :
                        isRest ? 'border-rest-accent/20 bg-rest-bg' :
                        run && lift ? 'border-border bg-surface' :
                        run ? 'border-run-accent/20 bg-run-bg' :
                        lift ? 'border-lift-accent/20 bg-lift-bg' :
                        'border-transparent bg-canvas opacity-30'
                      }`} style={{minHeight:80}}>
                        {run && (
                          <div className="mb-1.5 rounded-[6px]"
                            onClick={rs==='completed'||rs==='skipped' ? e=>{e.stopPropagation();setSelectedWorkout(run);} : undefined}
                            style={{cursor:rs==='completed'||rs==='skipped'?'pointer':'default'}}>
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <div className="w-1 h-1 rounded-full bg-run-accent"/>
                              <span className="text-[9px] font-semibold text-run-accent uppercase truncate">
                                {getRunLabel(run.details?.runType)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[12px] font-bold text-primary leading-none" style={{fontVariantNumeric:'tabular-nums'}}>
                                {run.details?.plannedDistance}<span className="text-[9px] font-normal text-tertiary"> mi</span>
                              </p>
                              {rs==='completed' && <span className="text-[9px] font-bold text-bc-green-dark">✓</span>}
                              {rs==='skipped'   && <span className="text-[9px] text-bc-red">✗</span>}
                            </div>
                            {run.details?.targetPace && <p className="text-[9px] text-tertiary mt-0.5">{run.details.targetPace}</p>}
                          </div>
                        )}
                        {lift && (
                          <div className="rounded-[6px]"
                            onClick={ls==='completed'||ls==='skipped' ? e=>{e.stopPropagation();setSelectedWorkout(lift);} : undefined}
                            style={{cursor:ls==='completed'||ls==='skipped'?'pointer':'default'}}>
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <div className="w-1 h-1 rounded-full bg-lift-accent"/>
                              <span className="text-[9px] font-semibold text-lift-accent truncate">
                                {(lift.details?.sessionName||'Lift').split(' ')[0]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[9px] text-tertiary">{lift.details?.exercises?.length||0} ex</p>
                              {ls==='completed' && <span className="text-[9px] font-bold text-bc-green-dark">✓</span>}
                              {ls==='skipped'   && <span className="text-[9px] text-bc-red">✗</span>}
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

            {/* ── Session detail cards — view mode ── */}
            {!editMode && (
              <div className="mt-4 space-y-3">
                {weekDates.map(dateStr => {
                  const sessions = dateSessionMap[dateStr] || {};
                  const run  = sessions.run;
                  const lift = sessions.lift;
                  if (!run && !lift) return null;
                  const d = new Date(dateStr + 'T12:00:00');
                  const dayName = DAY_FROM_JS[d.getDay()];
                  const isToday = dateStr === TODAY_STR;
                  const isPast  = dateStr < TODAY_STR;
                  if (isPast) return null;
                  const rs = run?.status  || null;
                  const ls = lift?.status || null;
                  return (
                    <div key={dateStr} className={`rounded-[16px] border overflow-hidden ${isToday?'border-bc-blue/40':'border-border'}`}>
                      <div className={`flex items-center justify-between px-4 py-2 ${isToday?'bg-bc-blue':'bg-canvas/50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase ${isToday?'text-white':'text-primary'}`}>{DAY_SHORT[dayName]||d.toLocaleDateString('en-US',{weekday:'short'})}</span>
                          <span className={`text-[10px] ${isToday?'text-white/80':'text-tertiary'}`}>{d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          {isToday && <span className="text-[10px] font-semibold text-white/90">· Today</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {rs==='completed'&&<span className="text-[10px] text-white bg-bc-green/80 px-1.5 py-0.5 rounded-full font-semibold">Run ✓</span>}
                          {rs==='skipped'  &&<span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Run ✗</span>}
                          {ls==='completed'&&<span className="text-[10px] text-white bg-bc-blue/80 px-1.5 py-0.5 rounded-full font-semibold">Lift ✓</span>}
                          {ls==='skipped'  &&<span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Lift ✗</span>}
                        </div>
                      </div>
                      {run && (
                        <div className={`px-4 py-3 ${lift?'border-b border-border/50':''} ${rs==='completed'?'bg-bc-green-light/30':rs==='skipped'?'opacity-50':run.details?.isRaceDay?'bg-red-50/60':'bg-run-bg/30'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-1 self-stretch rounded-full flex-shrink-0 min-h-[16px] ${run.details?.isRaceDay?'bg-bc-red':'bg-run-accent'}`}/>
                              <span className={`text-[10px] font-bold uppercase tracking-wide ${run.details?.isRaceDay?'text-bc-red':'text-run-accent'}`}>
                                {run.details?.isRaceDay?'🏁 Race Day':getRunLabel(run.details?.runType)}
                              </span>
                            </div>
                            <button onClick={()=>(rs==='completed'||rs==='skipped')?setSelectedWorkout(run):(run.id?router.push(`/log?start=${run.id}`):setLogTarget(run))}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${rs==='completed'?'bg-bc-green-light text-bc-green-dark':rs==='skipped'?'bg-bc-red-light text-bc-red-dark':run.details?.isRaceDay?'bg-bc-red text-white':'bg-bc-blue text-white'}`}>
                              {rs==='completed'?'✓ Done':rs==='skipped'?'View':run.details?.isRaceDay?'🏁 Race Day':'Log It'}
                            </button>
                          </div>
                          {run.details?.isRaceDay && run.details?.raceName && (
                            <p className="text-sm font-bold text-bc-red pl-3 mb-1">{run.details.raceName}</p>
                          )}
                          <div className="flex items-center gap-3 pl-3">
                            <span className={`text-base font-bold ${run.details?.isRaceDay?'text-bc-red':'text-primary'}`} style={{fontVariantNumeric:'tabular-nums'}}>
                              {run.details?.plannedDistance}<span className="text-xs font-normal text-tertiary"> mi</span>
                            </span>
                            {run.details?.goalTime&&<span className="text-[10px] text-bc-red-dark font-semibold">Goal: {run.details.goalTime}</span>}
                            {!run.details?.isRaceDay&&run.details?.targetPace&&<span className="text-[10px] text-secondary">@ {run.details.targetPace}/mi</span>}
                            {run.details?.duration&&<span className="text-[10px] text-tertiary">{run.details.duration} min</span>}
                          </div>
                          {run.details?.notes&&<p className="text-[10px] text-secondary italic mt-1 pl-3">{run.details.notes}</p>}
                        </div>
                      )}
                      {lift && (
                        <div className={`px-4 py-3 ${ls==='completed'?'bg-bc-blue-light/20':ls==='skipped'?'opacity-50':'bg-lift-bg/30'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1 self-stretch rounded-full bg-lift-accent flex-shrink-0 min-h-[16px]"/>
                              <div><span className="text-xs font-bold text-lift-accent">{lift.details?.sessionName}</span>{lift.details?.duration&&<span className="text-[10px] text-tertiary ml-2">{lift.details.duration} min</span>}</div>
                            </div>
                            <button onClick={()=>(ls==='completed'||ls==='skipped')?setSelectedWorkout(lift):(lift.id?router.push(`/log?start=${lift.id}`):setLogTarget(lift))}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${ls==='completed'?'bg-bc-green-light text-bc-green-dark':ls==='skipped'?'bg-bc-red-light text-bc-red-dark':'bg-bc-blue text-white'}`}>
                              {ls==='completed'?'✓ Done':ls==='skipped'?'View':'Log It'}
                            </button>
                          </div>
                          {lift.details?.exercises?.length>0&&(
                            <div className="pl-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {lift.details.exercises.map((ex,eI)=>{
                                const sn=Array.isArray(ex.sets)?ex.sets.length:ex.sets;
                                const rv=Array.isArray(ex.sets)?(ex.sets[0]?.reps??ex.sets[0]?.targetReps??ex.reps):ex.reps;
                                return(<div key={eI} className="flex items-center justify-between gap-2 px-2 py-1 bg-white/50 rounded-[8px]">
                                  <span className="text-[11px] text-primary truncate flex-1">{ex.name}</span>
                                  {sn&&rv&&<span className="flex-shrink-0 px-1.5 py-0.5 bg-lift-bg rounded-full border border-lift-accent/20"><span className="text-[11px] font-bold text-lift-accent" style={{fontVariantNumeric:'tabular-nums'}}>{sn}×{rv}</span></span>}
                                </div>);
                              })}
                            </div>
                          )}
                          {lift.details?.muscleGroups?.length>0&&<div className="pl-3 flex gap-1 mt-1.5 flex-wrap">{lift.details.muscleGroups.slice(0,3).map(mg=><span key={mg} className="text-[9px] px-1.5 py-0.5 bg-lift-bg border border-lift-accent/20 rounded-full text-lift-accent">{mg}</span>)}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Session edit cards — edit mode ── */}
            {editMode && (
              <div className="mt-4 space-y-3">
                {savingEdits && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-bc-blue-light/40 rounded-[10px]">
                    <Loader2 size={12} className="animate-spin text-bc-blue"/>
                    <span className="text-[11px] text-bc-blue-dark">Saving changes…</span>
                  </div>
                )}
                {weekDates.map(dateStr => {
                  const sessions = dateSessionMap[dateStr] || {};
                  const run  = sessions.run;
                  const lift = sessions.lift;
                  if (!run && !lift) return null;

                  // Only edit planned sessions — completed/skipped are locked
                  const runEditable  = run  && run.status  === 'planned' && !!run.id;
                  const liftEditable = lift && lift.status === 'planned' && !!lift.id;
                  if (!runEditable && !liftEditable) return null;

                  const d = new Date(dateStr + 'T12:00:00');
                  const dayName = DAY_FROM_JS[d.getDay()];

                  return (
                    <EditSessionCard
                      key={dateStr}
                      dateStr={dateStr}
                      dayName={dayName}
                      run={runEditable ? run : null}
                      lift={liftEditable ? lift : null}
                      weekDates={weekDates}
                      onSaveRun={(id, updates) => saveSessionEdit(id, updates)}
                      onSaveLift={(id, updates) => saveSessionEdit(id, updates)}
                      onReschedule={(id, oldDate, newDate) => rescheduleSession(id, oldDate, newDate)}
                    />
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="pb-10">

      <div className="mb-4"/>

      {/* ── Compact plan header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-primary leading-snug">{displayPlan.name||'Training Plan'}</h2>
            {view==='active'
              ? <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px] flex-shrink-0">Active</span>
              : <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px] flex-shrink-0">Preview</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {view==='preview' && (
              <button onClick={handleActivate} disabled={activating}
                className="flex items-center gap-1 px-3 py-1.5 bg-bc-indigo text-white text-[11px] font-semibold rounded-[8px] disabled:opacity-50 active:scale-95 min-h-[36px]">
                {activating?<Loader2 size={10} className="animate-spin"/>:<Play size={10}/>}
                {activating?'…':'Activate'}
              </button>
            )}
            <button onClick={()=>setPlanMenuOpen(v=>!v)}
              className="w-8 h-8 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary hover:text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-tertiary">{displayPlan.total_weeks||displayPlan.weeks.length} wks</span>
          <span className="text-[10px] text-tertiary">·</span>
          <span className="text-[10px] text-tertiary">{countSessions(displayPlan)} sessions</span>
          {displayPlan.weeks?.[0]?.phase && (
            <><span className="text-[10px] text-tertiary">·</span>
            <span className="text-[10px] text-tertiary capitalize">{displayPlan.weeks[0].phase} → {displayPlan.weeks[displayPlan.weeks.length-1]?.phase}</span></>
          )}
        </div>

        {/* Overflow menu */}
        {planMenuOpen && (
          <div className="mt-2 p-2 bg-white border border-border rounded-[14px] shadow-lg space-y-1">
            <button onClick={()=>{setShowAIEditor(true);setPlanMenuOpen(false);}}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
              <MessageSquare size={14} className="text-bc-indigo flex-shrink-0"/> Edit with AI
            </button>
            {view==='active' && (<>
              <button onClick={()=>{ setEditMode(!editMode); setPlanMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                <Pencil size={14} className="text-secondary flex-shrink-0"/>
                {editMode?'Done editing':'Edit manually'}
              </button>
              <button onClick={()=>{handleReactivate();setPlanMenuOpen(false);}} disabled={reactivating}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left disabled:opacity-40">
                <Play size={14} className="text-secondary flex-shrink-0"/>
                {reactivating?'Syncing…':'Reactivate dates'}
              </button>
              <button onClick={()=>{setView('wizard');setPlanMenuOpen(false);}}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                <Sparkles size={14} className="text-secondary flex-shrink-0"/> New plan
              </button>
              <button onClick={()=>{
                if(!window.confirm('This will replace your current active plan. Your logged workouts will be kept.')) return;
                setPlanMenuOpen(false); setShowImportWizard(true);
              }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                <Calendar size={14} className="text-secondary flex-shrink-0"/> Import & replace plan
              </button>
            </>)}
            {view==='preview' && (
              <button onClick={()=>{setEditMode(!editMode);setPlanMenuOpen(false);}}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                <Pencil size={14} className="text-secondary flex-shrink-0"/>
                {editMode?'Done editing':'Edit manually'}
              </button>
            )}
            <div className="border-t border-border/50 pt-1 flex gap-3 px-3 py-1">
              <button onClick={()=>{expandAll(displayPlan);setPlanMenuOpen(false);}} className="text-[11px] text-tertiary hover:text-secondary">Expand all</button>
              <button onClick={()=>{collapseAll();setPlanMenuOpen(false);}} className="text-[11px] text-tertiary hover:text-secondary">Collapse all</button>
            </div>
          </div>
        )}
      </div>

      {/* Plan insights */}
      {displayPlan.plan_insights?.filter(i=>!i.actionable).length > 0 && (
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
              {displayPlan.plan_insights.filter(i=>!i.actionable).map((ins,i) => {
                const cc={scheduling:'border-bc-blue/20 bg-bc-blue-light/40',interference:'border-bc-red/20 bg-bc-red-light/40',periodization:'border-rest-accent/20 bg-rest-bg',recovery:'border-run-accent/20 bg-run-bg',progression:'border-cardio-accent/20 bg-cardio-bg',deload:'border-bc-indigo/20 bg-bc-indigo-light/40'};
                return (
                  <div key={i} className={`p-3 rounded-[14px] border ${cc[ins.category]||'border-border bg-canvas'}`}>
                    <span className="bc-caption uppercase">{ins.category}</span>
                    <p className="text-xs font-semibold text-primary mb-1 mt-0.5">{ins.title}</p>
                    <p className="text-[11px] text-secondary leading-relaxed">{ins.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-bc-red-light border border-bc-red/20 rounded-[14px]"><p className="text-bc-red-dark text-xs">{error}</p></div>}

      {/* ── Week rows ── */}
      <div className="space-y-3">
        {(() => {
          const pastWeeks = displayPlan.weeks.filter(w => {
            const ws = getWeekStartDate(w.weekNumber);
            const we = new Date(ws); we.setDate(ws.getDate() + 6);
            return we.toLocaleDateString('en-CA') < TODAY_STR;
          });
          const activeWeeks = displayPlan.weeks.filter(w => {
            const ws = getWeekStartDate(w.weekNumber);
            const we = new Date(ws); we.setDate(ws.getDate() + 6);
            return we.toLocaleDateString('en-CA') >= TODAY_STR;
          });
          return (
            <>
              {pastWeeks.length > 0 && (
                <div>
                  <button onClick={() => setPastWeeksOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bc-card-flush hover:bg-canvas transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-secondary">Past weeks ({pastWeeks.length})</span>
                      {pastWeeks.map(w => {
                        const wDates = getWeekDates(w.weekNumber);
                        const wRows  = weekWorkoutMap[w.weekNumber] || {};
                        const sessions = wDates.flatMap(ds => (wRows[ds]||[]).filter(r=>r.type!=='rest'));
                        const done = sessions.filter(s=>s.status==='completed').length;
                        const rate = sessions.length > 0 ? Math.round(done/sessions.length*100) : 0;
                        return (
                          <span key={w.weekNumber} className="w-4 h-1.5 rounded-full"
                            style={{background:rate>=80?'#34C759':rate>=50?'#FF9500':'#FF3B30'}}
                            title={`Wk ${w.weekNumber}: ${rate}%`}/>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="bc-caption">
                        {pastWeeks.reduce((s,w) => {
                          const wDates = getWeekDates(w.weekNumber);
                          const wRows  = weekWorkoutMap[w.weekNumber] || {};
                          return s + wDates.flatMap(ds=>(wRows[ds]||[]).filter(r=>r.type!=='rest'&&r.status==='completed')).length;
                        },0)} sessions done
                      </span>
                      {pastWeeksOpen ? <ChevronUp size={12} className="text-tertiary"/> : <ChevronDown size={12} className="text-tertiary"/>}
                    </div>
                  </button>
                  {pastWeeksOpen && (
                    <div className="space-y-3 mt-3">
                      {pastWeeks.map((week,wIdx) => renderWeekRow(week, wIdx, true))}
                    </div>
                  )}
                </div>
              )}
              {activeWeeks.map((week,wIdx) => renderWeekRow(week, wIdx + pastWeeks.length, false))}
            </>
          );
        })()}
      </div>

      {/* Calendar inline */}
      {view==='active' && (
        <div className="mt-6" ref={el => {
          if (el) {
            const todayEl = el.querySelector('[data-today="true"]') || el.querySelector('.ring-2');
            if (todayEl) todayEl.scrollIntoView({ behavior:'smooth', block:'center' });
          }
        }}>
          <div className="flex items-center justify-between mb-3">
            <p className="bc-caption uppercase tracking-wider">Calendar</p>
            <span className="text-[10px] text-tertiary">{new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
          </div>
          <CalendarView workouts={allWorkouts} onWorkoutClick={w=>setSelectedWorkout(w)}/>
        </div>
      )}

      {/* Modals */}
      {showAIEditor && <PlanEditor plan={displayPlan} onPlanUpdate={handleAIPlanUpdate} onClose={()=>setShowAIEditor(false)}/>}
      {showImportWizard && (
        <PlanImportWizard
          onComplete={() => { setShowImportWizard(false); refresh?.(); }}
          onClose={() => setShowImportWizard(false)}
        />
      )}
      {logTarget && (
        <LogForm
          workout={logTarget}
          onSave={w=>{ saveWorkout(w); refresh?.(); setLogTarget(null); }}
          onClose={()=>setLogTarget(null)}
        />
      )}
      {showNewLogForm && <LogForm workout={null} onSave={w=>{saveWorkout(w);refresh?.();setShowNewLogForm(false);}} onClose={()=>setShowNewLogForm(false)}/>}
      <WorkoutDetailModal workout={selectedWorkout} onClose={()=>setSelectedWorkout(null)} onSave={w=>{saveWorkout(w);setSelectedWorkout(null);}}/>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════
// EditSessionCard — inline editor for a single day's sessions.
// Run and lift are independently moveable — each has its own
// "Move to" date picker so they can be separated onto different days.
// ══════════════════════════════════════════════════════════════
function EditSessionCard({ dateStr, dayName, run, lift, weekDates, onSaveRun, onSaveLift, onReschedule }) {
  const d = new Date(dateStr + 'T12:00:00');

  // ── Run local state ──
  const [runDist,    setRunDist]    = React.useState(String(run?.details?.plannedDistance || ''));
  const [runPace,    setRunPace]    = React.useState(run?.details?.targetPace || '');
  const [runType,    setRunType]    = React.useState(run?.details?.runType || 'easy');
  const [runDate,    setRunDate]    = React.useState(dateStr);
  const [runDirty,   setRunDirty]   = React.useState(false);
  const [runSaving,  setRunSaving]  = React.useState(false);

  // ── Lift local state ──
  const [liftName,   setLiftName]   = React.useState(lift?.details?.sessionName || '');
  const [exercises,  setExercises]  = React.useState(() =>
    (lift?.details?.exercises || []).map(ex => ({
      name: ex.name,
      sets: String(Array.isArray(ex.sets) ? ex.sets.length : (ex.sets || '3')),
      reps: String(Array.isArray(ex.sets)
        ? (ex.sets[0]?.reps ?? ex.sets[0]?.targetReps ?? ex.reps ?? '10')
        : (ex.reps || '10')),
    }))
  );
  const [liftDate,   setLiftDate]   = React.useState(dateStr);
  const [liftDirty,  setLiftDirty]  = React.useState(false);
  const [liftSaving, setLiftSaving] = React.useState(false);

  const RUN_TYPE_OPTIONS = [
    {value:'easy',     label:'Easy Run'},
    {value:'long_run', label:'Long Run'},
    {value:'tempo',    label:'Tempo'},
    {value:'interval', label:'Intervals'},
    {value:'recovery', label:'Recovery'},
    {value:'fartlek',  label:'Fartlek'},
    {value:'shakeout', label:'Shakeout'},
  ];

  const DAY_SHORT_L  = {monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun'};
  const DAY_FROM_JS_L = {0:'sunday',1:'monday',2:'tuesday',3:'wednesday',4:'thursday',5:'friday',6:'saturday'};

  function dateLabel(ds) {
    const wd = new Date(ds + 'T12:00:00');
    const dn = DAY_FROM_JS_L[wd.getDay()];
    return `${DAY_SHORT_L[dn]||''} ${wd.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}`;
  }

  async function saveRun() {
    if (!run) return;
    setRunSaving(true);
    try {
      const dist = parseFloat(runDist);
      await onSaveRun(run.id, {
        runType,
        plannedDistance: isNaN(dist) ? run.details.plannedDistance : dist,
        targetPace: runPace || run.details.targetPace,
      });
      if (runDate !== dateStr) {
        await onReschedule(run.id, dateStr, runDate);
      }
      setRunDirty(false);
    } finally { setRunSaving(false); }
  }

  async function saveLift() {
    if (!lift) return;
    setLiftSaving(true);
    try {
      const updatedExercises = exercises.map(ex => ({
        name: ex.name,
        sets: parseInt(ex.sets) || 3,
        reps: ex.reps || '10',
      }));
      await onSaveLift(lift.id, { sessionName: liftName, exercises: updatedExercises });
      if (liftDate !== dateStr) {
        await onReschedule(lift.id, dateStr, liftDate);
      }
      setLiftDirty(false);
    } finally { setLiftSaving(false); }
  }

  // Day header — shows the original date, no move control here
  return (
    <div className="rounded-[16px] border-2 border-bc-indigo/30 overflow-hidden">

      {/* Day label */}
      <div className="px-4 py-2 bg-bc-indigo-light/50 border-b border-bc-indigo/20">
        <span className="text-[11px] font-bold text-bc-indigo uppercase">
          {DAY_SHORT_L[dayName] || d.toLocaleDateString('en-US',{weekday:'short'})}
        </span>
        <span className="text-[10px] text-bc-indigo/70 ml-1.5">
          {d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
        </span>
      </div>

      {/* ── Run editor ── */}
      {run && (
        <div className="px-4 py-3 bg-run-bg/50 border-b border-bc-indigo/10">
          {/* Run header: type + move picker */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-run-accent flex-shrink-0"/>
              <select value={runType}
                onChange={e=>{setRunType(e.target.value);setRunDirty(true);}}
                className="bc-input !py-0.5 !px-2 !text-[11px] font-semibold text-run-accent bg-transparent border-run-accent/30">
                {RUN_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Independent run move picker */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px] text-tertiary">→</span>
              <select value={runDate}
                onChange={e=>{setRunDate(e.target.value);setRunDirty(true);}}
                className="text-[10px] font-semibold text-secondary bg-white border border-border rounded-[6px] px-1.5 py-0.5 min-h-[26px]">
                {weekDates.map(ds=>(
                  <option key={ds} value={ds}>{dateLabel(ds)}{ds===dateStr?' (current)':''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Distance + pace */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-tertiary block mb-0.5">Distance (mi)</label>
              <input type="number" value={runDist} step="0.1" min="0"
                onChange={e=>{setRunDist(e.target.value);setRunDirty(true);}}
                className="bc-input !py-1 !px-2 !text-[12px] font-bold w-full"
                placeholder="0.0"/>
            </div>
            <div>
              <label className="text-[9px] text-tertiary block mb-0.5">Target pace (M:SS)</label>
              <input type="text" value={runPace}
                onChange={e=>{setRunPace(e.target.value);setRunDirty(true);}}
                className="bc-input !py-1 !px-2 !text-[12px] font-mono w-full"
                placeholder="e.g. 9:30"/>
            </div>
          </div>

          {/* Run save */}
          <div className="flex justify-end mt-2">
            {runDirty ? (
              <button onClick={saveRun} disabled={runSaving}
                className="flex items-center gap-1 px-3 py-1 bg-run-accent text-white text-[10px] font-semibold rounded-[8px] active:scale-95 disabled:opacity-50 min-h-[28px]">
                {runSaving ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>}
                {runSaving ? 'Saving…' : 'Save run'}
              </button>
            ) : (
              <span className="text-[9px] text-tertiary">No run changes</span>
            )}
          </div>
        </div>
      )}

      {/* ── Lift editor ── */}
      {lift && (
        <div className="px-4 py-3 bg-lift-bg/50">
          {/* Lift header: name + move picker */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-lift-accent flex-shrink-0"/>
              <input type="text" value={liftName}
                onChange={e=>{setLiftName(e.target.value);setLiftDirty(true);}}
                className="bc-input !py-0.5 !px-2 !text-[11px] font-semibold text-lift-accent flex-1 min-w-0 border-lift-accent/30"
                placeholder="Session name"/>
            </div>
            {/* Independent lift move picker */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px] text-tertiary">→</span>
              <select value={liftDate}
                onChange={e=>{setLiftDate(e.target.value);setLiftDirty(true);}}
                className="text-[10px] font-semibold text-secondary bg-white border border-border rounded-[6px] px-1.5 py-0.5 min-h-[26px]">
                {weekDates.map(ds=>(
                  <option key={ds} value={ds}>{dateLabel(ds)}{ds===dateStr?' (current)':''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Exercises */}
          <div className="space-y-1.5">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={ex.name}
                  onChange={e=>{const n=[...exercises];n[i]={...n[i],name:e.target.value};setExercises(n);setLiftDirty(true);}}
                  className="bc-input !py-1 !px-2 !text-[11px] flex-1"
                  placeholder="Exercise name"/>
                <input type="number" value={ex.sets} min="1" max="20"
                  onChange={e=>{const n=[...exercises];n[i]={...n[i],sets:e.target.value};setExercises(n);setLiftDirty(true);}}
                  className="bc-input !py-1 !px-1.5 !text-[11px] w-10 text-center"
                  placeholder="sets"/>
                <span className="text-[10px] text-tertiary flex-shrink-0">×</span>
                <input type="text" value={ex.reps}
                  onChange={e=>{const n=[...exercises];n[i]={...n[i],reps:e.target.value};setExercises(n);setLiftDirty(true);}}
                  className="bc-input !py-1 !px-1.5 !text-[11px] w-14 text-center"
                  placeholder="reps"/>
                {/* Remove exercise */}
                <button onClick={()=>{setExercises(exercises.filter((_,j)=>j!==i));setLiftDirty(true);}}
                  className="w-5 h-5 flex items-center justify-center text-tertiary hover:text-bc-red transition-colors flex-shrink-0">
                  <X size={10}/>
                </button>
              </div>
            ))}
            <button onClick={()=>{setExercises([...exercises,{name:'',sets:'3',reps:'10'}]);setLiftDirty(true);}}
              className="text-[10px] text-lift-accent hover:opacity-70 transition-opacity mt-0.5">
              + Add exercise
            </button>
          </div>

          {/* Lift save */}
          <div className="flex justify-end mt-2">
            {liftDirty ? (
              <button onClick={saveLift} disabled={liftSaving}
                className="flex items-center gap-1 px-3 py-1 bg-lift-accent text-white text-[10px] font-semibold rounded-[8px] active:scale-95 disabled:opacity-50 min-h-[28px]">
                {liftSaving ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>}
                {liftSaving ? 'Saving…' : 'Save lift'}
              </button>
            ) : (
              <span className="text-[9px] text-tertiary">No lift changes</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}