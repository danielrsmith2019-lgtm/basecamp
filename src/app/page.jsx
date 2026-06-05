'use client';

import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateInsights, calculateTrainingLoad } from '@/utils/insights';
import { formatDate } from '@/utils/runUtils';
import InsightCard from '@/components/shared/InsightCard';
import TrainingLoadCard from '@/components/shared/TrainingLoadCard';
import RecentPRs from '@/components/shared/RecentPRs';
import LogForm from '@/components/shared/LogForm';
import ReadinessCheckIn from '@/components/shared/ReadinessCheckIn';
import { calculateReadinessScore, getReadinessColor, getReadinessLabel, shouldSuggestSwap } from '@/utils/readiness';
import { getUserSettings, updateUserSettings, getNutritionLog } from '@/lib/database';
import { useAuth } from '@/lib/auth';
import { useWorkouts } from '@/lib/WorkoutContext';
import Metric from '@/components/shared/Metric';
import { formatVolume } from '@/utils/liftUtils';
import { RunTypeIcon, LiftSessionIcon, ActivityIcon, StatusIcon } from '@/utils/icons';
import { Flame, Sparkles, ChevronLeft, ChevronRight, TrendingUp, BarChart3, Activity, Footprints, Dumbbell, Zap, AlertTriangle, Lightbulb, Flag } from 'lucide-react';
import { getUserTrainingProfile } from '@/utils/trainingProfile';
import { generateLiftAdjustments } from '@/utils/liftAdjustments';
import PlanAdaptationList from '@/components/shared/PlanAdaptation';
import SkipInsightCard from '@/components/shared/SkipInsightCard';
import { analyzeSkips, computeWeeklySkipRate } from '@/utils/skipIntelligence';
import { getFuelStatus } from '@/utils/nutrition';
import ShareWorkoutButton from '@/components/shared/ShareWorkoutButton';
import { incrementShareCount } from '@/lib/share-tracking';

function getLocalToday() {
  return new Date().toLocaleDateString('en-CA');
}

function getWeekKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
  return monday.toLocaleDateString('en-CA');
}

export default function Dashboard() {
  const { workouts, prs, saveWorkout, rescheduleWorkout, isLoaded, adaptations, acceptAdaptation, rejectAdaptation } = useWorkouts();
  const { user } = useAuth();

  const [logTarget, setLogTarget]     = useState(null);
  const [justLogged, setJustLogged]   = useState(null);
  const [runWeekIndex,  setRunWeekIndex]  = useState(3);
  const [liftWeekIndex, setLiftWeekIndex] = useState(3);
  const [chartWeekOffset, setChartWeekOffset] = useState(0);
  const [runExpanded,   setRunExpanded]   = useState(false);
  const [liftExpanded,  setLiftExpanded]  = useState(false);
  const [kpiToggle,     setKpiToggle]     = useState('both');
  // FIX 3: recent activity page index
  const [activityPage, setActivityPage]   = useState(0);

  const [trainingTypeOverride, setTrainingTypeOverride] = useState('auto');
  const [dismissedOnboarding,  setDismissedOnboarding]  = useState(false);
  const [infoNotesOpen,        setInfoNotesOpen]        = useState(false);
  const [raceCountdown,        setRaceCountdown]        = useState(null);

  const [dismissedInsights, setDismissedInsights] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored  = JSON.parse(localStorage.getItem('bc-dismissed-insights') || '{}');
      const weekKey = getWeekKey();
      return stored.weekKey === weekKey ? new Set(stored.ids || []) : new Set();
    } catch { return new Set(); }
  });

  // Permanent dismissals — keyed by insight.category (or id), no week-key reset
  const [permanentDismissed, setPermanentDismissed] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('bc-dismissed-permanent') || '[]')); }
    catch { return new Set(); }
  });

  const [dismissedSkips, setDismissedSkips] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored  = JSON.parse(localStorage.getItem('bc-dismissed-skips') || '{}');
      const weekKey = getWeekKey();
      return stored.weekKey === weekKey ? new Set(stored.ids || []) : new Set();
    } catch { return new Set(); }
  });

  const [showCheckIn, setShowCheckIn]       = useState(false);
  const [checkInData, setCheckInData]       = useState(null);
  const [readinessScore, setReadinessScore] = useState(null);
  const [todayCalories, setTodayCalories]   = useState(0);
  const [todayCalTarget, setTodayCalTarget] = useState(2000);

  const today = getLocalToday();

  const [insightsSectionCollapsed, setInsightsSectionCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('bc-insights-dismissed');
      if (!stored) return false;
      return JSON.parse(stored).date === getLocalToday();
    } catch { return false; }
  });

  const [adaptationsSectionCollapsed, setAdaptationsSectionCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('bc-adaptations-dismissed');
      if (!stored) return false;
      return JSON.parse(stored).date === getLocalToday();
    } catch { return false; }
  });

  useEffect(() => {
    if (!user || !isLoaded) return;
    async function checkTrigger() {
      const settings = await getUserSettings(user.id);
      setTrainingTypeOverride(settings?.training_type || 'auto');
      if (settings?.race_date) {
        const rd = new Date(settings.race_date + 'T00:00:00');
        const daysLeft = Math.ceil((rd - new Date().setHours(0,0,0,0)) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 90)
          setRaceCountdown({ days: daysLeft, name: settings.race_name || settings.race_distance || 'Race' });
      }
      if (settings?.last_checkin_date !== today) {
        setShowCheckIn(true);
      } else if (settings?.last_checkin_data) {
        setCheckInData(settings.last_checkin_data);
        const score = await calculateReadinessScore(settings.last_checkin_data, workouts, getNutritionLog, user.id);
        setReadinessScore(score);
      }
    }
    checkTrigger();
  }, [user, isLoaded, workouts]);

  useEffect(() => {
    if (!user) return;
    async function loadNutrition() {
      const [log, settings] = await Promise.all([getNutritionLog(user.id, today), getUserSettings(user.id)]);
      const meals = log?.meals || [];
      setTodayCalories(meals.reduce((s, e) => s + (e.calories || 0), 0));
      setTodayCalTarget(settings?.calorie_target || 2000);
    }
    loadNutrition();
  }, [user, today]);

  async function handleCheckInComplete(data) {
    setCheckInData(data);
    const score = await calculateReadinessScore(data, workouts, getNutritionLog, user.id);
    setReadinessScore(score);
    setShowCheckIn(false);
    if (user) await updateUserSettings(user.id, { last_checkin_date: data.date, last_checkin_data: data });
  }

  const trainingProfile = useMemo(() => {
    const computed = getUserTrainingProfile(workouts);
    if (trainingTypeOverride !== 'auto') return { ...computed, primaryType: trainingTypeOverride };
    return computed;
  }, [workouts, trainingTypeOverride]);

  const allInsights  = useMemo(() => generateInsights(workouts, trainingProfile), [workouts, trainingProfile]);
  const trainingLoad = useMemo(() => calculateTrainingLoad(workouts), [workouts]);

  const runnerStats = useMemo(() => {
    const completedRuns = workouts
      .filter(w => w.type === 'run' && w.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    const monthRuns = completedRuns.filter(w => w.date >= monthStart);
    const totalMilesMonth = parseFloat(monthRuns.reduce((s, w) => s + (w.details.actualDistance || 0), 0).toFixed(1));
    const longestRunMonth = parseFloat(Math.max(...monthRuns.map(w => w.details.actualDistance || 0), 0).toFixed(1));
    const last3 = completedRuns.slice(0, 3).filter(w => w.details.actualPace);
    let avgPace = null;
    if (last3.length > 0) {
      const totalSecs = last3.reduce((s, w) => {
        const parts = (w.details.actualPace || '').split(':');
        return s + (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      }, 0);
      const avg = totalSecs / last3.length;
      avgPace = `${Math.floor(avg / 60)}:${String(Math.round(avg % 60)).padStart(2, '0')}`;
    }
    const weeklyMiles = getWeeklyData(completedRuns, w => w.details.actualDistance || 0);
    return { totalMilesMonth, longestRunMonth, avgPace, weeklyMiles };
  }, [workouts]);

  const lifterStats = useMemo(() => {
    const completedLifts = workouts
      .filter(w => w.type === 'lift' && w.status === 'completed')
      .sort((a, b) => a.date.localeCompare(b.date));
    // Top exercises by e1RM (Epley formula)
    const e1rmMap = {};
    completedLifts.forEach(w => {
      (w.details.exercises || []).forEach(ex => {
        if (!ex.name) return;
        (Array.isArray(ex.sets) ? ex.sets : []).filter(s => s.completed && s.weight && s.reps).forEach(s => {
          const e1rm = Number(s.weight) * (1 + Number(s.reps) / 30);
          if (!e1rmMap[ex.name] || e1rm > e1rmMap[ex.name]) e1rmMap[ex.name] = e1rm;
        });
      });
    });
    const topExercises = Object.entries(e1rmMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, e1rm]) => ({ name, e1rm: Math.round(e1rm) }));
    // Volume trend
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(mon.getDate() + (dow === 0 ? -6 : 1 - dow)); mon.setHours(0,0,0,0);
    const monStr = mon.toLocaleDateString('en-CA');
    const sunStr = new Date(mon.getTime() + 6*86400000).toLocaleDateString('en-CA');
    const lastMonStr = new Date(mon.getTime() - 7*86400000).toLocaleDateString('en-CA');
    const lastSunStr = new Date(mon.getTime() - 1).toLocaleDateString('en-CA');
    const thisWeekVol = completedLifts.filter(w => w.date >= monStr && w.date <= sunStr).reduce((s,w) => s+(w.details.totalVolume||0), 0);
    const lastWeekVol = completedLifts.filter(w => w.date >= lastMonStr && w.date <= lastSunStr).reduce((s,w) => s+(w.details.totalVolume||0), 0);
    const volTrend = lastWeekVol > 0 ? Math.round(((thisWeekVol - lastWeekVol) / lastWeekVol) * 100) : null;
    // Progressive overload streak (chronological)
    const prevBest = {};
    let streak = 0;
    for (const w of completedLifts) {
      let improved = false; let hadComparison = false;
      const thisBest = {};
      (w.details.exercises || []).forEach(ex => {
        const sets = (Array.isArray(ex.sets) ? ex.sets : []).filter(s => s.completed && s.weight && s.reps);
        if (!sets.length) return;
        const maxW = Math.max(...sets.map(s => Number(s.weight)));
        const maxR = Math.max(...sets.map(s => Number(s.reps)));
        thisBest[ex.name] = { weight: maxW, reps: maxR };
        const prev = prevBest[ex.name];
        if (prev) { hadComparison = true; if (maxW > prev.weight || (maxW === prev.weight && maxR > prev.reps)) improved = true; }
      });
      Object.entries(thisBest).forEach(([n, d]) => { prevBest[n] = d; });
      if (hadComparison) { if (improved) streak++; else streak = 0; }
    }
    return { topExercises, volTrend, thisWeekVol, lastWeekVol, streak };
  }, [workouts]);
  const visibleInsights     = useMemo(() =>
    allInsights.filter(i =>
      !dismissedInsights.has(i.id) &&
      !permanentDismissed.has(i.id) &&
      !(i.category && permanentDismissed.has(i.category))
    ),
  [allInsights, dismissedInsights, permanentDismissed]);
  const warningInsights     = useMemo(() => visibleInsights.filter(i => i.type === 'warning'),    [visibleInsights]);
  const suggestionInsights  = useMemo(() => visibleInsights.filter(i => i.type === 'suggestion'), [visibleInsights]);
  const infoInsights        = useMemo(() => visibleInsights.filter(i => i.type === 'info'),       [visibleInsights]);

  const todayLiftAdjustments = useMemo(() => {
    const plannedLift = workouts.find(w => w.date === today && w.type === 'lift' && w.status === 'planned');
    if (!plannedLift) return [];
    return generateLiftAdjustments(workouts, plannedLift);
  }, [workouts, today]);

  const skipInsights = useMemo(() => analyzeSkips(workouts).filter(i => !dismissedSkips.has(i.id)), [workouts, dismissedSkips]);
  const skipStats    = useMemo(() => computeWeeklySkipRate(workouts), [workouts]);

  async function handleRescue(insight) {
    const rescue = insight.action?.rescue;
    const skip   = insight.action?.skipWorkout;
    if (!rescue || !skip?.id) return;

    // Update the existing skipped workout row — move it to the new date
    // This keeps a single DB row, avoids duplicate skip insights
    const success = await rescheduleWorkout(skip.id, rescue.date);
    if (!success) return;

    // Dismiss the insight now that it's been acted on
    setDismissedSkips(prev => {
      const next = new Set([...prev, insight.id]);
      try {
        localStorage.setItem('bc-dismissed-skips', JSON.stringify({
          date: new Date().toLocaleDateString('en-CA'),
          ids: [...next],
        }));
      } catch {}
      return next;
    });
  }

  const stats = useMemo(() => {
    const runs  = workouts.filter(w => w.type === 'run');
    const lifts = workouts.filter(w => w.type === 'lift');
    const completedRuns  = runs.filter(w => w.status === 'completed');
    const completedLifts = lifts.filter(w => w.status === 'completed');
    const plannedRuns    = runs.filter(w => w.status !== 'skipped');
    const plannedLifts   = lifts.filter(w => w.status !== 'skipped');

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sundayStr = new Date(monday.getTime() + 6 * 86400000).toLocaleDateString('en-CA');
    const mondayStr = monday.toLocaleDateString('en-CA');
    const todayStr  = getLocalToday();

    const weekDays = ['M','T','W','T','F','S','S'];

    const thisWeekRunProgress = weekDays.map((label, i) => {
      const date = new Date(monday); date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayRuns = runs.filter(w => w.date === dateStr);
      return { label, planned: dayRuns.some(w=>w.status==='planned'), completed: dayRuns.some(w=>w.status==='completed'), skipped: dayRuns.every(w=>w.status==='skipped')&&dayRuns.length>0, isToday: dateStr===todayStr, isFuture: dateStr>todayStr };
    });

    const thisWeekLiftProgress = weekDays.map((label, i) => {
      const date = new Date(monday); date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayLifts = lifts.filter(w => w.date === dateStr);
      return { label, planned: dayLifts.some(w=>w.status==='planned'), completed: dayLifts.some(w=>w.status==='completed'), skipped: dayLifts.every(w=>w.status==='skipped')&&dayLifts.length>0, isToday: dateStr===todayStr, isFuture: dateStr>todayStr };
    });

    const thisWeekRunsCompleted  = thisWeekRunProgress.filter(d=>d.completed).length;
    const thisWeekRunsPlanned    = thisWeekRunProgress.filter(d=>d.planned||d.completed||d.skipped).length;
    const thisWeekLiftsCompleted = thisWeekLiftProgress.filter(d=>d.completed).length;
    const thisWeekLiftsPlanned   = thisWeekLiftProgress.filter(d=>d.planned||d.completed||d.skipped).length;

    const thisWeekRuns  = completedRuns.filter(w=>w.date>=mondayStr&&w.date<=sundayStr);
    const thisWeekLifts = completedLifts.filter(w=>w.date>=mondayStr&&w.date<=sundayStr);
    const thisWeekMiles = thisWeekRuns.reduce((s,w)=>s+(w.details.actualDistance||0),0);
    const thisWeekVol   = thisWeekLifts.reduce((s,w)=>s+(w.details.totalVolume||0),0);

    const thisWeekWorkouts = workouts.filter(w=>w.date>=mondayStr&&w.date<=sundayStr);

    // Current plan week number — from workouts in this calendar week
    const currentWeekNumber = thisWeekWorkouts.find(w=>w.details?.weekNumber)?.details?.weekNumber || null;

    // Planned miles: runs in this calendar week that aren't skipped
    // If we have a week number, also exclude any runs from a DIFFERENT week number
    // (catches orphaned duplicate rows from old reschedules that landed in this week)
    const thisWeekPlannedRuns = runs.filter(w => {
      if (w.date < mondayStr || w.date > sundayStr) return false;
      if (w.status === 'skipped') return false;
      // If this run has a weekNumber that doesn't match current week, it's an orphan
      if (currentWeekNumber && w.details?.weekNumber && w.details.weekNumber !== currentWeekNumber) return false;
      return true;
    });
    const thisWeekPlannedMiles = thisWeekPlannedRuns.reduce((s,w)=>s+(w.details.plannedDistance||0),0);

    const phaseCounts = {};
    thisWeekWorkouts.forEach(w=>{ const p=w.details?.phase; if(p) phaseCounts[p]=(phaseCounts[p]||0)+1; });
    const currentPhase = Object.keys(phaseCounts).sort((a,b)=>phaseCounts[b]-phaseCounts[a])[0]||null;

    const phaseRuns  = currentPhase ? runs.filter(w=>w.details?.phase===currentPhase) : [];
    const phaseLifts = currentPhase ? lifts.filter(w=>w.details?.phase===currentPhase) : [];
    const phaseRunsDone   = phaseRuns.filter(w=>w.status==='completed').length;
    const phaseRunsTotal  = phaseRuns.length;
    const phaseLiftsDone  = phaseLifts.filter(w=>w.status==='completed').length;
    const phaseLiftsTotal = phaseLifts.filter(w=>w.status!=='skipped').length;
    const phaseRunsPast   = phaseRuns.filter(w=>w.date<=todayStr&&w.status!=='planned').length;
    const phaseRunRate    = phaseRunsPast>0 ? Math.round((phaseRunsDone/phaseRunsPast)*100) : 100;
    const phaseLiftRate   = phaseLiftsTotal>0 ? Math.round((phaseLiftsDone/phaseLiftsTotal)*100) : 0;
    const weekNumber      = thisWeekWorkouts[0]?.details?.weekNumber||null;

    return {
      runCompletionRate: plannedRuns.length>0?Math.round((completedRuns.length/plannedRuns.length)*100):0,
      liftCompletionRate: plannedLifts.length>0?Math.round((completedLifts.length/plannedLifts.length)*100):0,
      completedRuns: completedRuns.length, totalRuns: plannedRuns.length,
      completedLifts: completedLifts.length, totalLifts: plannedLifts.length,
      thisWeekRunsCompleted, thisWeekRunsPlanned, thisWeekLiftsCompleted, thisWeekLiftsPlanned,
      thisWeekMiles: parseFloat(thisWeekMiles.toFixed(1)),
      thisWeekPlannedMiles: parseFloat(thisWeekPlannedMiles.toFixed(1)),
      thisWeekVol, thisWeekRunProgress, thisWeekLiftProgress,
      currentPhase, weekNumber,
      phaseRunRate, phaseRunsDone, phaseRunsTotal,
      phaseLiftRate, phaseLiftsDone, phaseLiftsTotal,
      weeklyMileageData: getWeeklyData(completedRuns,  w=>w.details.actualDistance||0),
      weeklyVolumeData:  getWeeklyData(completedLifts, w=>w.details.totalVolume||0),
      currentWeekMileage: (getWeeklyData(completedRuns,w=>w.details.actualDistance||0)[3]||0).toFixed(1),
      currentWeekVolume:  getWeeklyData(completedLifts,w=>w.details.totalVolume||0)[3]||0,
      streak: calculateStreak(workouts),

      weeklyHistory: (() => {
        const weeks = [];
        for (let weeksAgo=3; weeksAgo>=0; weeksAgo--) {
          const wEnd   = new Date(monday); wEnd.setDate(monday.getDate()-weeksAgo*7+6);
          const wStart = new Date(monday); wStart.setDate(monday.getDate()-weeksAgo*7);
          const wEndStr=wEnd.toLocaleDateString('en-CA'), wStartStr=wStart.toLocaleDateString('en-CA');
          const isCurrent = weeksAgo===0;
          const label = isCurrent?'This week':weeksAgo===1?'Last week':`${weeksAgo}w ago`;
          const dateRange = `${wStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${wEnd.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
          const wRuns  = runs.filter(w=>w.date>=wStartStr&&w.date<=wEndStr);
          const wLifts = lifts.filter(w=>w.date>=wStartStr&&w.date<=wEndStr);
          const wRunsDone=wRuns.filter(w=>w.status==='completed').length, wRunsPlanned=wRuns.filter(w=>w.status!=='skipped').length;
          const wMiles=wRuns.filter(w=>w.status==='completed').reduce((s,w)=>s+(w.details.actualDistance||0),0);
          const DAY_LABELS=['M','T','W','T','F','S','S'];
          const runDots=DAY_LABELS.map((label,i)=>{const d=new Date(wStart);d.setDate(wStart.getDate()+i);const dStr=d.toLocaleDateString('en-CA');const dayRuns=wRuns.filter(w=>w.date===dStr);return{label,completed:dayRuns.some(w=>w.status==='completed'),skipped:dayRuns.some(w=>w.status==='skipped'),planned:dayRuns.some(w=>w.status==='planned'),isToday:dStr===todayStr,isFuture:dStr>todayStr};});
          const wLiftsDone=wLifts.filter(w=>w.status==='completed').length, wLiftsPlanned=wLifts.filter(w=>w.status!=='skipped').length;
          const wVol=wLifts.filter(w=>w.status==='completed').reduce((s,w)=>s+(w.details.totalVolume||0),0);
          const liftDots=DAY_LABELS.map((label,i)=>{const d=new Date(wStart);d.setDate(wStart.getDate()+i);const dStr=d.toLocaleDateString('en-CA');const dayLifts=wLifts.filter(w=>w.date===dStr);return{label,completed:dayLifts.some(w=>w.status==='completed'),skipped:dayLifts.some(w=>w.status==='skipped'),planned:dayLifts.some(w=>w.status==='planned'),isToday:dStr===todayStr,isFuture:dStr>todayStr};});
          const wPastRuns=wRuns.filter(w=>w.date<=todayStr&&w.status!=='planned');
          const wRunAdherence=wPastRuns.length>0?Math.round((wRunsDone/wPastRuns.length)*100):null;
          const DAY_FULL=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          const dailyMiles=DAY_FULL.map((d,i)=>{const dt=new Date(wStart);dt.setDate(wStart.getDate()+i);const dStr=dt.toLocaleDateString('en-CA');const dayRuns=wRuns.filter(w=>w.date===dStr&&w.status==='completed');return{day:d,value:parseFloat(dayRuns.reduce((s,w)=>s+(w.details.actualDistance||0),0).toFixed(1))};});
          const dailyVolume=DAY_FULL.map((d,i)=>{const dt=new Date(wStart);dt.setDate(wStart.getDate()+i);const dStr=dt.toLocaleDateString('en-CA');const dayLifts=wLifts.filter(w=>w.date===dStr&&w.status==='completed');return{day:d,value:Math.round(dayLifts.reduce((s,w)=>s+(w.details.totalVolume||0),0))};});
          weeks.push({label,dateRange,isCurrent,runsDone:wRunsDone,runsPlanned:wRunsPlanned,miles:parseFloat(wMiles.toFixed(1)),runAdherence:wRunAdherence,runDots,liftsDone:wLiftsDone,liftsPlanned:wLiftsPlanned,volume:wVol,liftDots,dailyMiles,dailyVolume});
        }
        return weeks;
      })(),

      ...(() => {
        if (!currentPhase) return { phaseRunAdherence:null, phaseRunAdherenceTrend:[null,null,null,null], phaseRunsSkipped:0 };
        const phaseAllRuns=runs.filter(w=>w.details?.phase===currentPhase);
        const pastPhaseRuns=phaseAllRuns.filter(w=>w.date<=todayStr&&w.status!=='planned');
        const phDone=pastPhaseRuns.filter(w=>w.status==='completed').length;
        const phSkipped=pastPhaseRuns.filter(w=>w.status==='skipped').length;
        const phPast=phDone+phSkipped;
        const adherence=phPast>0?Math.round((phDone/phPast)*100):null;
        const trend=[0,1,2,3].map(weeksAgo=>{
          const wEnd=new Date(monday);wEnd.setDate(monday.getDate()-weeksAgo*7+6);
          const wStart=new Date(monday);wStart.setDate(monday.getDate()-weeksAgo*7);
          const wRuns=phaseAllRuns.filter(w=>w.date>=wStart.toLocaleDateString('en-CA')&&w.date<=wEnd.toLocaleDateString('en-CA')&&w.status!=='planned');
          const wDone=wRuns.filter(w=>w.status==='completed').length;
          const wTotal=wDone+wRuns.filter(w=>w.status==='skipped').length;
          return wTotal>0?Math.round((wDone/wTotal)*100):null;
        }).reverse();
        return { phaseRunAdherence:adherence, phaseRunAdherenceTrend:trend, phaseRunsSkipped:phSkipped, phaseRunsPast:phPast };
      })(),
    };
  }, [workouts]);

  const todayWorkouts = useMemo(() => workouts.filter(w=>w.date===today&&w.type!=='rest'), [workouts,today]);

  // FIX 3: group recent activity by day
  const recentActivityByDay = useMemo(() => {
    const completed = workouts.filter(w=>w.status==='completed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,21);
    const byDay = {};
    completed.forEach(w => {
      if (!byDay[w.date]) byDay[w.date] = [];
      byDay[w.date].push(w);
    });
    return Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a)).slice(0,7);
  }, [workouts]);

  const weeklyChartData = useMemo(() => buildWeeklyChartData(workouts, chartWeekOffset), [workouts, chartWeekOffset]);
  const fuelStatus = getFuelStatus(todayCalories, todayCalTarget);

  const isLifter = trainingProfile.primaryType === 'lifter';
  const isRunner = trainingProfile.primaryType === 'runner';
  const isNew    = trainingProfile.primaryType === 'new';

  // Default Training Load chart to 'lifts' for lifter profile
  useEffect(() => {
    if (isLifter) setKpiToggle(prev => prev === 'both' ? 'lifts' : prev);
  }, [isLifter]);

  function handlePermanentDismiss(insight) {
    const key = insight.category || insight.id;
    setPermanentDismissed(prev => {
      const next = new Set([...prev, key]);
      try { localStorage.setItem('bc-dismissed-permanent', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function handleSave(data) {
    saveWorkout(data);
    if (data.status==='completed') setJustLogged(data);
    setLogTarget(null);
  }

  if (!isLoaded) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-tertiary text-sm">Loading...</p></div>;

  if (workouts.length===0) {
    return (
      <div className="max-w-lg mx-auto px-1 py-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center mx-auto mb-4"><Sparkles size={28} className="text-bc-indigo" /></div>
          <h1 className="text-[22px] font-bold text-primary mb-2">Welcome to BaseCamp</h1>
          <p className="text-sm text-secondary leading-relaxed max-w-sm mx-auto">Your multimodal fitness OS. One app for every run, lift, and cardio session — with AI that understands how they all interact.</p>
        </div>
        <div className="space-y-3 mb-6">
          <a href="/plans" className="flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow no-underline">
            <div className="w-12 h-12 rounded-[14px] bg-bc-indigo-light flex items-center justify-center flex-shrink-0"><Sparkles size={22} className="text-bc-indigo" /></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-primary">Generate your training plan</p><p className="text-xs text-secondary mt-0.5">AI builds a plan around your schedule, race goal, and experience level</p></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
          <button onClick={()=>setLogTarget({type:'run',status:'planned',date:today,details:{}})} className="w-full flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 rounded-[14px] bg-run-bg flex items-center justify-center flex-shrink-0"><RunTypeIcon runType="easy" size={22}/></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-primary">Log your first workout</p><p className="text-xs text-secondary mt-0.5">Run, lift, or cardio — BaseCamp tracks everything in one place</p></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <a href="/goals" className="flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow no-underline">
            <div className="w-12 h-12 rounded-[14px] bg-bc-orange-light flex items-center justify-center flex-shrink-0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-primary">Set your training goals</p><p className="text-xs text-secondary mt-0.5">Race targets, weekly mileage, strength milestones</p></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
        <div className="p-4 bg-bc-indigo-light/60 rounded-[16px] border border-bc-indigo/10">
          <p className="text-xs font-semibold text-bc-indigo-dark mb-1.5">Why BaseCamp is different</p>
          <p className="text-xs text-bc-indigo-dark/80 leading-relaxed">Most apps only track one thing. BaseCamp understands the interference effect — how your Tuesday leg day affects your Wednesday tempo run. It&apos;s the only app built for athletes who do more than one thing.</p>
        </div>
        {logTarget && <LogForm workout={logTarget} onSave={handleSave} onClose={()=>setLogTarget(null)}/>}
      </div>
    );
  }

  return (
    <div>
      {/* Post-workout share prompt */}
      {justLogged && (
        <div className="bc-card mb-6 border-l-4 border-bc-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bc-green-light flex items-center justify-center"><StatusIcon status="completed" size={16}/></div>
              <div><p className="text-sm font-semibold text-primary">Workout logged!</p><p className="bc-caption">{justLogged.type==='run'&&justLogged.details.actualDistance?`${justLogged.details.actualDistance} mi run`:justLogged.type==='lift'&&justLogged.details.sessionName?justLogged.details.sessionName:'Great session'}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <ShareWorkoutButton workout={justLogged} userName={user?.display_name||user?.email?.split('@')[0]||''} deepLinkUrl={`https://basecamp.fit/workout/${justLogged.id}`} onShareComplete={(w)=>incrementShareCount(w.id)} variant="button"/>
              <button onClick={()=>setJustLogged(null)} className="text-tertiary hover:text-secondary text-xs min-h-[44px] px-2">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Adaptations */}
      {adaptations?.filter(a=>a.status==='pending').length>0 && (
        <div className="mb-6">
          <button onClick={()=>{const next=!adaptationsSectionCollapsed;setAdaptationsSectionCollapsed(next);if(next)localStorage.setItem('bc-adaptations-dismissed',JSON.stringify({date:today}));else localStorage.removeItem('bc-adaptations-dismissed');}} className="flex items-center gap-2 mb-3 w-full group min-h-[44px]">
            <Sparkles size={14} className="text-bc-indigo"/>
            <p className="bc-caption uppercase tracking-wider">Plan Adaptations</p>
            <span className="bc-pill bg-bc-indigo-light text-bc-indigo-dark text-[10px]">{adaptations.filter(a=>a.status==='pending').length} pending</span>
            <span className="ml-auto bc-caption group-hover:text-primary transition-colors">{adaptationsSectionCollapsed?'Show':'Hide'}</span>
          </button>
          {!adaptationsSectionCollapsed && <PlanAdaptationList adaptations={adaptations} onAccept={acceptAdaptation} onReject={rejectAdaptation}/>}
        </div>
      )}

      {/* Skip Intelligence */}
      {skipInsights.length>0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><p className="bc-caption uppercase tracking-wider">Skipped Sessions</p><span className="bc-pill bg-bc-red-light text-bc-red-dark text-[10px]">{skipInsights.length} impact{skipInsights.length!==1?'s':''}</span></div>
            {skipStats.phaseRisk&&<span className="text-[10px] font-semibold text-bc-red-dark">{skipStats.phaseRisk.projected}% projected · target 80%</span>}
          </div>
          <div className="space-y-3">
            {skipInsights.map(insight=>(
              <SkipInsightCard key={insight.id} insight={insight}
                onDismiss={id=>{setDismissedSkips(prev=>{const next=new Set([...prev,id]);try{localStorage.setItem('bc-dismissed-skips',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                onRescue={handleRescue}/>
            ))}
          </div>
          {skipStats.skipRate>=20&&<div className="mt-3 p-3 bg-bc-orange-light rounded-[12px] border border-bc-orange/20"><p className="text-xs font-semibold text-bc-orange-dark">{skipStats.skipRate}% skip rate this week ({skipStats.skippedThisWeek}/{skipStats.plannedThisWeek} sessions)</p><p className="bc-caption mt-0.5">{skipStats.onTrack?'Still within acceptable range — keep going.':'Above 20% — consider adjusting your schedule or reducing load.'}</p></div>}
        </div>
      )}

      {/* Cross-Training Insights — split by urgency */}
      {visibleInsights.length > 0 && (
        <div className="mb-6">
          {/* Header */}
          <button
            onClick={()=>{const next=!insightsSectionCollapsed;setInsightsSectionCollapsed(next);if(next)localStorage.setItem('bc-insights-dismissed',JSON.stringify({date:today}));else localStorage.removeItem('bc-insights-dismissed');}}
            className="flex items-center justify-between w-full mb-3 group min-h-[44px]">
            <div className="flex items-center gap-2">
              <p className="bc-caption uppercase tracking-wider">Training Insights</p>
              {warningInsights.length > 0 && (
                <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
                  {warningInsights.length} warning{warningInsights.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="bc-caption group-hover:text-primary transition-colors">
              {insightsSectionCollapsed ? 'Show' : 'Hide'}
            </span>
          </button>

          {!insightsSectionCollapsed && (
            <div className="space-y-4">
              {/* Active Warnings */}
              {warningInsights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-bc-orange-dark" />
                    <p className="text-[10px] font-bold text-bc-orange-dark uppercase tracking-wider">Active Warnings</p>
                  </div>
                  {warningInsights.map(insight => (
                    <InsightCard key={insight.id} insight={insight}
                      onDismiss={id=>{setDismissedInsights(prev=>{const next=new Set([...prev,id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                      onAction={i=>{setDismissedInsights(prev=>{const next=new Set([...prev,i.id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                      onPermanentDismiss={handlePermanentDismiss}/>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {suggestionInsights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={11} className="text-bc-blue" />
                    <p className="text-[10px] font-bold text-bc-blue uppercase tracking-wider">Suggestions</p>
                  </div>
                  {suggestionInsights.map(insight => (
                    <InsightCard key={insight.id} insight={insight}
                      onDismiss={id=>{setDismissedInsights(prev=>{const next=new Set([...prev,id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                      onAction={i=>{setDismissedInsights(prev=>{const next=new Set([...prev,i.id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                      onPermanentDismiss={handlePermanentDismiss}/>
                  ))}
                </div>
              )}

              {/* Training Notes — collapsed by default */}
              {infoInsights.length > 0 && (
                <div>
                  <button onClick={() => setInfoNotesOpen(v => !v)}
                    className="flex items-center gap-2 min-h-[36px] w-full text-left">
                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">
                      Training Notes
                    </p>
                    <span className="bc-pill bg-canvas border border-border text-tertiary text-[10px]">
                      {infoInsights.length}
                    </span>
                    <span className="bc-caption ml-auto">{infoNotesOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {infoNotesOpen && (
                    <div className="space-y-3 mt-2">
                      {infoInsights.map(insight => (
                        <InsightCard key={insight.id} insight={insight}
                          onDismiss={id=>{setDismissedInsights(prev=>{const next=new Set([...prev,id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                          onAction={i=>{setDismissedInsights(prev=>{const next=new Set([...prev,i.id]);try{localStorage.setItem('bc-dismissed-insights',JSON.stringify({weekKey:getWeekKey(),ids:[...next]}))}catch{}return next;});}}
                          onPermanentDismiss={handlePermanentDismiss}/>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding prompt — new users only */}
      {isNew && !dismissedOnboarding && (
        <div className="bc-card mb-6 p-5">
          <p className="text-[15px] font-semibold text-primary mb-1">What best describes your training?</p>
          <p className="bc-caption mb-4">BaseCamp adapts the dashboard and plans to your sport.</p>
          <div className="space-y-2">
            {[
              { value: 'runner', label: "I'm a runner",   Icon: Footprints, bg: 'bg-run-bg',         border: 'border-run-accent/30',  color: 'text-run-accent' },
              { value: 'lifter', label: 'I lift weights',  Icon: Dumbbell,   bg: 'bg-lift-bg',        border: 'border-lift-accent/30', color: 'text-lift-accent' },
              { value: 'hybrid', label: 'I do both',       Icon: Zap,        bg: 'bg-bc-indigo-light', border: 'border-bc-indigo/30',   color: 'text-bc-indigo' },
            ].map(({ value, label, Icon, bg, border, color }) => (
              <button key={value}
                onClick={async () => {
                  setTrainingTypeOverride(value);
                  setDismissedOnboarding(true);
                  if (user) await updateUserSettings(user.id, { training_type: value });
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-[16px] border ${border} ${bg} active:scale-95 transition-all min-h-[56px]`}>
                <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className={color} strokeWidth={2} />
                </div>
                <span className={`text-sm font-semibold ${color}`}>{label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setDismissedOnboarding(true)}
            className="w-full text-center bc-caption mt-3 py-2 hover:text-secondary transition-colors min-h-[44px]">
            Skip for now
          </button>
        </div>
      )}

      {/* Race countdown banner */}
      {raceCountdown && (
        <a href="/goals" className="flex items-center gap-2 px-4 py-2.5 mb-2 rounded-[12px] bg-run-bg border border-run-accent/20 no-underline">
          <Flag size={12} className="text-run-accent flex-shrink-0"/>
          <span className="text-xs font-semibold text-run-accent">{raceCountdown.name}</span>
          <span className="bc-caption ml-auto">{raceCountdown.days === 0 ? 'Today!' : `${raceCountdown.days} days`}</span>
        </a>
      )}

      {/* Today's Plan */}
      <div className="bc-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="bc-caption uppercase tracking-wider mb-0">Today&apos;s Plan</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor:fuelStatus.color}}/><span className="text-[10px] text-tertiary">{fuelStatus.label}</span></div>
            <span className="text-xs text-tertiary">·</span>
            <span className="text-xs text-secondary">{formatDate(today)}</span>
          </div>
        </div>
        {todayWorkouts.length>0 ? (
          <div className="space-y-3">
            {todayWorkouts.map(w=>(
              <div key={w.id} className={`flex items-center justify-between p-3 rounded-[14px] border-l-4 ${w.type==='run'?'border-run-accent bg-run-bg':w.type==='lift'?'border-lift-accent bg-lift-bg':w.type==='cardio'?'border-cardio-accent bg-cardio-bg':'border-border bg-canvas'} ${w.status==='completed'?'opacity-70':''}`}>
                <div className="flex items-center gap-3">
                  {w.status==='planned'&&<div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:fuelStatus.color}}/>}
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">{w.type==='run'?<RunTypeIcon runType={w.details.runType} size={18}/>:<LiftSessionIcon sessionName={w.details.sessionName} size={18}/>}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{w.type==='run'?(w.details.runDescription||w.details.runType||'Run'):(w.details.sessionName||'Lift')}</p>
                    <p className="text-xs text-secondary">{w.type==='run'&&w.details.plannedDistance&&<>{w.details.plannedDistance} mi{w.details.targetPace?` @ ${w.details.targetPace}`:''}</>}{w.type==='lift'&&(w.details.muscleGroups||[]).slice(0,3).join(', ')}{w.type==='cardio'&&(w.details.activityType||'Cardio')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {w.status==='planned'?
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={()=>setLogTarget(w)} className="bc-btn-log min-h-[44px]">Log It</button>
                      {w.type==='lift'&&todayLiftAdjustments.length>0&&(
                        <button onClick={()=>setLogTarget(w)}
                          className="flex items-center gap-1 text-[9px] font-semibold text-bc-orange-dark hover:opacity-70 transition-opacity">
                          <AlertTriangle size={9}/>{todayLiftAdjustments.length} adj
                        </button>
                      )}
                    </div>
                  :<><ShareWorkoutButton workout={w} userName={user?.display_name||user?.email?.split('@')[0]||''} deepLinkUrl={`https://basecamp.fit/workout/${w.id}`} onShareComplete={(wk)=>incrementShareCount(wk.id)} variant="icon"/><span className="bc-pill bg-bc-green-light text-bc-green-dark text-xs flex items-center gap-1"><StatusIcon status="completed" size={10}/> Done</span></>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4">
            <p className="text-sm text-secondary mb-3">Nothing scheduled today.</p>
            <div className="grid grid-cols-2 gap-2">
              {isRunner ? (<>
                <button onClick={()=>setLogTarget({type:'run',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-run-bg border border-run-accent/20 active:scale-95 transition-all"><Footprints size={16} className="text-run-accent" strokeWidth={2}/><span className="text-xs font-semibold text-run-accent">Log a Run</span></button>
                <button onClick={()=>setLogTarget({type:'cardio',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-cardio-bg border border-cardio-accent/20 active:scale-95 transition-all"><Activity size={16} className="text-cardio-accent" strokeWidth={2}/><span className="text-xs font-semibold text-cardio-accent">Log Cardio</span></button>
              </>) : isLifter ? (<>
                <button onClick={()=>setLogTarget({type:'lift',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-lift-bg border border-lift-accent/20 active:scale-95 transition-all"><Dumbbell size={16} className="text-lift-accent" strokeWidth={2}/><span className="text-xs font-semibold text-lift-accent">Log a Lift</span></button>
                <button onClick={()=>setLogTarget({type:'cardio',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-cardio-bg border border-cardio-accent/20 active:scale-95 transition-all"><Activity size={16} className="text-cardio-accent" strokeWidth={2}/><span className="text-xs font-semibold text-cardio-accent">Log Cardio</span></button>
              </>) : (<>
                <button onClick={()=>setLogTarget({type:'run',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-run-bg border border-run-accent/20 active:scale-95 transition-all"><RunTypeIcon runType="easy" size={16}/><span className="text-xs font-semibold text-run-accent">Log a Run</span></button>
                <button onClick={()=>setLogTarget({type:'lift',status:'planned',date:today,details:{}})} className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-lift-bg border border-lift-accent/20 active:scale-95 transition-all"><LiftSessionIcon sessionName="" size={16}/><span className="text-xs font-semibold text-lift-accent">Log a Lift</span></button>
              </>)}
            </div>
          </div>
        )}
      </div>

      {/* Readiness Score */}
      {readinessScore!==null && (
        <div className="bc-card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full" style={{transform:'rotate(-90deg)'}}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#F2F2F7" strokeWidth="6"/>
                  <circle cx="32" cy="32" r="26" fill="none" stroke={getReadinessColor(readinessScore)} strokeWidth="6" strokeLinecap="round" strokeDasharray="163.36" strokeDashoffset={163.36*(1-readinessScore/100)}/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center"><span className="bc-data text-base font-bold" style={{color:getReadinessColor(readinessScore)}}>{readinessScore}</span></div>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-primary">{getReadinessLabel(readinessScore)}</p>
                {checkInData&&<p className="bc-caption mt-0.5">{checkInData.sleepHours}h sleep · Energy {checkInData.energyLevel}/5 · Soreness {checkInData.soreness}/5</p>}
              </div>
            </div>
            <button onClick={()=>setShowCheckIn(true)} className="bc-btn-secondary !text-xs !py-1.5 !px-3 min-h-[44px]">Update</button>
          </div>
          {shouldSuggestSwap(readinessScore,todayWorkouts)&&(
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-bc-orange-light flex items-center justify-center flex-shrink-0 mt-0.5"><span style={{color:'#FF9500',fontSize:'10px',fontWeight:700}}>!</span></div>
              <div><p className="text-xs font-semibold" style={{color:'#E65100'}}>Consider swapping today&apos;s hard session</p><p className="bc-caption mt-0.5">Your readiness is low. An easy run or rest day would help recovery.</p></div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="bc-caption uppercase tracking-wider">Performance</p>
          {stats.currentPhase&&<span className="bc-pill bg-canvas border border-border text-tertiary text-[10px] capitalize">{stats.currentPhase} phase{stats.weekNumber?` · Wk ${stats.weekNumber}`:''}</span>}
        </div>
      </div>
      <div className="bento-grid mb-6">

        {/* Slot 1: Run card (runner/hybrid) OR Strength Stats (lifter) */}
        {isLifter ? (
          <div className="bc-card p-4 bento-half">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-lift-accent" />
              <p className="bc-caption uppercase tracking-wider">Strength Stats</p>
            </div>
            {lifterStats.topExercises.length > 0 ? (
              <div className="space-y-3">
                {lifterStats.volTrend !== null && (
                  <div>
                    <p className="bc-caption mb-0.5">Volume vs last week</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold" style={{color:lifterStats.volTrend>=0?'#34C759':'#FF9500',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em'}}>
                        {lifterStats.volTrend>=0?'+':''}{lifterStats.volTrend}%
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="bc-caption mb-1.5">Top lifts (e1RM)</p>
                  <div className="space-y-1.5">
                    {lifterStats.topExercises.map(ex => (
                      <div key={ex.name} className="flex items-center justify-between">
                        <span className="text-[10px] text-secondary truncate flex-1 pr-2">{ex.name}</span>
                        <span className="text-[10px] font-bold text-lift-accent flex-shrink-0" style={{fontVariantNumeric:'tabular-nums'}}>{ex.e1rm} lbs</span>
                      </div>
                    ))}
                  </div>
                </div>
                {lifterStats.streak > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                    <TrendingUp size={11} className="text-bc-green-dark" />
                    <span className="text-[10px] font-semibold text-bc-green-dark">{lifterStats.streak} sessions improving</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bc-caption">Log lifts to see strength stats.</p>
            )}
          </div>
        ) : (()=>{
          const wk=stats.weeklyHistory?.[runWeekIndex]; if(!wk) return null;
          const isCurrent=wk.isCurrent;
          const maxMiles=Math.max(...(wk.dailyMiles||[]).map(d=>d.value),0.1);
          return (
            <div className="bc-card p-4 bento-hero overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <button onClick={()=>{setRunWeekIndex(i=>Math.max(0,i-1));setRunExpanded(false);}} disabled={runWeekIndex===0} className="w-6 h-6 -ml-1 flex items-center justify-center rounded-full transition-opacity disabled:opacity-0" style={{color:'#AEAEB2'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div className="flex-1 text-center"><p className="bc-caption uppercase tracking-wider">{isCurrent?'This Week · Runs':`${wk.label} · Runs`}</p>{!isCurrent&&<p className="text-[9px] text-tertiary mt-0.5">{wk.dateRange}</p>}</div>
                <button onClick={()=>{setRunWeekIndex(i=>Math.min(3,i+1));setRunExpanded(false);}} disabled={runWeekIndex===3} className="w-6 h-6 -mr-1 flex items-center justify-center rounded-full transition-opacity disabled:opacity-0" style={{color:'#AEAEB2'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <button className="w-full mb-3 active:opacity-60 transition-opacity" onClick={()=>setRunExpanded(v=>!v)}>
                <div className="flex items-end gap-1" style={{height:runExpanded?56:28,transition:'height 0.25s ease'}}>
                  {wk.runDots.map((day,i)=>{
                    const miles=wk.dailyMiles[i]?.value||0,pct=maxMiles>0?miles/maxMiles:0;
                    const dotColor=day.completed?'#2E7D32':day.skipped?'#FFCDD2':day.planned?'#A5D6A7':day.isToday?'#E8F5E9':'#F2F2F7';
                    const barColor=day.isToday?'#2E7D32':miles>0?'#A5D6A7':'transparent';
                    const barH=runExpanded?Math.max(pct*40,miles>0?6:4):6;
                    return <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1"><span className="text-[8px] leading-none transition-opacity" style={{fontVariantNumeric:'tabular-nums',color:day.isToday?'#2E7D32':'#AEAEB2',opacity:runExpanded&&miles>0?1:0,height:runExpanded?'auto':0}}>{miles>0?miles:''}</span><div className="w-full rounded-t-[3px] transition-all duration-300" style={{height:barH,background:barH===6?dotColor:barColor,opacity:day.isFuture&&!day.planned?0.35:1}}/><span className="text-[8px] font-medium" style={{color:day.isToday?'#2E7D32':'#AEAEB2'}}>{day.label}</span></div>;
                  })}
                </div>
              </button>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="flex items-baseline gap-1.5"><span className="font-bold text-run-accent" style={{fontSize:'28px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>{wk.runsDone}</span><span className="text-sm text-tertiary">/ {wk.runsPlanned}</span></div>
                  {!isCurrent&&wk.runAdherence!==null&&<span className="text-[10px] font-semibold mt-0.5 block" style={{color:wk.runAdherence>=85?'#2E7D32':wk.runAdherence>=70?'#E65100':'#C62828'}}>{wk.runAdherence}% adherence</span>}
                </div>
                {wk.miles>0&&<div className="text-right"><div className="flex items-baseline gap-0.5 justify-end"><span className="font-bold text-primary" style={{fontSize:'22px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>{wk.miles}</span><span className="text-xs text-tertiary">{isCurrent&&stats.thisWeekPlannedMiles>0?`/${stats.thisWeekPlannedMiles} mi`:' mi'}</span></div></div>}
              </div>
              {isCurrent&&stats.currentPhase&&stats.phaseRunsTotal>0?(
                <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-tertiary capitalize">{stats.currentPhase} phase</span><span className="text-[10px] font-semibold text-run-accent">{stats.phaseRunsDone}/{stats.phaseRunsTotal} runs · {Math.round((stats.phaseRunsDone/stats.phaseRunsTotal)*100)}%</span></div><div className="h-1 w-full bg-canvas rounded-full overflow-hidden"><div className="h-full rounded-full bg-run-accent/60 transition-[width] duration-700" style={{width:`${Math.round((stats.phaseRunsDone/stats.phaseRunsTotal)*100)}%`}}/></div></div>
              ):!isCurrent&&wk.runsPlanned>0?(
                <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-tertiary">Week completion</span><span className="text-[10px] font-semibold" style={{color:wk.runsDone===wk.runsPlanned?'#2E7D32':wk.runsDone/wk.runsPlanned>=0.7?'#FF9500':'#FF3B30'}}>{wk.runsDone}/{wk.runsPlanned} runs · {Math.round((wk.runsDone/wk.runsPlanned)*100)}%</span></div><div className="h-1 w-full bg-canvas rounded-full overflow-hidden"><div className="h-full rounded-full transition-[width] duration-700" style={{width:`${Math.round((wk.runsDone/wk.runsPlanned)*100)}%`,background:wk.runsDone===wk.runsPlanned?'#2E7D32':wk.runsDone/wk.runsPlanned>=0.7?'#FF9500':'#FF3B30'}}/></div></div>
              ):null}
            </div>
          );
        })()}

        {/* Slot 2: Lift card (hybrid/lifter) OR Running Stats (runner) */}
        {isRunner ? (
          <div className="bc-card p-4 bento-half">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-run-accent" />
              <p className="bc-caption uppercase tracking-wider">Running Stats</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="bc-caption mb-0.5">This month</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-run-accent" style={{fontSize:28,fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>
                    {runnerStats.totalMilesMonth}
                  </span>
                  <span className="text-xs text-tertiary">mi</span>
                </div>
                {runnerStats.longestRunMonth > 0 && (
                  <p className="text-[10px] text-tertiary">Longest: {runnerStats.longestRunMonth} mi</p>
                )}
              </div>
              {runnerStats.avgPace && (
                <div>
                  <p className="bc-caption mb-0.5">Avg pace (last 3 runs)</p>
                  <p className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{runnerStats.avgPace}/mi</p>
                </div>
              )}
              <div>
                <p className="bc-caption mb-1.5">Weekly miles</p>
                <div className="flex items-end gap-1.5" style={{height:32}}>
                  {(runnerStats.weeklyMiles||[0,0,0,0]).map((miles,i) => {
                    const max=Math.max(...(runnerStats.weeklyMiles||[0]),0.1);
                    const pct=max>0?miles/max:0;
                    const isCurrent=i===3;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                        <div className="w-full rounded-t-[3px] transition-all"
                          style={{height:Math.max(pct*24,miles>0?3:2),background:isCurrent?'#34C759':miles>0?'#A5D6A7':'#F2F2F7'}}/>
                        <span className="text-[8px]" style={{color:isCurrent?'#2E7D32':'#AEAEB2'}}>
                          {['3w','2w','1w','Now'][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (()=>{
          const wk=stats.weeklyHistory?.[liftWeekIndex]; if(!wk) return null;
          const isCurrent=wk.isCurrent;
          const maxVol=Math.max(...(wk.dailyVolume||[]).map(d=>d.value),1);
          return (
            <div className={`bc-card p-4 ${isLifter?'bento-hero':'bento-half'} overflow-hidden`}>
              <div className="flex items-center justify-between mb-3">
                <button onClick={()=>{setLiftWeekIndex(i=>Math.max(0,i-1));setLiftExpanded(false);}} disabled={liftWeekIndex===0} className="w-6 h-6 -ml-1 flex items-center justify-center rounded-full transition-opacity disabled:opacity-0" style={{color:'#AEAEB2'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div className="flex-1 text-center"><p className="bc-caption uppercase tracking-wider">{isCurrent?'This Week · Lifts':`${wk.label} · Lifts`}</p>{!isCurrent&&<p className="text-[9px] text-tertiary mt-0.5">{wk.dateRange}</p>}</div>
                <button onClick={()=>{setLiftWeekIndex(i=>Math.min(3,i+1));setLiftExpanded(false);}} disabled={liftWeekIndex===3} className="w-6 h-6 -mr-1 flex items-center justify-center rounded-full transition-opacity disabled:opacity-0" style={{color:'#AEAEB2'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <button className="w-full mb-3 active:opacity-60 transition-opacity" onClick={()=>setLiftExpanded(v=>!v)}>
                <div className="flex items-end gap-1" style={{height:liftExpanded?56:28,transition:'height 0.25s ease'}}>
                  {wk.liftDots.map((day,i)=>{
                    const vol=wk.dailyVolume[i]?.value||0,pct=maxVol>0?vol/maxVol:0;
                    const dotColor=day.completed?'#1565C0':day.skipped?'#FFCDD2':day.planned?'#90CAF9':day.isToday?'#E3F2FD':'#F2F2F7';
                    const barColor=day.isToday?'#1565C0':vol>0?'#90CAF9':'transparent';
                    const barH=liftExpanded?Math.max(pct*40,vol>0?6:4):6;
                    const label=vol>=1000?`${(vol/1000).toFixed(1)}k`:vol>0?String(vol):'';
                    return <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1"><span className="text-[8px] leading-none transition-opacity" style={{fontVariantNumeric:'tabular-nums',color:day.isToday?'#1565C0':'#AEAEB2',opacity:liftExpanded&&vol>0?1:0,height:liftExpanded?'auto':0}}>{label}</span><div className="w-full rounded-t-[3px] transition-all duration-300" style={{height:barH,background:barH===6?dotColor:barColor,opacity:day.isFuture&&!day.planned?0.35:1}}/><span className="text-[8px] font-medium" style={{color:day.isToday?'#1565C0':'#AEAEB2'}}>{day.label}</span></div>;
                  })}
                </div>
              </button>
              <div className="flex items-end justify-between mb-3">
                <div><div className="flex items-baseline gap-1.5"><span className="font-bold text-lift-accent" style={{fontSize:'28px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>{wk.liftsDone}</span><span className="text-sm text-tertiary">/ {wk.liftsPlanned}</span></div></div>
                {wk.volume>0&&<div className="text-right"><div className="flex items-baseline gap-0.5 justify-end"><span className="font-bold text-primary" style={{fontSize:'22px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>{(wk.volume/1000).toFixed(1)}k</span><span className="text-xs text-tertiary"> lbs</span></div></div>}
              </div>
              {isCurrent&&stats.currentPhase&&stats.phaseLiftsTotal>0?(
                <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-tertiary capitalize">{stats.currentPhase} phase</span><span className="text-[10px] font-semibold text-lift-accent">{stats.phaseLiftsDone}/{stats.phaseLiftsTotal} lifts · {stats.phaseLiftRate}%</span></div><div className="h-1 w-full bg-canvas rounded-full overflow-hidden"><div className="h-full rounded-full bg-lift-accent/60 transition-[width] duration-700" style={{width:`${stats.phaseLiftRate}%`}}/></div></div>
              ):!isCurrent&&wk.liftsPlanned>0?(
                <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-tertiary">Week completion</span><span className="text-[10px] font-semibold" style={{color:wk.liftsDone===wk.liftsPlanned?'#1565C0':wk.liftsDone/wk.liftsPlanned>=0.7?'#FF9500':'#FF3B30'}}>{wk.liftsDone}/{wk.liftsPlanned} lifts · {Math.round((wk.liftsDone/wk.liftsPlanned)*100)}%</span></div><div className="h-1 w-full bg-canvas rounded-full overflow-hidden"><div className="h-full rounded-full transition-[width] duration-700" style={{width:`${Math.round((wk.liftsDone/wk.liftsPlanned)*100)}%`,background:wk.liftsDone===wk.liftsPlanned?'#1565C0':wk.liftsDone/wk.liftsPlanned>=0.7?'#FF9500':'#FF3B30'}}/></div></div>
              ):null}
            </div>
          );
        })()}

        {/* Streak */}
        <div className="bc-card p-4 bento-quarter">
          <p className="bc-caption uppercase tracking-wider mb-2">Streak</p>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-baseline gap-1"><span className="font-bold text-primary" style={{fontSize:'24px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',lineHeight:1}}>{stats.streak}</span><span className="text-xs text-tertiary">{stats.streak===1?'day':'days'}</span></div>
            <Flame size={22} style={{color:'#FF9500'}}/>
          </div>
          <p className="text-[10px] text-tertiary">in a row</p>
        </div>

        {/* Run Adherence */}
        {stats.phaseRunAdherence!==null?(
          <div className="bc-card p-4 bento-quarter">
            <p className="bc-caption uppercase tracking-wider mb-2">Run Adherence</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-bold leading-none"
                style={{fontSize:'28px',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em',
                  color:stats.phaseRunAdherence>=85?'#2E7D32':stats.phaseRunAdherence>=70?'#E65100':'#C62828'}}>
                {stats.phaseRunAdherence}
              </span>
              <span className="text-sm text-tertiary">%</span>
            </div>
            <p className="text-[10px] text-tertiary capitalize">
              {stats.currentPhase} phase
              {stats.phaseRunsSkipped>0&&(
                <span className="ml-1" style={{color:stats.phaseRunAdherence<85?'#E65100':'#AEAEB2'}}>
                  · {stats.phaseRunsSkipped} skipped
                </span>
              )}
            </p>
          </div>
        ):(
          <div className="hidden md:block bento-quarter"/>
        )}
      </div>

      {/* Training Load Trends */}
      {(()=>{
        const WEEK_LABELS=['3 weeks ago','2 weeks ago','Last week','This week'];
        const weekLabel=WEEK_LABELS[3-chartWeekOffset];
        const data=weeklyChartData;
        const totalMiles  = parseFloat(data.reduce((s,d)=>s+(d.runMiles||0),0).toFixed(1));
        const totalVolK   = parseFloat(data.reduce((s,d)=>s+(d.liftScore||0),0).toFixed(1));
        const priorData   = buildWeeklyChartData(workouts,chartWeekOffset+1);
        const priorMiles  = parseFloat(priorData.reduce((s,d)=>s+(d.runMiles||0),0).toFixed(1));
        const priorVolK   = parseFloat(priorData.reduce((s,d)=>s+(d.liftScore||0),0).toFixed(1));
        const milesTrend  = priorMiles>0?Math.round(((totalMiles-priorMiles)/priorMiles)*100):null;
        const volTrend    = priorVolK>0?Math.round(((totalVolK-priorVolK)/priorVolK)*100):null;
        const loadData    = data.map(d=>({day:d.day,date:d.date,value:(d.runMiles||0)*10+(d.liftScore||0)}));
        const priorLoad   = priorData.map(d=>(d.runMiles||0)*10+(d.liftScore||0));
        const totalLoad   = Math.round(loadData.reduce((s,d)=>s+d.value,0));
        const priorLoadTotal=Math.round(priorLoad.reduce((s,v)=>s+v,0));
        const loadTrend   = priorLoadTotal>0?Math.round(((totalLoad-priorLoadTotal)/priorLoadTotal)*100):null;

        // FIX 1: week-to-date comparison
        // Compare Mon–today of selected week vs Mon–same weekday of prior week
        const todayStr = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const todayDow = now.getDay(); // 0=Sun..6=Sat
        const daysSinceMonday = todayDow===0?6:todayDow-1; // 0=Mon..6=Sun

        // For the selected week, only count days up to equivalent weekday
        const weekDayLimit = chartWeekOffset===0 ? daysSinceMonday : 6; // current week: up to today; past weeks: full week
        const wtdLoad  = Math.round(loadData.slice(0, weekDayLimit+1).reduce((s,d)=>s+d.value,0));
        const wtdMiles = parseFloat(data.slice(0, weekDayLimit+1).reduce((s,d)=>s+(d.runMiles||0),0).toFixed(1));
        const wtdVolK  = parseFloat(data.slice(0, weekDayLimit+1).reduce((s,d)=>s+(d.liftScore||0),0).toFixed(1));
        // Prior week same period
        const priorWtdLoad  = Math.round(priorLoad.slice(0, weekDayLimit+1).reduce((s,v)=>s+v,0));
        const priorWtdMiles = parseFloat(priorData.slice(0, weekDayLimit+1).reduce((s,d)=>s+(d.runMiles||0),0).toFixed(1));
        const priorWtdVolK  = parseFloat(priorData.slice(0, weekDayLimit+1).reduce((s,d)=>s+(d.liftScore||0),0).toFixed(1));
        const wtdLoadTrend  = priorWtdLoad>0?Math.round(((wtdLoad-priorWtdLoad)/priorWtdLoad)*100):null;
        const wtdMilesTrend = priorWtdMiles>0?Math.round(((wtdMiles-priorWtdMiles)/priorWtdMiles)*100):null;
        const wtdVolTrend   = priorWtdVolK>0?Math.round(((wtdVolK-priorWtdVolK)/priorWtdVolK)*100):null;
        const DOW_LABELS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const wtdLabel      = chartWeekOffset===0 ? `Mon–${DOW_LABELS[daysSinceMonday]}` : 'Full week';

        const activeTrend   = kpiToggle==='runs'?wtdMilesTrend:kpiToggle==='lifts'?wtdVolTrend:wtdLoadTrend;
        const fullTrend     = kpiToggle==='runs'?milesTrend:kpiToggle==='lifts'?volTrend:loadTrend;

        const chartData = kpiToggle==='runs'
          ? data.map(d=>({day:d.day,date:d.date,value:d.runMiles||0,label:d.runMiles>0?`${d.runMiles}`:''}))
          : kpiToggle==='lifts'
          ? data.map(d=>({day:d.day,date:d.date,value:d.liftScore||0,label:d.liftScore>0?`${d.liftScore}k`:''}))
          : loadData.map(d=>({...d,label:d.value>0?String(Math.round(d.value)):''}));
        const chartMax  = Math.max(...chartData.map(d=>d.value),0.1);
        const barColor  = kpiToggle==='runs'?'#34C759':kpiToggle==='lifts'?'#007AFF':'#AF52DE';
        const barLight  = kpiToggle==='runs'?'#A5D6A7':kpiToggle==='lifts'?'#90CAF9':'#E1BEE7';

        const trendColor= activeTrend===null?'#8E8E93':activeTrend>0?'#FF9500':activeTrend<0?'#007AFF':'#34C759';
        const trendIcon = activeTrend===null?'—':activeTrend>0?'↑':activeTrend<0?'↓':'→';

        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <button onClick={()=>setChartWeekOffset(o=>Math.min(3,o+1))} disabled={chartWeekOffset===3} className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-25 active:scale-90" style={{color:'#AEAEB2'}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div><p className="bc-caption uppercase tracking-wider leading-none">Training Load Trends</p>{chartWeekOffset>0&&<p className="text-[9px] text-tertiary mt-0.5">{weekLabel}</p>}</div>
                <button onClick={()=>setChartWeekOffset(o=>Math.max(0,o-1))} disabled={chartWeekOffset===0} className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-25 active:scale-90" style={{color:'#AEAEB2'}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <div className="flex items-center gap-0.5 p-0.5 bg-canvas rounded-[10px] border border-border">
                {[['both','All'],['runs','Runs'],['lifts','Lifts']].map(([key,label])=>(
                  <button key={key} onClick={()=>setKpiToggle(key)} className="px-2.5 py-1 rounded-[8px] text-[10px] font-semibold transition-all" style={{background:kpiToggle===key?barColor:'transparent',color:kpiToggle===key?'#fff':'#8E8E93'}}>{label}</button>
                ))}
              </div>
            </div>
            <div className="bc-card p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-primary" style={{fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em'}}>
                    {kpiToggle==='runs'?`${totalMiles} mi`:kpiToggle==='lifts'?`${totalVolK}k lbs`:`${totalLoad} pts`}
                  </p>
                  <p className="text-[10px] text-tertiary mt-0.5">{kpiToggle==='runs'?'total miles':kpiToggle==='lifts'?'total volume':'combined load'}</p>
                </div>
                <div className="text-right">
                  {/* FIX 1: Show WTD comparison for current week */}
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-base font-bold" style={{color:trendColor,fontVariantNumeric:'tabular-nums'}}>
                      {trendIcon}{activeTrend!==null?`${Math.abs(activeTrend)}%`:''}
                    </span>
                  </div>
                  <p className="text-[10px] text-tertiary">{wtdLabel} vs prior</p>
                  {chartWeekOffset===0&&fullTrend!==null&&(
                    <p className="text-[9px] text-tertiary mt-0.5">
                      Full week: <span style={{color:fullTrend>0?'#FF9500':fullTrend<0?'#007AFF':'#34C759'}}>{fullTrend>0?'↑':'↓'}{Math.abs(fullTrend)}%</span> (proj)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-end gap-1.5" style={{height:80}}>
                {chartData.map((d,i)=>{
                  const pct=chartMax>0?d.value/chartMax:0;
                  const isToday=d.date===todayStr;
                  const isWtd=chartWeekOffset===0&&i<=daysSinceMonday;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                      {d.value>0&&<span className="text-[8px] leading-none text-tertiary" style={{fontVariantNumeric:'tabular-nums'}}>{d.label}</span>}
                      <div className="w-full rounded-t-[4px] transition-all duration-300"
                        style={{
                          height:Math.max(pct*56,d.value>0?3:2),
                          background:isToday?barColor:d.value>0?barLight:'#F2F2F7',
                          opacity:isToday?1:d.value>0?0.75:isWtd?0.2:0.15,
                        }}/>
                      <span className="text-[8px] font-medium" style={{color:isToday?barColor:'#AEAEB2'}}>{d.day}</span>
                    </div>
                  );
                })}
              </div>

              {kpiToggle==='both'&&(
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{background:'#34C759'}}/>
                      <span className="text-[10px] font-semibold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{totalMiles} mi</span>
                      {wtdMilesTrend!==null&&<span className="text-[9px]" style={{color:wtdMilesTrend>0?'#FF9500':wtdMilesTrend<0?'#007AFF':'#34C759'}}>{wtdMilesTrend>0?'↑':'↓'}{Math.abs(wtdMilesTrend)}%</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{background:'#007AFF'}}/>
                      <span className="text-[10px] font-semibold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{totalVolK}k lbs</span>
                      {wtdVolTrend!==null&&<span className="text-[9px]" style={{color:wtdVolTrend>0?'#FF9500':wtdVolTrend<0?'#007AFF':'#34C759'}}>{wtdVolTrend>0?'↑':'↓'}{Math.abs(wtdVolTrend)}%</span>}
                    </div>
                  </div>
                  <p className="text-[9px] text-tertiary">{totalMiles} mi × 10 + {totalVolK}k lbs ÷ 100 = <span className="font-semibold text-secondary">{totalLoad} pts</span></p>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* FIX 3: Recent Activity — grouped by day, paginated with arrows */}
      <div className="flex items-center justify-between mb-3">
        <p className="bc-caption uppercase tracking-wider">Recent Activity</p>
        <div className="flex items-center gap-1">
          <button onClick={()=>setActivityPage(p=>Math.max(0,p-1))} disabled={activityPage===0}
            className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-25 active:scale-90">
            <ChevronLeft size={12} className="text-secondary"/>
          </button>
          <span className="text-[10px] text-tertiary px-1">{activityPage+1}/{Math.max(1,recentActivityByDay.length)}</span>
          <button onClick={()=>setActivityPage(p=>Math.min(recentActivityByDay.length-1,p+1))} disabled={activityPage>=recentActivityByDay.length-1}
            className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-25 active:scale-90">
            <ChevronRight size={12} className="text-secondary"/>
          </button>
        </div>
      </div>
      {recentActivityByDay.length>0 ? (()=>{
        const [date,dayWorkouts]=recentActivityByDay[activityPage]||[];
        if(!date) return null;
        return (
          <div className="bc-card mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-canvas/50">
              <p className="text-xs font-semibold text-primary">{formatDate(date)}</p>
              <span className="bc-caption">{dayWorkouts.length} session{dayWorkouts.length!==1?'s':''}</span>
            </div>
            {dayWorkouts.map((w,i)=>(
              <div key={w.id} className={`flex items-center justify-between px-4 py-3 ${i<dayWorkouts.length-1?'border-b border-border/50':''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${w.type==='run'?'bg-run-bg':w.type==='lift'?'bg-lift-bg':'bg-cardio-bg'}`}>
                    <ActivityIcon type={w.type} size={16}/>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{w.type==='run'?(w.details.runType||'Run'):(w.details.sessionName||'Lift')}</p>
                    <p className="text-xs text-secondary">
                      {w.type==='run'&&w.details.actualDistance&&`${w.details.actualDistance} mi`}
                      {w.type==='run'&&w.details.actualPace&&` · ${w.details.actualPace}/mi`}
                      {w.type==='lift'&&w.details.totalVolume&&formatVolume(w.details.totalVolume)}
                    </p>
                  </div>
                </div>
                <ShareWorkoutButton workout={w} userName={user?.display_name||user?.email?.split('@')[0]||''} deepLinkUrl={`https://basecamp.fit/workout/${w.id}`} onShareComplete={(wk)=>incrementShareCount(wk.id)} variant="icon"/>
              </div>
            ))}
          </div>
        );
      })() : <p className="text-sm text-tertiary mb-6">No recent activity.</p>}

      {/* Recent PRs */}
      <div className="mb-6"><RecentPRs prs={prs.recent}/></div>

      {/* Modals */}
      {logTarget&&<LogForm workout={logTarget} onSave={handleSave} onClose={()=>setLogTarget(null)}/>}
      {showCheckIn&&<ReadinessCheckIn onComplete={handleCheckInComplete} onClose={()=>setShowCheckIn(false)}/>}
    </div>
  );
}

function getWeeklyData(workouts,getValue) {
  if(workouts.length===0) return [0,0,0,0];
  const now=new Date(), weeks=[0,0,0,0];
  workouts.forEach(w=>{
    const diffDays=Math.floor((now-new Date(w.date+'T12:00:00'))/(1000*60*60*24));
    if(diffDays<7)weeks[3]+=getValue(w);else if(diffDays<14)weeks[2]+=getValue(w);else if(diffDays<21)weeks[1]+=getValue(w);else if(diffDays<28)weeks[0]+=getValue(w);
  });
  return weeks.map(v=>Math.round(v*10)/10);
}

function calculateStreak(workouts) {
  const completedDates=new Set(workouts.filter(w=>w.status==='completed').map(w=>w.date));
  let streak=0;
  const todayStr=new Date().toLocaleDateString('en-CA');
  if(completedDates.has(todayStr)) streak++;
  const check=new Date(); check.setDate(check.getDate()-1);
  for(let i=0;i<365;i++){const dateStr=check.toLocaleDateString('en-CA');if(completedDates.has(dateStr)){streak++;check.setDate(check.getDate()-1);}else break;}
  return streak;
}

function buildWeeklyChartData(workouts,weekOffset=0) {
  const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const now=new Date(), dayOfWeek=now.getDay();
  const mondayOffset=dayOfWeek===0?-6:1-dayOfWeek;
  const monday=new Date(now); monday.setDate(monday.getDate()+mondayOffset-weekOffset*7); monday.setHours(0,0,0,0);
  return dayNames.map((day,i)=>{
    const date=new Date(monday); date.setDate(date.getDate()+i);
    const dateStr=date.toLocaleDateString('en-CA');
    const dayWorkouts=workouts.filter(w=>w.date===dateStr);
    const runMiles=dayWorkouts.filter(w=>w.type==='run'&&w.status==='completed').reduce((sum,w)=>sum+(w.details.actualDistance||w.details.plannedDistance||0),0);
    const liftVolume=dayWorkouts.filter(w=>w.type==='lift'&&w.status==='completed').reduce((sum,w)=>sum+(w.details.totalVolume||0),0);
    return{day,date:dateStr,runMiles:Math.round(runMiles*10)/10,liftScore:Math.round((liftVolume/1000)*10)/10};
  });
}