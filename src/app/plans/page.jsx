'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { savePlan, getActivePlan, addWorkoutsBatch } from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import PlanWizard from '@/components/shared/PlanWizard';
import PlanEditor from '@/components/shared/PlanEditor';
import LogForm from '@/components/shared/LogForm';
import DayTimeline from '@/components/shared/DayTimeline';
import CalendarView from '@/components/shared/CalendarView';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import {
  Sparkles, Play, Pencil, X, Check, ChevronDown, ChevronUp,
  Calendar, Loader2, Lightbulb, MessageSquare, AlertTriangle,
  Clock,
} from 'lucide-react';

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_SHORT = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' };
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
const PHASE_DOT = {
  base:'#2E7D32', foundation:'#2E7D32', build:'#1565C0', development:'#1565C0',
  peak:'#7B1FA2', performance:'#7B1FA2', taper:'#00838F', deload:'#4527A0',
};

// Compute week start from a known plan start date
// planStartDate: the date (YYYY-MM-DD) week 1 day 1 was activated
// Falls back to current Monday if no start date known
function getPlanWeekStartDate(weekNumber, planStartDate = null) {
  let base;
  if (planStartDate) {
    // Use the actual activation date as week 1 anchor
    base = new Date(planStartDate + 'T12:00:00');
  } else {
    // Fallback: current Monday
    const now = new Date();
    const dow = now.getDay();
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (dow===0?-6:1-dow), 12, 0, 0);
  }
  const result = new Date(base);
  result.setDate(base.getDate() + (weekNumber - 1) * 7);
  return result;
}
function getPlanDayDate(weekNumber, dayName, planStartDate = null) {
  const ws = getPlanWeekStartDate(weekNumber, planStartDate);
  const off = {monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:6};
  const d = new Date(ws); d.setDate(d.getDate() + (off[dayName]??0)); return d;
}
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
  const uk = rt.toLowerCase().replace(/\s+/g,'_');
  if (RUN_LABELS[uk]) return RUN_LABELS[uk];
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
  const { refresh, workouts: allWorkouts, saveWorkout, isLoaded } = useWorkouts();

  // ── Page tabs: 'plan' | 'history' ──
  const [pageTab, setPageTab] = useState('plan');

  // ── Plan state ──
  const [view,          setView]          = useState('loading');
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [activePlan,    setActivePlan]    = useState(null);
  const [editMode,      setEditMode]      = useState(false);
  const [showAIEditor,  setShowAIEditor]  = useState(false);
  const [logTarget,     setLogTarget]     = useState(null);
  // Auto-expand the current week (plus week 1 for context on new plans)
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set([1, 2]));
  const [activating,    setActivating]    = useState(false);
  const [reactivating,  setReactivating]  = useState(false);
  const [error,         setError]         = useState(null);
  const [insightsCollapsed, toggleInsights, openInsights] = useInsightsCollapsed();
  const [planMenuOpen,    setPlanMenuOpen]    = useState(false);
  const [pastWeeksOpen,   setPastWeeksOpen]   = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    if (typeof window==='undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('bc-plan-dismissed-suggestions')||'[]')); } catch { return new Set(); }
  });

  // ── History state ──
  const [historyMode,       setHistoryMode]      = useState('list'); // 'list' | 'calendar'
  const [showPast,          setShowPast]          = useState(false);
  const [selectedWorkout,   setSelectedWorkout]  = useState(null);
  const [showNewLogForm,    setShowNewLogForm]    = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const plan = await getActivePlan(user.id);
      if (plan) {
        setActivePlan(plan);
        setView('active');
        // Auto-expand current week based on today's date vs plan weeks
        // We'll refine this in the planStartDate useMemo, but set a reasonable default
      } else { setView('empty'); }
    }
    load();
  }, [user]);

  // ── Plan helpers ──
  function toggleWeek(n) { setExpandedWeeks(p => { const s=new Set(p); s.has(n)?s.delete(n):s.add(n); return s; }); }
  function expandAll(plan) { setExpandedWeeks(new Set(plan.weeks.map(w=>w.weekNumber))); }
  function collapseAll() { setExpandedWeeks(new Set()); }
  function handlePlanGenerated(plan) { setGeneratedPlan(plan); setExpandedWeeks(new Set([1,2])); setView('preview'); openInsights(); }
  function updateRun(wI,rI,f,v)    { setGeneratedPlan(p=>{const u=JSON.parse(JSON.stringify(p));u.weeks[wI].runs[rI][f]=v;return u;}); }
  function updateLift(wI,lI,f,v)   { setGeneratedPlan(p=>{const u=JSON.parse(JSON.stringify(p));u.weeks[wI].lifts[lI][f]=v;return u;}); }
  function updateExercise(wI,lI,eI,f,v) { setGeneratedPlan(p=>{const u=JSON.parse(JSON.stringify(p));u.weeks[wI].lifts[lI].exercises[eI][f]=v;return u;}); }
  function handleAIPlanUpdate(plan) { view==='preview'?setGeneratedPlan(plan):setActivePlan(p=>({...p,plan_data:plan})); }

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
      if (entries.length) await addWorkoutsBatch(user.id, entries);
      setActivePlan({...saved,plan_data:generatedPlan}); setGeneratedPlan(null); setView('active'); refresh?.();
    } catch { setError('Failed to activate plan. Please try again.'); }
    finally { setActivating(false); }
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
    const out=[], now=new Date();
    const startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0);
    const sdow=now.getDay(), sIdx=sdow===0?6:sdow-1;
    const lds=d=>d.toLocaleDateString('en-CA');
    const dayOff=t=>{const ti=DAY_ORDER.indexOf(t);if(ti===-1)return -1;return(ti-sIdx+7)%7;};
    plan.weeks.forEach((week,wIdx)=>{
      const ws=new Date(startDate); ws.setDate(startDate.getDate()+wIdx*7);
      const rest=new Set((week.restDays||[]).map(e=>typeof e==='object'?e.dayOfWeek:e));
      (week.runs||[]).forEach(run=>{
        const off=dayOff(run.dayOfWeek); if(off===-1||rest.has(run.dayOfWeek))return;
        const d=new Date(ws);d.setDate(ws.getDate()+off);const ds=lds(d);
        if(fromDate&&ds<fromDate)return;
        out.push({date:ds,type:'run',status:'planned',details:{runType:run.runType||'easy',runDescription:getRunLabel(run.runType),plannedDistance:run.distance,targetPace:run.targetPace||'',duration:run.duration,notes:run.notes||'',weekNumber:week.weekNumber,phase:week.phase,dayOfWeek:run.dayOfWeek}});
      });
      (week.lifts||[]).forEach(lift=>{
        const off=dayOff(lift.dayOfWeek); if(off===-1||rest.has(lift.dayOfWeek))return;
        const d=new Date(ws);d.setDate(ws.getDate()+off);const ds=lds(d);
        if(fromDate&&ds<fromDate)return;
        out.push({date:ds,type:'lift',status:'planned',details:{sessionName:lift.sessionName||'Strength Session',muscleGroups:lift.muscleGroups||[],exercises:(lift.exercises||[]).map(ex=>({name:ex.name,sets:ex.sets,reps:ex.reps,notes:ex.notes||''})),duration:lift.duration,weekNumber:week.weekNumber,phase:week.phase,dayOfWeek:lift.dayOfWeek}});
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
  function countSessions(plan) { return plan.weeks.reduce((s,w)=>s+(w.runs?.length||0)+(w.lifts?.length||0),0); }

  // ── Workout lookup maps ──
  const workoutStatusMap = useMemo(()=>{
    const m={};
    (allWorkouts||[]).forEach(w=>{const k=`${w.date}-${w.type}`;if(!m[k]||w.status==='completed')m[k]=w.status;});
    return m;
  },[allWorkouts]);
  function getStatus(dateStr,type){return workoutStatusMap[`${dateStr}-${type}`]||'planned';}

  // ── Derive plan start date from actual workout data ──
  // Find the earliest workout with weekNumber=1 — this is the real anchor
  // regardless of when the user activated the plan or what day it is today.
  // Also detects if a generated (preview) plan has never been activated yet.
  const planStartDate = useMemo(() => {
    if (view === 'preview') {
      // New plan being previewed — start from today
      return new Date().toLocaleDateString('en-CA');
    }
    // Find earliest week-1 workout in the actual DB
    const week1Workouts = (allWorkouts || [])
      .filter(w => w.details?.weekNumber === 1)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (week1Workouts.length > 0) return week1Workouts[0].date;
    // Fallback: current Monday
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (dow===0?-6:1-dow), 12, 0, 0);
    return mon.toLocaleDateString('en-CA');
  }, [allWorkouts, view]);

  // ── Actual date map: tracks sessions that have been date-edited in the modal ──
  // Key: "{weekNumber}-{type}-{dayOfWeek}" — unique per session
  // Value: the current actual date in DB (may differ from plan's computed date)
  const workoutActualDateMap = useMemo(() => {
    const m = {};
    (allWorkouts || []).forEach(w => {
      const wn  = w.details?.weekNumber;
      const dow = w.details?.dayOfWeek;
      if (wn && dow) {
        const key = `${wn}-${w.type}-${dow}`;
        if (!m[key] || w.status === 'completed') m[key] = w.date;
      }
    });
    return m;
  }, [allWorkouts]);

  // Get real date for a plan session (falls back to computed date if not edited)
  function getActualDate(weekNumber, type, dayOfWeek, computedDateStr) {
    const actual = workoutActualDateMap[`${weekNumber}-${type}-${dayOfWeek}`];
    return actual || computedDateStr;
  }

  // ── Auto-expand current week — placed AFTER planStartDate and displayPlan are declared ──
  useEffect(() => {
    if (!activePlan?.plan_data?.weeks || view !== 'active' || !planStartDate) return;
    const base = new Date(planStartDate + 'T12:00:00');
    const todayDate = new Date(TODAY_STR + 'T12:00:00');
    const diffDays = Math.floor((todayDate - base) / (1000 * 60 * 60 * 24));
    const currentWeekNum = Math.max(1, Math.ceil((diffDays + 1) / 7));
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.add(currentWeekNum);
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById(`week-${currentWeekNum}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }, [planStartDate, view, activePlan?.plan_data]);


  // ── History data ──
  const { pastDates, weekGroups } = useMemo(()=>{
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

  // ── Loading ──

  // ── Render a single week row (used for both past and active weeks) ──
  function renderWeekRow(week, wIdx, isPastSection) {
    const isExpanded=expandedWeeks.has(week.weekNumber);
    const ps=PHASE_COLORS[week.phase]||PHASE_COLORS.base;
    const wStart=getPlanWeekStartDate(week.weekNumber, planStartDate);
    const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6);
    const wStartStr=wStart.toLocaleDateString('en-CA');
    const isCurWk=wStartStr<=TODAY_STR&&TODAY_STR<=wEnd.toLocaleDateString('en-CA');
    return(
      <div key={week.weekNumber} className="bc-card-flush" id={`week-${week.weekNumber}`}>
        <button onClick={()=>toggleWeek(week.weekNumber)}
          className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors min-h-[44px]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>Week {week.weekNumber}</span>
            <span className={`bc-pill text-[10px] font-medium capitalize border ${ps}`}>{week.phase}</span>
            {view==='preview' && week.weekNumber===1 && (
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px] border border-bc-orange/20">Preview — not yet active</span>
            )}
            <span className={`bc-caption ${isCurWk?'text-bc-blue font-semibold':''}`}>
              {isCurWk?'This week · ':''}{fmtShort(wStart)}–{fmtShort(wEnd)}
            </span>
            <span className="bc-caption hidden sm:inline">
              {week.totalMileage?`· ${week.totalMileage} mi`:''}
              {week.runs?.length>0?` · ${week.runs.length} run${week.runs.length!==1?'s':''}`:' '}
              {week.lifts?.length>0?` · ${week.lifts.length} lift${week.lifts.length!==1?'s':''}`:' '}
            </span>
            <span className="bc-caption sm:hidden">{(week.runs?.length||0)+(week.lifts?.length||0)} sessions</span>
          </div>
          {isExpanded?<ChevronUp size={14} className="text-tertiary flex-shrink-0"/>:<ChevronDown size={14} className="text-tertiary flex-shrink-0"/>}
        </button>

        {isExpanded&&(
          <div className="px-4 pb-4 border-t border-border">

            {/* Desktop 7-col grid */}
            <div className="hidden sm:block overflow-x-auto mt-3">
              <div className="grid grid-cols-7 gap-1" style={{minWidth:560}}>
                {DAY_ORDER.map(day=>{
                  const run=week.runs?.find(r=>r.dayOfWeek===day);
                  const lift=week.lifts?.find(l=>l.dayOfWeek===day);
                  const re=Array.isArray(week.restDays)?week.restDays.find(r=>typeof r==='object'?r.dayOfWeek===day:r===day):null;
                  const isRest=!!re;
                  const dd=getPlanDayDate(week.weekNumber, day, planStartDate);
                  const ds=dd.toLocaleDateString('en-CA');
                  const isToday=ds===TODAY_STR;
                  const actualRunDate=run?getActualDate(week.weekNumber,'run',day,ds):ds;
    const rs=run?getStatus(actualRunDate,'run'):null;
                  const actualLiftDate=lift?getActualDate(week.weekNumber,'lift',day,ds):ds;
    const ls=lift?getStatus(actualLiftDate,'lift'):null;
                  const allDone=(run?rs==='completed':true)&&(lift?ls==='completed':true)&&(run||lift);
                  const anySkip=rs==='skipped'||ls==='skipped';
                  const hBg=isToday?'bg-bc-blue':allDone?'bg-bc-green-light':anySkip?'bg-bc-red-light':'bg-canvas';
                  return(
                    <div key={day}>
                      <div className={`text-center py-1.5 rounded-t-[8px] mb-0.5 ${hBg}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday?'text-white':'text-tertiary'}`}>{DAY_SHORT[day]}</p>
                        <p className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>{dd.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</p>
                      </div>
                      <div className={`rounded-b-[8px] p-1.5 min-h-[90px] border ${isRest?'bg-rest-bg border-rest-accent/20':run&&lift?'bg-surface border-border':run?'bg-run-bg border-run-accent/20':lift?'bg-lift-bg border-lift-accent/20':'bg-canvas border-transparent'}`}>
                        {isRest&&<div className="flex items-center justify-center h-full min-h-[70px]"><span className="text-[9px] font-medium text-rest-accent">Rest</span></div>}
                        {run&&(<div className="mb-1">
                          <div className="flex items-center gap-0.5 mb-0.5"><div className="w-1 h-1 rounded-full bg-run-accent"/><span className="text-[9px] font-semibold text-run-accent uppercase truncate">{getRunLabel(run.runType)}</span></div>
                          <div className="flex items-center gap-1"><p className="text-[11px] font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{run.distance} mi</p>{rs==='completed'&&<span className="text-[8px] font-bold text-bc-green-dark">✓</span>}{rs==='skipped'&&<span className="text-[8px] font-bold text-bc-red">✗</span>}</div>
                          {run.targetPace&&<p className="text-[9px] text-tertiary">{run.targetPace}</p>}
                        </div>)}
                        {lift&&(<div>
                          <div className="flex items-center gap-0.5 mb-0.5"><div className="w-1 h-1 rounded-full bg-lift-accent"/><span className="text-[9px] font-semibold text-lift-accent truncate">{lift.sessionName||'Strength'}</span></div>
                          <div className="flex items-center gap-1"><p className="text-[9px] text-tertiary">{lift.exercises?.length||0} ex</p>{ls==='completed'&&<span className="text-[8px] font-bold text-bc-green-dark">✓</span>}{ls==='skipped'&&<span className="text-[8px] font-bold text-bc-red">✗</span>}</div>
                        </div>)}
                        {!isRest&&!run&&!lift&&<div className="flex items-center justify-center min-h-[70px]"><span className="text-[9px] text-tertiary opacity-30">—</span></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile scroll strip */}
            <div className="sm:hidden mt-3 -mx-4">
              <div className="flex gap-2 overflow-x-auto px-4 pb-2" style={{scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
                {DAY_ORDER.map(day=>{
                  const run=week.runs?.find(r=>r.dayOfWeek===day);
                  const lift=week.lifts?.find(l=>l.dayOfWeek===day);
                  const re=Array.isArray(week.restDays)?week.restDays.find(r=>typeof r==='object'?r.dayOfWeek===day:r===day):null;
                  const isRest=!!re, isEmpty=!run&&!lift&&!isRest;
                  const dd=getPlanDayDate(week.weekNumber, day, planStartDate);
                  const ds=dd.toLocaleDateString('en-CA');
                  const isToday=ds===TODAY_STR;
                  const actualRunDate=run?getActualDate(week.weekNumber,'run',day,ds):ds;
    const rs=run?getStatus(actualRunDate,'run'):null;
                  const actualLiftDate=lift?getActualDate(week.weekNumber,'lift',day,ds):ds;
    const ls=lift?getStatus(actualLiftDate,'lift'):null;
                  const loggedRunCell  = (rs==='completed'||rs==='skipped') ? allWorkouts.find(w=>w.date===actualRunDate &&w.type==='run') : null;
                  const loggedLiftCell = (ls==='completed'||ls==='skipped') ? allWorkouts.find(w=>w.date===actualLiftDate&&w.type==='lift'): null;
                  return(
                    <div key={day} className="flex-shrink-0 flex flex-col"
                      style={{width:isEmpty?44:(run&&lift)?120:108}}>
                      <div className={`flex flex-col items-center py-1.5 rounded-t-[10px] mb-0.5 ${isToday?'bg-bc-blue':'bg-canvas'}`}>
                        <span className={`text-[10px] font-bold uppercase ${isToday?'text-white':'text-tertiary'}`}>{DAY_SHORT[day]}</span>
                        <span className={`text-[9px] ${isToday?'text-white/80':'text-tertiary'}`}>{dd.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</span>
                      </div>
                      <div className={`rounded-b-[10px] p-2 flex-1 border ${isToday?'border-bc-blue/30':isRest?'border-rest-accent/20 bg-rest-bg':run&&lift?'border-border bg-surface':run?'border-run-accent/20 bg-run-bg':lift?'border-lift-accent/20 bg-lift-bg':'border-transparent bg-canvas opacity-30'}`} style={{minHeight:80}}>
                        {run&&(
                          <div className={`mb-1.5 rounded-[6px] ${loggedRunCell?'active:opacity-60 cursor-pointer':''}`}
                            onClick={loggedRunCell ? e=>{e.stopPropagation();setSelectedWorkout(loggedRunCell);} : undefined}>
                            <div className="flex items-center gap-0.5 mb-0.5"><div className="w-1 h-1 rounded-full bg-run-accent"/><span className="text-[9px] font-semibold text-run-accent uppercase truncate">{getRunLabel(run.runType)}</span></div>
                            <div className="flex items-center gap-1">
                              <p className="text-[12px] font-bold text-primary leading-none" style={{fontVariantNumeric:'tabular-nums'}}>{run.distance}<span className="text-[9px] font-normal text-tertiary"> mi</span></p>
                              {rs==='completed'&&<span className="text-[9px] font-bold text-bc-green-dark">✓</span>}{rs==='skipped'&&<span className="text-[9px] text-bc-red">✗</span>}
                            </div>
                            {run.targetPace&&<p className="text-[9px] text-tertiary mt-0.5">{run.targetPace}</p>}
                          </div>
                        )}
                        {lift&&(
                          <div className={`rounded-[6px] ${loggedLiftCell?'active:opacity-60 cursor-pointer':''}`}
                            onClick={loggedLiftCell ? e=>{e.stopPropagation();setSelectedWorkout(loggedLiftCell);} : undefined}>
                            <div className="flex items-center gap-0.5 mb-0.5"><div className="w-1 h-1 rounded-full bg-lift-accent"/><span className="text-[9px] font-semibold text-lift-accent truncate">{(lift.sessionName||'Lift').split(' ')[0]}</span></div>
                            <div className="flex items-center gap-1"><p className="text-[9px] text-tertiary">{lift.exercises?.length||0} ex</p>{ls==='completed'&&<span className="text-[9px] font-bold text-bc-green-dark">✓</span>}{ls==='skipped'&&<span className="text-[9px] text-bc-red">✗</span>}</div>
                          </div>
                        )}
                        {isRest&&!run&&!lift&&<div className="flex items-center justify-center h-full"><span className="text-[9px] text-rest-accent font-medium">Rest</span></div>}
                        {isEmpty&&<div className="flex items-center justify-center h-full"><span className="text-[9px] text-tertiary">—</span></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day-grouped session detail cards — past days collapsed */}
            {!editMode&&(
              <div className="mt-4 space-y-3">
                {DAY_ORDER.map(day=>{
                  const run=week.runs?.find(r=>r.dayOfWeek===day);
                  const lift=week.lifts?.find(l=>l.dayOfWeek===day);
                  if(!run&&!lift)return null;
                  const dd=getPlanDayDate(week.weekNumber, day, planStartDate);
                  const ds=dd.toLocaleDateString('en-CA');
                  const isToday=ds===TODAY_STR, isPast=ds<TODAY_STR;
                  // Past days show as compact summary only, not full detail
                  if(isPast && !isCurWk) return null; // past week days hidden (week is collapsed)
                  const actualRunDate=run?getActualDate(week.weekNumber,'run',day,ds):ds;
    const rs=run?getStatus(actualRunDate,'run'):null;
                  const actualLiftDate=lift?getActualDate(week.weekNumber,'lift',day,ds):ds;
    const ls=lift?getStatus(actualLiftDate,'lift'):null;
                  // Current week past days: compact completed/skipped summary
                  const runSt  = run  ? getStatus(getActualDate(week.weekNumber,'run', day,ds),'run')  : null;
                  const liftSt = lift ? getStatus(getActualDate(week.weekNumber,'lift',day,ds),'lift') : null;
                  // Past days in current week: skip cards entirely — scroll strip is sufficient
                  if(isPast && isCurWk) return null;
                  return(
                    <div key={day} className={`rounded-[16px] border overflow-hidden ${isToday?'border-bc-blue/40':'border-border'}`}>
                      {/* Day header */}
                      <div className={`flex items-center justify-between px-4 py-2 ${isToday?'bg-bc-blue':isPast?'bg-canvas/80':'bg-canvas/50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase ${isToday?'text-white':'text-primary'}`}>{DAY_SHORT[day]}</span>
                          <span className={`text-[10px] ${isToday?'text-white/80':'text-tertiary'}`}>{dd.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          {isToday&&<span className="text-[10px] font-semibold text-white/90">· Today</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {rs==='completed'&&<span className="text-[10px] text-white bg-bc-green/80 px-1.5 py-0.5 rounded-full font-semibold">Run ✓</span>}
                          {rs==='skipped'  &&<span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Run ✗</span>}
                          {ls==='completed'&&<span className="text-[10px] text-white bg-bc-blue/80 px-1.5 py-0.5 rounded-full font-semibold">Lift ✓</span>}
                          {ls==='skipped'  &&<span className="text-[10px] text-bc-red-dark bg-bc-red-light px-1.5 py-0.5 rounded-full font-semibold">Lift ✗</span>}
                        </div>
                      </div>
                      {/* Run */}
                      {run&&(
                        <div className={`px-4 py-3 ${lift?'border-b border-border/50':''} ${rs==='completed'?'bg-bc-green-light/30':rs==='skipped'?'opacity-50':'bg-run-bg/30'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-1 self-stretch rounded-full bg-run-accent flex-shrink-0 min-h-[16px]"/>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-run-accent">{getRunLabel(run.runType)}</span>
                            </div>
                            {(() => {
                              const loggedRun = (rs==='completed'||rs==='skipped') ? allWorkouts.find(w=>w.date===actualRunDate&&w.type==='run') : null;
                              return (
                                <button onClick={()=>loggedRun ? setSelectedWorkout(loggedRun) : setLogTarget({type:'run',status:'planned',date:actualRunDate||ds,details:{runType:run.runType,plannedDistance:run.distance,targetPace:run.targetPace||'',duration:run.duration,notes:run.notes||'',weekNumber:week.weekNumber,phase:week.phase}})}
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${rs==='completed'?'bg-bc-green-light text-bc-green-dark':rs==='skipped'?'bg-bc-red-light text-bc-red-dark':'bg-bc-blue text-white'}`}>
                                  {rs==='completed'?'✓ Done':rs==='skipped'?'View':'Log It'}
                                </button>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-3 pl-3">
                            <span className="text-base font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{run.distance}<span className="text-xs font-normal text-tertiary"> mi</span></span>
                            {run.targetPace&&<span className="text-[10px] text-secondary">@ {run.targetPace}/mi</span>}
                            {run.duration&&<span className="text-[10px] text-tertiary">{run.duration} min</span>}
                          </div>
                          {run.notes&&<p className="text-[10px] text-secondary italic mt-1 pl-3">{run.notes}</p>}
                        </div>
                      )}
                      {/* Lift */}
                      {lift&&(
                        <div className={`px-4 py-3 ${ls==='completed'?'bg-bc-blue-light/20':ls==='skipped'?'opacity-50':'bg-lift-bg/30'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1 self-stretch rounded-full bg-lift-accent flex-shrink-0 min-h-[16px]"/>
                              <div><span className="text-xs font-bold text-lift-accent">{lift.sessionName}</span>{lift.duration&&<span className="text-[10px] text-tertiary ml-2">{lift.duration} min</span>}</div>
                            </div>
                            {(() => {
                              const loggedLift = (ls==='completed'||ls==='skipped') ? allWorkouts.find(w=>w.date===actualLiftDate&&w.type==='lift') : null;
                              return (
                                <button onClick={()=>loggedLift ? setSelectedWorkout(loggedLift) : setLogTarget({type:'lift',status:'planned',date:actualLiftDate||ds,details:{sessionName:lift.sessionName,muscleGroups:lift.muscleGroups||[],exercises:(lift.exercises||[]).map(ex=>({name:ex.name,sets:ex.sets,reps:ex.reps})),duration:lift.duration,weekNumber:week.weekNumber,phase:week.phase}})}
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-[8px] min-h-[32px] transition-all active:scale-95 ${ls==='completed'?'bg-bc-green-light text-bc-green-dark':ls==='skipped'?'bg-bc-red-light text-bc-red-dark':'bg-bc-blue text-white'}`}>
                                  {ls==='completed'?'✓ Done':ls==='skipped'?'View':'Log It'}
                                </button>
                              );
                            })()}
                          </div>
                          {lift.exercises?.length>0&&(
                            <div className="pl-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {lift.exercises.map((ex,eI)=>{
                                const sn=Array.isArray(ex.sets)?ex.sets.length:ex.sets;
                                const rv=Array.isArray(ex.sets)?(ex.sets[0]?.reps??ex.sets[0]?.targetReps??ex.reps):ex.reps;
                                return(<div key={eI} className="flex items-center justify-between gap-2 px-2 py-1 bg-white/50 rounded-[8px]">
                                  <span className="text-[11px] text-primary truncate flex-1">{ex.name}</span>
                                  {sn&&rv&&<span className="flex-shrink-0 px-1.5 py-0.5 bg-lift-bg rounded-full border border-lift-accent/20"><span className="text-[11px] font-bold text-lift-accent" style={{fontVariantNumeric:'tabular-nums'}}>{sn}×{rv}</span></span>}
                                </div>);
                              })}
                            </div>
                          )}
                          {lift.muscleGroups?.length>0&&<div className="pl-3 flex gap-1 mt-1.5 flex-wrap">{lift.muscleGroups.slice(0,3).map(mg=><span key={mg} className="text-[9px] px-1.5 py-0.5 bg-lift-bg border border-lift-accent/20 rounded-full text-lift-accent">{mg}</span>)}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Edit mode */}
            {editMode&&(
              <div className="hidden sm:block mt-4 space-y-3">
                {week.lifts?.map((lift,lI)=>(
                  <div key={lI} className="p-3 bg-lift-bg rounded-[14px] border border-lift-accent/20">
                    <p className="text-xs font-medium text-lift-accent mb-2">{DAY_SHORT[lift.dayOfWeek]} — {lift.sessionName}</p>
                    <div className="space-y-2">
                      {lift.exercises?.map((ex,eI)=>(
                        <div key={eI} className="flex items-center gap-2">
                          <input type="text" value={ex.name} onChange={e=>updateExercise(wIdx,lI,eI,'name',e.target.value)} className="bc-input !py-1 !px-2 !text-[10px] flex-1"/>
                          <input type="number" value={ex.sets} onChange={e=>updateExercise(wIdx,lI,eI,'sets',Number(e.target.value))} className="bc-input !py-1 !px-2 !text-[10px] w-12 text-center"/>
                          <span className="text-[10px] text-tertiary">×</span>
                          <input type="text" value={ex.reps} onChange={e=>updateExercise(wIdx,lI,eI,'reps',e.target.value)} className="bc-input !py-1 !px-2 !text-[10px] w-16 text-center"/>
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
  }

  if (view==='loading') return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="text-tertiary animate-spin"/>
    </div>
  );

  if (view==='wizard') return (
    <PlanWizard onComplete={handlePlanGenerated} onCancel={()=>setView(activePlan?'active':'empty')}/>
  );

  // ── Empty state — no plan ──
  if (view==='empty') return (
    <div className="pb-10">
      {/* Still show history tab even without a plan */}
      <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-[12px] w-fit mb-6">
        {[['plan','Plan'],['history','History']].map(([t,l])=>(
          <button key={t} onClick={()=>setPageTab(t)}
            className={`px-4 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${pageTab===t?'bg-white shadow-sm text-primary':'text-tertiary hover:text-secondary'}`}>
            {l}
          </button>
        ))}
      </div>

      {pageTab==='plan' ? (
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
        </div>
      ) : (
        <HistoryView
          weekGroups={weekGroups} pastDates={pastDates}
          historyMode={historyMode} setHistoryMode={setHistoryMode}
          showPast={showPast} setShowPast={setShowPast}
          allWorkouts={allWorkouts} showNewLogForm={showNewLogForm}
          setShowNewLogForm={setShowNewLogForm} selectedWorkout={selectedWorkout}
          setSelectedWorkout={setSelectedWorkout} saveWorkout={saveWorkout}
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

  return (
    <div className="pb-10">

      {/* ── Top bar ── */}
      <div className="mb-4"/>

      {/* ══════════════════════════════════════
          PLAN TAB
      ══════════════════════════════════════ */}
      {true && (
        <>
          {/* ── Compact plan header ── */}
          <div className="mb-4">
            {/* Row 1: name + status + action menu toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-primary leading-snug">{displayPlan.name||'Training Plan'}</h2>
                {view==='active'
                  ? <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px] flex-shrink-0">Active</span>
                  : <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px] flex-shrink-0">Preview</span>}
              </div>
              {/* Inline action buttons — compact */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {view==='preview' && (
                  <button onClick={handleActivate} disabled={activating}
                    className="flex items-center gap-1 px-3 py-1.5 bg-bc-indigo text-white text-[11px] font-semibold rounded-[8px] disabled:opacity-50 active:scale-95 min-h-[36px]">
                    {activating?<Loader2 size={10} className="animate-spin"/>:<Play size={10}/>}
                    {activating?'…':'Activate'}
                  </button>
                )}
                {/* ··· overflow menu */}
                <button onClick={()=>setPlanMenuOpen(v=>!v)}
                  className="w-8 h-8 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary hover:text-primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Row 2: meta */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-tertiary">{displayPlan.total_weeks||displayPlan.weeks.length} wks</span>
              <span className="text-[10px] text-tertiary">·</span>
              <span className="text-[10px] text-tertiary">{countSessions(displayPlan)} sessions</span>
              {displayPlan.weeks?.[0]?.phase && (
                <><span className="text-[10px] text-tertiary">·</span>
                <span className="text-[10px] text-tertiary capitalize">{displayPlan.weeks[0].phase} → {displayPlan.weeks[displayPlan.weeks.length-1]?.phase}</span></>
              )}
            </div>

            {/* Overflow menu dropdown */}
            {planMenuOpen && (
              <div className="mt-2 p-2 bg-white border border-border rounded-[14px] shadow-lg space-y-1">
                <button onClick={()=>{setShowAIEditor(true);setPlanMenuOpen(false);}}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                  <MessageSquare size={14} className="text-bc-indigo flex-shrink-0"/> Edit with AI
                </button>
                {view==='active' && (<>
                  <button onClick={async()=>{
                    if(editMode){try{const{savePlan:sp}=await import('@/lib/database');await sp(user.id,{...activePlan,plan_data:displayPlan,is_active:true},activePlan.id);}catch(e){console.error(e);}}
                    setEditMode(!editMode); setPlanMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-primary hover:bg-canvas text-left">
                    <Pencil size={14} className="text-secondary flex-shrink-0"/>
                    {editMode?'Save manual edits':'Edit manually'}
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

          {/* Schedule suggestions */}
          {displayPlan.schedule_suggestions?.filter(s=>!dismissedSuggestions.has(s.title)).length>0&&(
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-bc-orange flex-shrink-0"/>
                <span className="text-xs font-semibold text-primary">Schedule Suggestions</span>
                <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">{displayPlan.schedule_suggestions.filter(s=>!dismissedSuggestions.has(s.title)).length} items</span>
              </div>
              <div className="space-y-2">
                {displayPlan.schedule_suggestions.filter(s=>!dismissedSuggestions.has(s.title)).map((s,i)=>{
                  const b=s.severity==='warning'?'border-bc-red/20 bg-bc-red-light/40':s.severity==='suggestion'?'border-bc-orange/20 bg-bc-orange-light/40':'border-bc-blue/20 bg-bc-blue-light/40';
                  return(
                    <div key={i} className={`p-3 rounded-[14px] border ${b}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-primary flex-1">{s.title}</p>
                        <button onClick={()=>setDismissedSuggestions(prev=>{const n=new Set([...prev,s.title]);try{localStorage.setItem('bc-plan-dismissed-suggestions',JSON.stringify([...n]));}catch{}return n;})}
                          className="text-tertiary hover:text-secondary flex-shrink-0 w-6 h-6 flex items-center justify-center"><X size={12}/></button>
                      </div>
                      <p className="text-[11px] text-secondary leading-relaxed">{s.explanation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plan insights */}
          {displayPlan.plan_insights?.filter(i=>!i.actionable).length>0&&(
            <div className="mb-4">
              <button onClick={toggleInsights}
                className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors mb-2 min-h-[44px]">
                <Lightbulb size={14} className="text-bc-orange"/>
                <span className="font-medium">Why your plan is built this way</span>
                <span className="text-tertiary">({displayPlan.plan_insights.filter(i=>!i.actionable).length} insights)</span>
                {insightsCollapsed?<ChevronDown size={12}/>:<ChevronUp size={12}/>}
              </button>
              {!insightsCollapsed&&(
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {displayPlan.plan_insights.filter(i=>!i.actionable).map((ins,i)=>{
                    const cc={scheduling:'border-bc-blue/20 bg-bc-blue-light/40',interference:'border-bc-red/20 bg-bc-red-light/40',periodization:'border-rest-accent/20 bg-rest-bg',recovery:'border-run-accent/20 bg-run-bg',progression:'border-cardio-accent/20 bg-cardio-bg',deload:'border-bc-indigo/20 bg-bc-indigo-light/40'};
                    return(<div key={i} className={`p-3 rounded-[14px] border ${cc[ins.category]||'border-border bg-canvas'}`}>
                      <span className="bc-caption uppercase">{ins.category}</span>
                      <p className="text-xs font-semibold text-primary mb-1 mt-0.5">{ins.title}</p>
                      <p className="text-[11px] text-secondary leading-relaxed">{ins.explanation}</p>
                    </div>);
                  })}
                </div>
              )}
            </div>
          )}

          {error&&<div className="mb-4 p-3 bg-bc-red-light border border-bc-red/20 rounded-[14px]"><p className="text-bc-red-dark text-xs">{error}</p></div>}

          {/* ── Week rows ── */}
          <div className="space-y-3">
            {(() => {
              // Split weeks into past and current+future
              const pastWeeks    = displayPlan.weeks.filter(w => {
                const ws = getPlanWeekStartDate(w.weekNumber, planStartDate);
                const we = new Date(ws); we.setDate(ws.getDate() + 6);
                return we.toLocaleDateString('en-CA') < TODAY_STR;
              });
              const activeWeeks  = displayPlan.weeks.filter(w => {
                const ws = getPlanWeekStartDate(w.weekNumber, planStartDate);
                const we = new Date(ws); we.setDate(ws.getDate() + 6);
                return we.toLocaleDateString('en-CA') >= TODAY_STR;
              });
              return (
                <>
                  {/* Past weeks collapsed */}
                  {pastWeeks.length > 0 && (
                    <div>
                      <button onClick={() => setPastWeeksOpen(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bc-card-flush hover:bg-canvas transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-secondary">
                            Past weeks ({pastWeeks.length})
                          </span>
                          {pastWeeks.map(w => {
                            const allDone = [
                              ...(w.runs||[]).map(r => getStatus(getPlanDayDate(w.weekNumber,r.dayOfWeek,planStartDate).toLocaleDateString('en-CA'),'run')),
                              ...(w.lifts||[]).map(l => getStatus(getPlanDayDate(w.weekNumber,l.dayOfWeek,planStartDate).toLocaleDateString('en-CA'),'lift')),
                            ].filter(Boolean);
                            const rate = allDone.length > 0
                              ? Math.round(allDone.filter(s=>s==='completed').length / allDone.length * 100)
                              : 0;
                            return (
                              <span key={w.weekNumber}
                                className="w-4 h-1.5 rounded-full"
                                style={{ background: rate>=80?'#34C759':rate>=50?'#FF9500':'#FF3B30' }}
                                title={`Wk ${w.weekNumber}: ${rate}%`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="bc-caption">
                            {pastWeeks.reduce((s,w)=>{
                              const done=[...(w.runs||[]),...(w.lifts||[])].filter(s=>getStatus(getPlanDayDate(w.weekNumber,s.dayOfWeek,planStartDate).toLocaleDateString('en-CA'),w.runType?'run':'lift')==='completed').length;
                              return s+done;
                            },0)} sessions done
                          </span>
                          {pastWeeksOpen?<ChevronUp size={12} className="text-tertiary"/>:<ChevronDown size={12} className="text-tertiary"/>}
                        </div>
                      </button>
                      {pastWeeksOpen && (
                        <div className="space-y-3 mt-3">
                          {pastWeeks.map((week,wIdx) => renderWeekRow(week, wIdx, true))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Current + future weeks */}
                  {activeWeeks.map((week, wIdx) => renderWeekRow(week, wIdx + pastWeeks.length, false))}
                </>
              );
            })()}
          </div>
      {/* ── Calendar view — inline below week list ── */}
      {view==='active' && (
        <div className="mt-6" ref={el => {
          if (el) {
            // Scroll today's cell into view within the calendar
            const todayEl = el.querySelector('[data-today="true"]') || el.querySelector('.ring-2');
            if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}>
          <div className="flex items-center justify-between mb-3">
            <p className="bc-caption uppercase tracking-wider">Calendar</p>
            <span className="text-[10px] text-tertiary">
              {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}
            </span>
          </div>
          <CalendarView workouts={allWorkouts} onWorkoutClick={w=>setLogTarget(w)}/>
        </div>
      )}

      </>)}

      {/* ── Modals ── */}
      {showAIEditor&&<PlanEditor plan={displayPlan} onPlanUpdate={handleAIPlanUpdate} onClose={()=>setShowAIEditor(false)}/>}
      {logTarget&&(
        <LogForm
          workout={logTarget}
          onSave={w=>{ saveWorkout(w); refresh?.(); setLogTarget(null); }}
          onClose={()=>setLogTarget(null)}
        />
      )}
      {showNewLogForm&&<LogForm workout={null} onSave={w=>{saveWorkout(w);refresh?.();setShowNewLogForm(false);}} onClose={()=>setShowNewLogForm(false)}/>}
      <WorkoutDetailModal workout={selectedWorkout} onClose={()=>setSelectedWorkout(null)} onSave={w=>{saveWorkout(w);setSelectedWorkout(null);}}/>
    </div>
  );
}

// ── History tab component ─────────────────────────────────────────────────────
function HistoryView({ weekGroups, pastDates, historyMode, setHistoryMode, showPast, setShowPast, allWorkouts, showNewLogForm, setShowNewLogForm, selectedWorkout, setSelectedWorkout, saveWorkout }) {
  const PHASE_DOT_COLORS = {
    base:'#2E7D32', foundation:'#2E7D32', build:'#1565C0', development:'#1565C0',
    peak:'#7B1FA2', performance:'#7B1FA2', taper:'#00838F', deload:'#4527A0'
  };
  const today = new Date().toLocaleDateString('en-CA');

  return (
    <div>
      {/* List / Calendar toggle */}
      <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-[12px] w-fit mb-5">
        {['list','calendar'].map(m=>(
          <button key={m} onClick={()=>setHistoryMode(m)}
            className={`px-4 py-1.5 rounded-[8px] text-xs font-semibold transition-all capitalize ${historyMode===m?'bg-white shadow-sm text-primary':'text-tertiary hover:text-secondary'}`}>
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </div>

      {historyMode==='list'&&(
        <div>
          {/* Past workouts */}
          {pastDates.length>0&&(
            <div className="mb-4">
              <button onClick={()=>setShowPast(v=>!v)}
                className="flex items-center gap-2 text-xs text-tertiary hover:text-secondary transition-colors mb-3 min-h-[44px]">
                {showPast?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                {showPast?'Hide':'Show'} past workouts
                <span className="text-[10px]">({pastDates.length} day{pastDates.length!==1?'s':''})</span>
              </button>
              {showPast&&(
                <div className="space-y-5 mb-6 pb-6 border-b border-border">
                  {pastDates.map(([date,dw])=>(
                    <DayTimeline key={date} date={date} workouts={dw||[]} onWorkoutClick={setSelectedWorkout}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming — week-grouped with phase header */}
          <div className="space-y-7">
            {weekGroups.length>0 ? weekGroups.map(wg=>(
              <div key={wg.key}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/60">
                  {wg.isCurrent&&<span className="text-xs font-bold text-bc-blue">This Week</span>}
                  <span className={`text-[11px] ${wg.isCurrent?'text-secondary':'text-tertiary'}`}>{wg.label}</span>
                  {wg.weekNumber&&<span className="text-[10px] text-tertiary">· Wk {wg.weekNumber}</span>}
                  {wg.phase&&(
                    <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full"
                      style={{color:PHASE_DOT_COLORS[wg.phase]||'#8E8E93',background:(PHASE_DOT_COLORS[wg.phase]||'#8E8E93')+'18'}}>
                      {wg.phase.charAt(0).toUpperCase()+wg.phase.slice(1)}
                    </span>
                  )}
                </div>
                <div className="space-y-5">
                  {wg.days.map(([date,dw])=>(
                    <DayTimeline key={date} date={date} workouts={dw||[]} onWorkoutClick={setSelectedWorkout} isToday={date===today}/>
                  ))}
                </div>
              </div>
            )) : (
              <div className="bc-card bc-empty">
                <p className="bc-empty-title">No upcoming workouts.</p>
                <p className="bc-empty-text">Generate a plan or log a workout to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {historyMode==='calendar'&&(
        <CalendarView workouts={allWorkouts} onWorkoutClick={setSelectedWorkout}/>
      )}
    </div>
  );
}