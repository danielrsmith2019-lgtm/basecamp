'use client';

import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateInsights, calculateTrainingLoad } from '@/utils/insights';
import Sparkline from '@/components/shared/Sparkline';
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
import { Flame, Sparkles } from 'lucide-react';
import PlanAdaptationList from '@/components/shared/PlanAdaptation';
import SkipInsightCard from '@/components/shared/SkipInsightCard';
import { analyzeSkips, computeWeeklySkipRate } from '@/utils/skipIntelligence';
import { getFuelStatus } from '@/utils/nutrition';
import ShareWorkoutButton from '@/components/shared/ShareWorkoutButton';
import { incrementShareCount } from '@/lib/share-tracking';

// ── FIX: use local date, not UTC ──────────────────────────
// new Date().toISOString() returns UTC — e.g. 11pm EST Mon = Tue UTC
// toLocaleDateString('en-CA') returns YYYY-MM-DD in the user's local timezone
function getLocalToday() {
  return new Date().toLocaleDateString('en-CA');
}


export default function Dashboard() {
  const { workouts, prs, saveWorkout, isLoaded, adaptations, acceptAdaptation, rejectAdaptation } = useWorkouts();
  const { user } = useAuth();

  const [logTarget, setLogTarget]                 = useState(null);
  const [justLogged, setJustLogged]               = useState(null);
  const [kpiWeekIndex, setKpiWeekIndex]           = useState(3); // 3=this week, 0=3wk ago
  const [kpiExpanded, setKpiExpanded]             = useState(false);
  // Persist dismissed insight IDs in localStorage, keyed by date
  // so they reset naturally the next day
  const [dismissedInsights, setDismissedInsights] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = JSON.parse(localStorage.getItem('bc-dismissed-insights') || '{}');
      const today  = new Date().toLocaleDateString('en-CA');
      // Only restore if saved today — stale dismissals expire at midnight
      return stored.date === today ? new Set(stored.ids || []) : new Set();
    } catch { return new Set(); }
  });

  const [dismissedSkips, setDismissedSkips] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = JSON.parse(localStorage.getItem('bc-dismissed-skips') || '{}');
      const today  = new Date().toLocaleDateString('en-CA');
      return stored.date === today ? new Set(stored.ids || []) : new Set();
    } catch { return new Set(); }
  });
  const [showCheckIn, setShowCheckIn]             = useState(false);
  const [checkInData, setCheckInData]             = useState(null);
  const [readinessScore, setReadinessScore]       = useState(null);
  const [todayCalories, setTodayCalories]         = useState(0);
  const [todayCalTarget, setTodayCalTarget]       = useState(2000);

  // FIX: use local date throughout
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

  // ── Readiness trigger ──────────────────────────────────
  useEffect(() => {
    if (!user || !isLoaded) return;
    async function checkTrigger() {
      const settings = await getUserSettings(user.id);
      if (settings?.last_checkin_date !== today) {
        setShowCheckIn(true);
      } else if (settings?.last_checkin_data) {
        setCheckInData(settings.last_checkin_data);
        const score = await calculateReadinessScore(
          settings.last_checkin_data, workouts, getNutritionLog, user.id
        );
        setReadinessScore(score);
      }
    }
    checkTrigger();
  }, [user, isLoaded, workouts]);

  // ── Nutrition fuel status ─────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function loadNutrition() {
      const [log, settings] = await Promise.all([
        getNutritionLog(user.id, today),
        getUserSettings(user.id),
      ]);
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
    if (user) {
      await updateUserSettings(user.id, {
        last_checkin_date: data.date,
        last_checkin_data: data,
      });
    }
  }

  // ── Computed data ──────────────────────────────────────
  const allInsights     = useMemo(() => generateInsights(workouts), [workouts]);
  const trainingLoad    = useMemo(() => calculateTrainingLoad(workouts), [workouts]);
  const visibleInsights = useMemo(() =>
    allInsights.filter(i => !dismissedInsights.has(i.id)),
  [allInsights, dismissedInsights]);

  // ── Skip intelligence ──────────────────────────────
  const skipInsights = useMemo(() =>
    analyzeSkips(workouts).filter(i => !dismissedSkips.has(i.id)),
  [workouts, dismissedSkips]);

  const skipStats = useMemo(() => computeWeeklySkipRate(workouts), [workouts]);

  async function handleRescue(insight) {
    // Reschedule: create a new planned workout on the rescue date
    // (copy the skipped workout's details to the new date)
    const rescue = insight.action?.rescue;
    const skip   = insight.action?.skipWorkout;
    if (!rescue || !skip) return;
    const newWorkout = {
      ...skip,
      id:     undefined, // let DB assign new id
      date:   rescue.date,
      status: 'planned',
    };
    await saveWorkout(newWorkout);
    // Dismiss this skip insight
    setDismissedSkips(prev => {
      const next = new Set([...prev, insight.id]);
      try {
        localStorage.setItem('bc-dismissed-skips', JSON.stringify({
          date: new Date().toLocaleDateString('en-CA'),
          ids:  [...next],
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

    const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const thisWeekRunProgress = weekDays.map((label, i) => {
      const date    = new Date(monday); date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayRuns = runs.filter(w => w.date === dateStr);
      return {
        label,
        planned:   dayRuns.some(w => w.status === 'planned'),
        completed: dayRuns.some(w => w.status === 'completed'),
        skipped:   dayRuns.every(w => w.status === 'skipped') && dayRuns.length > 0,
        isToday:   dateStr === todayStr,
        isFuture:  dateStr > todayStr,
      };
    });

    const thisWeekLiftProgress = weekDays.map((label, i) => {
      const date    = new Date(monday); date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayLifts = lifts.filter(w => w.date === dateStr);
      return {
        label,
        planned:   dayLifts.some(w => w.status === 'planned'),
        completed: dayLifts.some(w => w.status === 'completed'),
        skipped:   dayLifts.every(w => w.status === 'skipped') && dayLifts.length > 0,
        isToday:   dateStr === todayStr,
        isFuture:  dateStr > todayStr,
      };
    });

    const thisWeekRunsCompleted  = thisWeekRunProgress.filter(d => d.completed).length;
    const thisWeekRunsPlanned    = thisWeekRunProgress.filter(d => d.planned || d.completed || d.skipped).length;
    const thisWeekLiftsCompleted = thisWeekLiftProgress.filter(d => d.completed).length;
    const thisWeekLiftsPlanned   = thisWeekLiftProgress.filter(d => d.planned || d.completed || d.skipped).length;

    // ── This week's mileage & volume ──
    const thisWeekRuns  = completedRuns.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const thisWeekLifts = completedLifts.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const thisWeekMiles  = thisWeekRuns.reduce((s, w) => s + (w.details.actualDistance || 0), 0);
    const thisWeekVol    = thisWeekLifts.reduce((s, w) => s + (w.details.totalVolume || 0), 0);

    // Planned this week (for target comparison)
    const thisWeekPlannedRuns  = runs.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped');
    const thisWeekPlannedMiles = thisWeekPlannedRuns.reduce((s, w) => s + (w.details.plannedDistance || 0), 0);

    // ── Current phase detection ──
    // Phase comes from workout details.phase — find the dominant phase this week
    const thisWeekWorkouts = workouts.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const phaseCounts = {};
    thisWeekWorkouts.forEach(w => {
      const p = w.details?.phase;
      if (p) phaseCounts[p] = (phaseCounts[p] || 0) + 1;
    });
    const currentPhase = Object.keys(phaseCounts).sort((a,b) => phaseCounts[b]-phaseCounts[a])[0] || null;

    // ── Phase completion (past + this week workouts in same phase) ──
    const phaseRuns  = currentPhase ? runs.filter(w => w.details?.phase === currentPhase) : [];
    const phaseLifts = currentPhase ? lifts.filter(w => w.details?.phase === currentPhase) : [];
    const phaseRunsDone  = phaseRuns.filter(w => w.status === 'completed').length;
    const phaseRunsTotal = phaseRuns.length; // all runs in phase including future planned
    const phaseLiftsDone  = phaseLifts.filter(w => w.status === 'completed').length;
    const phaseLiftsTotal = phaseLifts.filter(w => w.status !== 'skipped').length;
    const phaseRunsPast  = phaseRuns.filter(w => w.date <= todayStr && w.status !== 'planned').length;
    const phaseRunRate   = phaseRunsPast > 0 ? Math.round((phaseRunsDone / phaseRunsPast) * 100) : 100;
    const phaseLiftRate = phaseLiftsTotal > 0 ? Math.round((phaseLiftsDone / phaseLiftsTotal) * 100) : 0;

    // ── Week number from plan ──
    const weekNumber = thisWeekWorkouts[0]?.details?.weekNumber || null;

    return {
      // Overall (for reference)
      runCompletionRate:  plannedRuns.length  > 0 ? Math.round((completedRuns.length  / plannedRuns.length)  * 100) : 0,
      liftCompletionRate: plannedLifts.length > 0 ? Math.round((completedLifts.length / plannedLifts.length) * 100) : 0,
      completedRuns:  completedRuns.length,
      totalRuns:      plannedRuns.length,
      completedLifts: completedLifts.length,
      totalLifts:     plannedLifts.length,

      // Weekly focus
      thisWeekRunsCompleted, thisWeekRunsPlanned,
      thisWeekLiftsCompleted, thisWeekLiftsPlanned,
      thisWeekMiles:  parseFloat(thisWeekMiles.toFixed(1)),
      thisWeekPlannedMiles: parseFloat(thisWeekPlannedMiles.toFixed(1)),
      thisWeekVol,
      thisWeekRunProgress,
      thisWeekLiftProgress,

      // Phase-aware
      currentPhase,
      weekNumber,
      phaseRunRate,  phaseRunsDone,  phaseRunsTotal,
      phaseLiftRate, phaseLiftsDone, phaseLiftsTotal,

      // Sparklines
      weeklyMileageData: getWeeklyData(completedRuns,  w => w.details.actualDistance || 0),
      weeklyVolumeData:  getWeeklyData(completedLifts, w => w.details.totalVolume    || 0),
      currentWeekMileage: (getWeeklyData(completedRuns, w => w.details.actualDistance || 0)[3] || 0).toFixed(1),
      currentWeekVolume:  getWeeklyData(completedLifts, w => w.details.totalVolume   || 0)[3] || 0,
      streak: calculateStreak(workouts),

      // ── 4-week history for swipeable KPI cards ──
      weeklyHistory: (() => {
        const weeks = [];
        for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
          const wEnd   = new Date(monday); wEnd.setDate(monday.getDate() - weeksAgo * 7 + 6);
          const wStart = new Date(monday); wStart.setDate(monday.getDate() - weeksAgo * 7);
          const wEndStr   = wEnd.toLocaleDateString('en-CA');
          const wStartStr = wStart.toLocaleDateString('en-CA');
          const isCurrent = weeksAgo === 0;

          const label = isCurrent ? 'This week'
            : weeksAgo === 1 ? 'Last week'
            : `${weeksAgo}w ago`;
          const dateRange = `${wStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${wEnd.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;

          // Runs
          const wRuns = runs.filter(w => w.date >= wStartStr && w.date <= wEndStr);
          const wRunsDone    = wRuns.filter(w => w.status === 'completed').length;
          const wRunsPlanned = wRuns.filter(w => w.status !== 'skipped').length;
          const wMiles = wRuns.filter(w=>w.status==='completed').reduce((s,w)=>s+(w.details.actualDistance||0),0);

          // Day dots for runs
          const DAY_LABELS = ['M','T','W','T','F','S','S'];
          const runDots = DAY_LABELS.map((label, i) => {
            const d = new Date(wStart); d.setDate(wStart.getDate() + i);
            const dStr = d.toLocaleDateString('en-CA');
            const dayRuns = wRuns.filter(w => w.date === dStr);
            return {
              label,
              completed: dayRuns.some(w => w.status === 'completed'),
              skipped:   dayRuns.some(w => w.status === 'skipped'),
              planned:   dayRuns.some(w => w.status === 'planned'),
              isToday:   dStr === todayStr,
              isFuture:  dStr > todayStr,
            };
          });

          // Lifts
          const wLifts = lifts.filter(w => w.date >= wStartStr && w.date <= wEndStr);
          const wLiftsDone    = wLifts.filter(w => w.status === 'completed').length;
          const wLiftsPlanned = wLifts.filter(w => w.status !== 'skipped').length;
          const wVol = wLifts.filter(w=>w.status==='completed').reduce((s,w)=>s+(w.details.totalVolume||0),0);

          const liftDots = DAY_LABELS.map((label, i) => {
            const d = new Date(wStart); d.setDate(wStart.getDate() + i);
            const dStr = d.toLocaleDateString('en-CA');
            const dayLifts = wLifts.filter(w => w.date === dStr);
            return {
              label,
              completed: dayLifts.some(w => w.status === 'completed'),
              skipped:   dayLifts.some(w => w.status === 'skipped'),
              planned:   dayLifts.some(w => w.status === 'planned'),
              isToday:   dStr === todayStr,
              isFuture:  dStr > todayStr,
            };
          });

          // Run adherence for this week
          const wPastRuns = wRuns.filter(w => w.date <= todayStr && w.status !== 'planned');
          const wRunAdherence = wPastRuns.length > 0
            ? Math.round((wRunsDone / wPastRuns.length) * 100) : null;

          // Daily breakdown for bar charts
          const DAY_FULL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          const dailyMiles = DAY_FULL.map((d, i) => {
            const dt = new Date(wStart); dt.setDate(wStart.getDate() + i);
            const dStr = dt.toLocaleDateString('en-CA');
            const dayRuns = wRuns.filter(w => w.date === dStr && w.status === 'completed');
            return { day: d, value: parseFloat(dayRuns.reduce((s,w)=>s+(w.details.actualDistance||0),0).toFixed(1)) };
          });
          const dailyVolume = DAY_FULL.map((d, i) => {
            const dt = new Date(wStart); dt.setDate(wStart.getDate() + i);
            const dStr = dt.toLocaleDateString('en-CA');
            const dayLifts = wLifts.filter(w => w.date === dStr && w.status === 'completed');
            return { day: d, value: Math.round(dayLifts.reduce((s,w)=>s+(w.details.totalVolume||0),0)) };
          });

          weeks.push({
            label, dateRange, isCurrent,
            runsDone: wRunsDone, runsPlanned: wRunsPlanned,
            miles: parseFloat(wMiles.toFixed(1)),
            runAdherence: wRunAdherence,
            runDots,
            liftsDone: wLiftsDone, liftsPlanned: wLiftsPlanned,
            volume: wVol,
            liftDots,
            dailyMiles,
            dailyVolume,
          });
        }
        return weeks;
      })(),

      // ── Phase run adherence ──
      // Adherence = completed / (completed + skipped) for runs in current phase
      // Excludes future planned sessions — only judges past decisions
      ...(() => {
        if (!currentPhase) return {
          phaseRunAdherence: null,
          phaseRunAdherenceTrend: [null, null, null, null],
          phaseRunsSkipped: 0,
        };
        const phaseAllRuns = runs.filter(w => w.details?.phase === currentPhase);
        const pastPhaseRuns = phaseAllRuns.filter(w => w.date <= todayStr && w.status !== 'planned');
        const phDone    = pastPhaseRuns.filter(w => w.status === 'completed').length;
        const phSkipped = pastPhaseRuns.filter(w => w.status === 'skipped').length;
        const phPast    = phDone + phSkipped;
        const adherence = phPast > 0 ? Math.round((phDone / phPast) * 100) : null;

        // 4-week adherence sparkline (% per week, most recent last)
        const trend = [0, 1, 2, 3].map(weeksAgo => {
          const wEnd   = new Date(monday); wEnd.setDate(monday.getDate() - weeksAgo * 7 + 6);
          const wStart = new Date(monday); wStart.setDate(monday.getDate() - weeksAgo * 7);
          const wEndStr   = wEnd.toLocaleDateString('en-CA');
          const wStartStr = wStart.toLocaleDateString('en-CA');
          const wRuns = phaseAllRuns.filter(w => w.date >= wStartStr && w.date <= wEndStr && w.status !== 'planned');
          const wDone    = wRuns.filter(w => w.status === 'completed').length;
          const wSkipped = wRuns.filter(w => w.status === 'skipped').length;
          const wTotal   = wDone + wSkipped;
          return wTotal > 0 ? Math.round((wDone / wTotal) * 100) : null;
        }).reverse(); // oldest → newest

        return {
          phaseRunAdherence:      adherence,
          phaseRunAdherenceTrend: trend,
          phaseRunsSkipped:       phSkipped,
          phaseRunsPast:          phPast,  // renamed — phaseRunsTotal is set above as full phase count
        };
      })(),
    };
  }, [workouts]);

  // FIX: today comparison uses local date — this is why runs were missing
  const todayWorkouts = useMemo(() =>
    workouts.filter(w => w.date === today && w.type !== 'rest'),
  [workouts, today]);

  const recentActivity = useMemo(() =>
    workouts.filter(w => w.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
  [workouts]);

  const weeklyChartData = useMemo(() => buildWeeklyChartData(workouts), [workouts]);

  const fuelStatus = getFuelStatus(todayCalories, todayCalTarget);

  function handleSave(data) {
    saveWorkout(data);
    if (data.status === 'completed') setJustLogged(data);
    setLogTarget(null);
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  // ── First-time user: no workouts yet ──────────────────────
  if (workouts.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-1 py-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} className="text-bc-indigo" />
          </div>
          <h1 className="text-[22px] font-bold text-primary mb-2">Welcome to BaseCamp</h1>
          <p className="text-sm text-secondary leading-relaxed max-w-sm mx-auto">
            Your multimodal fitness OS. One app for every run, lift, and cardio session — with AI that understands how they all interact.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <a href="/plans"
            className="flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow no-underline">
            <div className="w-12 h-12 rounded-[14px] bg-bc-indigo-light flex items-center justify-center flex-shrink-0">
              <Sparkles size={22} className="text-bc-indigo" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Generate your training plan</p>
              <p className="text-xs text-secondary mt-0.5">AI builds a plan around your schedule, race goal, and experience level</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          <button onClick={() => setLogTarget({ type: 'run', status: 'planned', date: today, details: {} })}
            className="w-full flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 rounded-[14px] bg-run-bg flex items-center justify-center flex-shrink-0">
              <RunTypeIcon runType="easy" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Log your first workout</p>
              <p className="text-xs text-secondary mt-0.5">Run, lift, or cardio — BaseCamp tracks everything in one place</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <a href="/goals"
            className="flex items-center gap-4 p-4 bc-card hover:shadow-md transition-shadow no-underline">
            <div className="w-12 h-12 rounded-[14px] bg-bc-orange-light flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Set your training goals</p>
              <p className="text-xs text-secondary mt-0.5">Race targets, weekly mileage, strength milestones</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>

        <div className="p-4 bg-bc-indigo-light/60 rounded-[16px] border border-bc-indigo/10">
          <p className="text-xs font-semibold text-bc-indigo-dark mb-1.5">Why BaseCamp is different</p>
          <p className="text-xs text-bc-indigo-dark/80 leading-relaxed">
            Most apps only track one thing. BaseCamp understands the interference effect — how your Tuesday leg day affects your Wednesday tempo run. It&apos;s the only app built for athletes who do more than one thing.
          </p>
        </div>

        {logTarget && (
          <LogForm workout={logTarget} onSave={handleSave} onClose={() => setLogTarget(null)} />
        )}
      </div>
    );
  }

  return (
    <div>

      {/* ── Post-workout share prompt ── */}
      {justLogged && (
        <div className="bc-card mb-6 border-l-4 border-bc-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bc-green-light flex items-center justify-center">
                <StatusIcon status="completed" size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Workout logged!</p>
                <p className="bc-caption">
                  {justLogged.type === 'run' && justLogged.details.actualDistance
                    ? `${justLogged.details.actualDistance} mi run`
                    : justLogged.type === 'lift' && justLogged.details.sessionName
                    ? justLogged.details.sessionName
                    : 'Great session'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShareWorkoutButton
                workout={justLogged}
                userName={user?.display_name || user?.email?.split('@')[0] || ''}
                deepLinkUrl={`https://basecamp.fit/workout/${justLogged.id}`}
                onShareComplete={(w) => incrementShareCount(w.id)}
                variant="button"
              />
              <button onClick={() => setJustLogged(null)}
                className="text-tertiary hover:text-secondary text-xs min-h-[44px] px-2">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Adaptations ── */}
      {adaptations?.filter(a => a.status === 'pending').length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => {
              const next = !adaptationsSectionCollapsed;
              setAdaptationsSectionCollapsed(next);
              if (next) localStorage.setItem('bc-adaptations-dismissed', JSON.stringify({ date: today }));
              else localStorage.removeItem('bc-adaptations-dismissed');
            }}
            className="flex items-center gap-2 mb-3 w-full group min-h-[44px]">
            <Sparkles size={14} className="text-bc-indigo" />
            <p className="bc-caption uppercase tracking-wider">Plan Adaptations</p>
            <span className="bc-pill bg-bc-indigo-light text-bc-indigo-dark text-[10px]">
              {adaptations.filter(a => a.status === 'pending').length} pending
            </span>
            <span className="ml-auto bc-caption group-hover:text-primary transition-colors">
              {adaptationsSectionCollapsed ? 'Show' : 'Hide'}
            </span>
          </button>
          {!adaptationsSectionCollapsed && (
            <PlanAdaptationList adaptations={adaptations} onAccept={acceptAdaptation} onReject={rejectAdaptation} />
          )}
        </div>
      )}

      {/* ── Skip Intelligence ── */}
      {skipInsights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="bc-caption uppercase tracking-wider">Skipped Sessions</p>
              <span className="bc-pill bg-bc-red-light text-bc-red-dark text-[10px]">
                {skipInsights.length} impact{skipInsights.length !== 1 ? 's' : ''}
              </span>
            </div>
            {skipStats.phaseRisk && (
              <span className="text-[10px] font-semibold text-bc-red-dark">
                {skipStats.phaseRisk.projected}% projected · target 80%
              </span>
            )}
          </div>
          <div className="space-y-3">
            {skipInsights.map(insight => (
              <SkipInsightCard
                key={insight.id}
                insight={insight}
                onDismiss={id => {
                  setDismissedSkips(prev => {
                    const next = new Set([...prev, id]);
                    try {
                      localStorage.setItem('bc-dismissed-skips', JSON.stringify({
                        date: new Date().toLocaleDateString('en-CA'),
                        ids:  [...next],
                      }));
                    } catch {}
                    return next;
                  });
                }}
                onRescue={handleRescue}
              />
            ))}
          </div>
          {/* Weekly skip summary if rate is concerning */}
          {skipStats.skipRate >= 20 && (
            <div className="mt-3 p-3 bg-bc-orange-light rounded-[12px] border border-bc-orange/20">
              <p className="text-xs font-semibold text-bc-orange-dark">
                {skipStats.skipRate}% skip rate this week
                ({skipStats.skippedThisWeek}/{skipStats.plannedThisWeek} sessions)
              </p>
              <p className="bc-caption mt-0.5">
                {skipStats.onTrack
                  ? 'Still within acceptable range — keep going.'
                  : 'Above 20% — consider adjusting your schedule or reducing load.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Cross-Training Insights ── */}
      {visibleInsights.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => {
              const next = !insightsSectionCollapsed;
              setInsightsSectionCollapsed(next);
              if (next) localStorage.setItem('bc-insights-dismissed', JSON.stringify({ date: today }));
              else localStorage.removeItem('bc-insights-dismissed');
            }}
            className="flex items-center justify-between w-full mb-3 group min-h-[44px]">
            <div className="flex items-center gap-2">
              <p className="bc-caption uppercase tracking-wider">Cross-Training Insights</p>
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
                {visibleInsights.length} alert{visibleInsights.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="bc-caption group-hover:text-primary transition-colors">
              {insightsSectionCollapsed ? 'Show' : 'Hide'}
            </span>
          </button>
          {!insightsSectionCollapsed && (
            <div className="space-y-3">
              {visibleInsights.map(insight => (
                <InsightCard key={insight.id} insight={insight}
                  onDismiss={(id) => {
                    setDismissedInsights(prev => {
                      const next = new Set([...prev, id]);
                      try {
                        localStorage.setItem('bc-dismissed-insights', JSON.stringify({
                          date: new Date().toLocaleDateString('en-CA'),
                          ids:  [...next],
                        }));
                      } catch {}
                      return next;
                    });
                  }}
                  onAction={(i) => {
                    setDismissedInsights(prev => {
                      const next = new Set([...prev, i.id]);
                      try {
                        localStorage.setItem('bc-dismissed-insights', JSON.stringify({
                          date: new Date().toLocaleDateString('en-CA'),
                          ids:  [...next],
                        }));
                      } catch {}
                      return next;
                    });
                  }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Today's Plan ── */}
      <div className="bc-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="bc-caption uppercase tracking-wider mb-0">Today&apos;s Plan</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: fuelStatus.color }} />
              <span className="text-[10px] text-tertiary">{fuelStatus.label}</span>
            </div>
            <span className="text-xs text-tertiary">·</span>
            <span className="text-xs text-secondary">{formatDate(today)}</span>
          </div>
        </div>

        {todayWorkouts.length > 0 ? (
          <div className="space-y-3">
            {todayWorkouts.map(w => (
              <div key={w.id}
                className={`flex items-center justify-between p-3 rounded-[14px] border-l-4
                  ${w.type === 'run'    ? 'border-run-accent bg-run-bg'     :
                    w.type === 'lift'   ? 'border-lift-accent bg-lift-bg'   :
                    w.type === 'cardio' ? 'border-cardio-accent bg-cardio-bg' :
                                         'border-border bg-canvas'}
                  ${w.status === 'completed' ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  {w.status === 'planned' && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: fuelStatus.color }} />
                  )}
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                    {w.type === 'run'
                      ? <RunTypeIcon runType={w.details.runType} size={18} />
                      : <LiftSessionIcon sessionName={w.details.sessionName} size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {w.type === 'run'
                        ? (w.details.runDescription || w.details.runType || 'Run')
                        : (w.details.sessionName || 'Lift')}
                    </p>
                    <p className="text-xs text-secondary">
                      {w.type === 'run' && w.details.plannedDistance && (
                        <>{w.details.plannedDistance} mi
                          {w.details.targetPace ? ` @ ${w.details.targetPace}` : ''}</>
                      )}
                      {w.type === 'lift' && (w.details.muscleGroups || []).slice(0, 3).join(', ')}
                      {w.type === 'cardio' && (w.details.activityType || 'Cardio')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {w.status === 'planned' ? (
                    <button onClick={() => setLogTarget(w)} className="bc-btn-log min-h-[44px]">
                      Log It
                    </button>
                  ) : (
                    <>
                      <ShareWorkoutButton
                        workout={w}
                        userName={user?.display_name || user?.email?.split('@')[0] || ''}
                        deepLinkUrl={`https://basecamp.fit/workout/${w.id}`}
                        onShareComplete={(wk) => incrementShareCount(wk.id)}
                        variant="icon"
                      />
                      <span className="bc-pill bg-bc-green-light text-bc-green-dark text-xs flex items-center gap-1">
                        <StatusIcon status="completed" size={10} /> Done
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4">
            <p className="text-sm text-secondary mb-3">Nothing scheduled today.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setLogTarget({ type: 'run', status: 'planned', date: today, details: {} })}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-run-bg border border-run-accent/20 active:scale-95 transition-all">
                <RunTypeIcon runType="easy" size={16} />
                <span className="text-xs font-semibold text-run-accent">Log a Run</span>
              </button>
              <button onClick={() => setLogTarget({ type: 'lift', status: 'planned', date: today, details: {} })}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-[12px] bg-lift-bg border border-lift-accent/20 active:scale-95 transition-all">
                <LiftSessionIcon sessionName="" size={16} />
                <span className="text-xs font-semibold text-lift-accent">Log a Lift</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Readiness Score ── */}
      {readinessScore !== null && (
        <div className="bc-card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#F2F2F7" strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none"
                    stroke={getReadinessColor(readinessScore)}
                    strokeWidth="6" strokeLinecap="round" strokeDasharray="163.36"
                    strokeDashoffset={163.36 * (1 - readinessScore / 100)} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bc-data text-base font-bold" style={{ color: getReadinessColor(readinessScore) }}>
                    {readinessScore}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-primary">{getReadinessLabel(readinessScore)}</p>
                {checkInData && (
                  <p className="bc-caption mt-0.5">
                    {checkInData.sleepHours}h sleep · Energy {checkInData.energyLevel}/5 · Soreness {checkInData.soreness}/5
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setShowCheckIn(true)}
              className="bc-btn-secondary !text-xs !py-1.5 !px-3 min-h-[44px]">
              Update
            </button>
          </div>

          {shouldSuggestSwap(readinessScore, todayWorkouts) && (
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-bc-orange-light flex items-center justify-center flex-shrink-0 mt-0.5">
                <span style={{ color: '#FF9500', fontSize: '10px', fontWeight: 700 }}>!</span>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#E65100' }}>
                  Consider swapping today&apos;s hard session
                </p>
                <p className="bc-caption mt-0.5">
                  Your readiness is low. An easy run or rest day would help recovery.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="bc-caption uppercase tracking-wider">Performance</p>
          {stats.currentPhase && (
            <span className="bc-pill bg-canvas border border-border text-tertiary text-[10px] capitalize">
              {stats.currentPhase} phase{stats.weekNumber ? ` · Wk ${stats.weekNumber}` : ''}
            </span>
          )}
        </div>
        {/* Week selector dots */}
        {stats.weeklyHistory?.length > 1 && (
          <div className="flex items-center gap-3">
            <button onClick={() => setKpiWeekIndex(i => Math.max(0, i - 1))}
              className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-30 active:scale-95"
              disabled={kpiWeekIndex === 0}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="flex items-center gap-1">
              {stats.weeklyHistory.map((_, i) => (
                <button key={i} onClick={() => setKpiWeekIndex(i)}
                  className="rounded-full transition-all"
                  style={{ width: i === kpiWeekIndex ? 16 : 6, height: 6,
                    background: i === kpiWeekIndex ? '#007AFF' : '#D1D1D6' }} />
              ))}
            </div>
            <button onClick={() => setKpiWeekIndex(i => Math.min(3, i + 1))}
              className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center disabled:opacity-30 active:scale-95"
              disabled={kpiWeekIndex === 3}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
      {/* Week label */}
      {stats.weeklyHistory?.[kpiWeekIndex] && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              {stats.weeklyHistory[kpiWeekIndex].label}
            </span>
            <span className="text-[10px] text-tertiary">
              {stats.weeklyHistory[kpiWeekIndex].dateRange}
            </span>
          </div>
          <button onClick={() => setKpiExpanded(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-canvas border border-border text-[10px] font-medium text-secondary hover:text-primary transition-colors">
            {kpiExpanded ? 'Hide detail' : 'Daily breakdown'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: kpiExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      )}
      <div className="bento-grid mb-6">

        {/* ── Run Completion — swipeable week view ── */}
        {(() => {
          const wk = stats.weeklyHistory?.[kpiWeekIndex];
          if (!wk) return null;
          const dots = wk.runDots;
          const isCurrent = wk.isCurrent;
          return (
            <div className="bc-card p-4 bento-hero">
              {/* Day dot tracker */}
              <div className="flex items-center gap-1 mb-3">
                {dots.map((day, i) => (
                  <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full transition-all"
                      style={{
                        backgroundColor: day.completed ? '#2E7D32' : day.skipped ? '#FFEBEE' : day.planned ? '#A5D6A7' : day.isToday ? '#E8F5E9' : '#F2F2F7',
                        opacity: day.isFuture && !day.planned ? 0.35 : 1,
                      }} />
                    <span className="text-[8px] font-medium" style={{ color: day.isToday ? '#2E7D32' : '#AEAEB2' }}>{day.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="bc-caption uppercase tracking-wider mb-1">Runs</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-run-accent"
                      style={{ fontSize: '28px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {wk.runsDone}
                    </span>
                    <span className="text-sm text-tertiary">/ {wk.runsPlanned}</span>
                  </div>
                  {wk.runAdherence !== null && !isCurrent && (
                    <span className="text-[10px] font-semibold mt-0.5 block"
                      style={{ color: wk.runAdherence >= 85 ? '#2E7D32' : wk.runAdherence >= 70 ? '#E65100' : '#C62828' }}>
                      {wk.runAdherence}% adherence
                    </span>
                  )}
                </div>
                {wk.miles > 0 && (
                  <div className="text-right">
                    <p className="bc-caption uppercase tracking-wider mb-1">Miles</p>
                    <div className="flex items-baseline gap-0.5 justify-end">
                      <span className="font-bold text-primary"
                        style={{ fontSize: '22px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {wk.miles}
                      </span>
                      {isCurrent && stats.thisWeekPlannedMiles > 0 && (
                        <span className="text-xs text-tertiary">/{stats.thisWeekPlannedMiles} mi</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Phase bar — only on current week */}
              {isCurrent && stats.currentPhase && stats.phaseRunsTotal > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-tertiary capitalize">{stats.currentPhase} phase</span>
                    <span className="text-[10px] font-semibold text-run-accent">
                      {stats.phaseRunsDone}/{stats.phaseRunsTotal} runs · {Math.round((stats.phaseRunsDone / stats.phaseRunsTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-run-accent/60 transition-[width] duration-700"
                      style={{ width: `${Math.round((stats.phaseRunsDone / stats.phaseRunsTotal) * 100)}%` }} />
                  </div>
                </div>
              )}
              {/* Past week completion rate bar */}
              {!isCurrent && wk.runsPlanned > 0 && (
                <div>
                  <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.round((wk.runsDone / wk.runsPlanned) * 100)}%`,
                        background: wk.runsDone === wk.runsPlanned ? '#2E7D32' : wk.runsDone / wk.runsPlanned >= 0.7 ? '#FF9500' : '#FF3B30',
                      }} />
                  </div>
                  <p className="text-[10px] text-tertiary mt-1">
                    {Math.round((wk.runsDone / wk.runsPlanned) * 100)}% completion
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Lift Completion — swipeable week view ── */}
        {(() => {
          const wk = stats.weeklyHistory?.[kpiWeekIndex];
          if (!wk) return null;
          const dots = wk.liftDots;
          const isCurrent = wk.isCurrent;
          return (
            <div className="bc-card p-4 bento-half">
              <div className="flex items-center gap-1 mb-3">
                {dots.map((day, i) => (
                  <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full transition-all"
                      style={{
                        backgroundColor: day.completed ? '#1565C0' : day.skipped ? '#FFEBEE' : day.planned ? '#90CAF9' : day.isToday ? '#E3F2FD' : '#F2F2F7',
                        opacity: day.isFuture && !day.planned ? 0.35 : 1,
                      }} />
                    <span className="text-[8px] font-medium" style={{ color: day.isToday ? '#1565C0' : '#AEAEB2' }}>{day.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="bc-caption uppercase tracking-wider mb-1">Lifts</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-lift-accent"
                      style={{ fontSize: '28px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {wk.liftsDone}
                    </span>
                    <span className="text-sm text-tertiary">/ {wk.liftsPlanned}</span>
                  </div>
                </div>
                {wk.volume > 0 && (
                  <div className="text-right">
                    <p className="bc-caption uppercase tracking-wider mb-1">Volume</p>
                    <div className="flex items-baseline gap-0.5 justify-end">
                      <span className="font-bold text-primary"
                        style={{ fontSize: '22px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {(wk.volume / 1000).toFixed(1)}k
                      </span>
                      <span className="text-xs text-tertiary">lbs</span>
                    </div>
                  </div>
                )}
              </div>

              {isCurrent && stats.currentPhase && stats.phaseLiftsTotal > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-tertiary capitalize">{stats.currentPhase} phase</span>
                    <span className="text-[10px] font-semibold text-lift-accent">
                      {stats.phaseLiftsDone}/{stats.phaseLiftsTotal} lifts · {stats.phaseLiftRate}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-lift-accent/60 transition-[width] duration-700"
                      style={{ width: `${stats.phaseLiftRate}%` }} />
                  </div>
                </div>
              )}
              {!isCurrent && wk.liftsPlanned > 0 && (
                <div>
                  <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.round((wk.liftsDone / wk.liftsPlanned) * 100)}%`,
                        background: wk.liftsDone === wk.liftsPlanned ? '#1565C0' : wk.liftsDone / wk.liftsPlanned >= 0.7 ? '#FF9500' : '#FF3B30',
                      }} />
                  </div>
                  <p className="text-[10px] text-tertiary mt-1">
                    {Math.round((wk.liftsDone / wk.liftsPlanned) * 100)}% completion
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        <div className="bento-third"><TrainingLoadCard load={trainingLoad} /></div>

        {/* ── Weekly Miles ── */}
        <div className="bc-card p-4 bento-quarter">
          <p className="bc-caption uppercase tracking-wider mb-2">Weekly Miles</p>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-primary"
                style={{ fontSize: '24px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {stats.currentWeekMileage}
              </span>
              <span className="text-xs text-tertiary">mi</span>
            </div>
            <Sparkline data={stats.weeklyMileageData} color="#34C759" width={56} height={24} />
          </div>
          <p className="text-[10px] text-tertiary">4-week trend</p>
        </div>

        {/* ── Weekly Volume ── */}
        <div className="bc-card p-4 bento-quarter">
          <p className="bc-caption uppercase tracking-wider mb-2">Weekly Volume</p>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-primary"
                style={{ fontSize: '24px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {stats.currentWeekVolume > 0 ? (stats.currentWeekVolume / 1000).toFixed(1) + 'k' : '0'}
              </span>
              <span className="text-xs text-tertiary">lbs</span>
            </div>
            <Sparkline data={stats.weeklyVolumeData} color="#007AFF" width={56} height={24} />
          </div>
          <p className="text-[10px] text-tertiary">4-week trend</p>
        </div>

        {/* ── Streak ── */}
        <div className="bc-card p-4 bento-quarter">
          <p className="bc-caption uppercase tracking-wider mb-2">Streak</p>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-primary"
                style={{ fontSize: '24px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {stats.streak}
              </span>
              <span className="text-xs text-tertiary">{stats.streak === 1 ? 'day' : 'days'}</span>
            </div>
            <Flame size={22} style={{ color: '#FF9500' }} />
          </div>
          <p className="text-[10px] text-tertiary">in a row</p>
        </div>

        {/* ── Run Adherence (phase) ── */}
        {stats.phaseRunAdherence !== null ? (
          <div className="bc-card p-4 bento-quarter">
            <p className="bc-caption uppercase tracking-wider mb-2">Run Adherence</p>
            <div className="flex items-end justify-between mb-1">
              <div className="flex items-baseline gap-1">
                <span className="font-bold leading-none"
                  style={{
                    fontSize: '24px',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                    color: stats.phaseRunAdherence >= 85 ? '#2E7D32'
                         : stats.phaseRunAdherence >= 70 ? '#E65100'
                         : '#C62828',
                  }}>
                  {stats.phaseRunAdherence}
                </span>
                <span className="text-xs text-tertiary">%</span>
              </div>
              {/* Mini sparkline using inline SVG — shows 4-week adherence trend */}
              {(() => {
                const trend = stats.phaseRunAdherenceTrend.filter(v => v !== null);
                if (trend.length < 2) return null;
                const max = Math.max(...trend, 100);
                const w = 56, h = 24;
                const pts = trend.map((v, i) => {
                  const x = (i / (trend.length - 1)) * w;
                  const y = h - (v / max) * h;
                  return `${x},${y}`;
                }).join(' ');
                const color = stats.phaseRunAdherence >= 85 ? '#2E7D32'
                            : stats.phaseRunAdherence >= 70 ? '#FF9500'
                            : '#FF3B30';
                return (
                  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                    <polyline points={pts} fill="none" stroke={color}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      opacity="0.7" />
                    {/* dot on last point */}
                    {trend.length > 0 && (() => {
                      const last = trend[trend.length - 1];
                      const lx = w;
                      const ly = h - (last / max) * h;
                      return <circle cx={lx} cy={ly} r="2.5" fill={color} />;
                    })()}
                  </svg>
                );
              })()}
            </div>
            <p className="text-[10px] text-tertiary capitalize">
              {stats.currentPhase} phase
              {stats.phaseRunsSkipped > 0 && (
                <span className="ml-1" style={{
                  color: stats.phaseRunAdherence < 85 ? '#E65100' : '#AEAEB2'
                }}>
                  · {stats.phaseRunsSkipped} skipped
                </span>
              )}
            </p>
          </div>
        ) : (
          <div className="hidden md:block bento-quarter" />
        )}
      </div>

      {/* ── Daily Breakdown Panel ── */}
      {kpiExpanded && stats.weeklyHistory?.[kpiWeekIndex] && (() => {
        const wk = stats.weeklyHistory[kpiWeekIndex];
        const maxMiles  = Math.max(...wk.dailyMiles.map(d => d.value), 0.1);
        const maxVolume = Math.max(...wk.dailyVolume.map(d => d.value), 1);
        const hasRuns   = wk.dailyMiles.some(d => d.value > 0);
        const hasLifts  = wk.dailyVolume.some(d => d.value > 0);

        return (
          <div className="bc-card p-4 mb-6">
            <p className="bc-caption uppercase tracking-wider mb-4">Daily Breakdown · {wk.label}</p>

            {/* Miles per day bar chart */}
            {(hasRuns || wk.runsDone > 0) && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-run-accent">Miles / Day</span>
                  <span className="text-[10px] text-tertiary">{wk.miles} mi total</span>
                </div>
                <div className="flex items-end gap-1.5" style={{ height: 80 }}>
                  {wk.dailyMiles.map((d, i) => {
                    const pct     = maxMiles > 0 ? d.value / maxMiles : 0;
                    const isToday = wk.runDots[i]?.isToday;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[8px] text-tertiary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {d.value > 0 ? d.value : ''}
                        </span>
                        <div className="w-full rounded-t-[4px] transition-all duration-500"
                          style={{
                            height: Math.max(pct * 56, d.value > 0 ? 4 : 0),
                            background: isToday ? '#2E7D32' : d.value > 0 ? '#A5D6A7' : 'transparent',
                          }} />
                        <span className="text-[8px] font-medium"
                          style={{ color: isToday ? '#2E7D32' : '#AEAEB2' }}>
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Volume per day bar chart */}
            {(hasLifts || wk.liftsDone > 0) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-lift-accent">Volume / Day</span>
                  <span className="text-[10px] text-tertiary">
                    {wk.volume > 0 ? `${(wk.volume / 1000).toFixed(1)}k lbs total` : '0 lbs'}
                  </span>
                </div>
                <div className="flex items-end gap-1.5" style={{ height: 80 }}>
                  {wk.dailyVolume.map((d, i) => {
                    const pct     = maxVolume > 0 ? d.value / maxVolume : 0;
                    const isToday = wk.liftDots[i]?.isToday;
                    const label   = d.value >= 1000
                      ? `${(d.value / 1000).toFixed(1)}k`
                      : d.value > 0 ? String(d.value) : '';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[8px] text-tertiary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {label}
                        </span>
                        <div className="w-full rounded-t-[4px] transition-all duration-500"
                          style={{
                            height: Math.max(pct * 56, d.value > 0 ? 4 : 0),
                            background: isToday ? '#1565C0' : d.value > 0 ? '#90CAF9' : 'transparent',
                          }} />
                        <span className="text-[8px] font-medium"
                          style={{ color: isToday ? '#1565C0' : '#AEAEB2' }}>
                          {wk.dailyMiles[i].day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasRuns && !hasLifts && (
              <p className="text-sm text-tertiary text-center py-4">No workouts logged this week</p>
            )}
          </div>
        );
      })()}

      {/* ── Weekly Training Load Chart ── */}
      <p className="bc-caption uppercase tracking-wider mb-3">Weekly Training Load</p>
      <div className="bc-card p-5 mb-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height={192} minWidth={200}>
            <BarChart data={weeklyChartData} barGap={2}>
              <XAxis dataKey="day" axisLine={false} tickLine={false}
                tick={{ fill: '#8E8E93', fontSize: 11, fontFamily: 'var(--font-dm-sans)' }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', border: '0.5px solid rgba(60,60,67,0.12)', borderRadius: '14px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={{ fill: 'rgba(0,122,255,0.06)' }}
              />
              <Bar dataKey="runMiles" name="Run (mi)" stackId="stack" radius={[0,0,4,4]}>
                {weeklyChartData.map((_, i) => <Cell key={i} fill="#34C759" fillOpacity={0.85} />)}
              </Bar>
              <Bar dataKey="liftScore" name="Lift (score)" stackId="stack" radius={[4,4,0,0]}>
                {weeklyChartData.map((_, i) => <Cell key={i} fill="#007AFF" fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#34C759', opacity: 0.85 }} />
            <span className="text-xs text-tertiary">Run Miles</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#007AFF', opacity: 0.85 }} />
            <span className="text-xs text-tertiary">Lift Score</span>
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <p className="bc-caption uppercase tracking-wider mb-3">Recent Activity</p>
      <div className="space-y-2 mb-6">
        {recentActivity.map(w => (
          <div key={w.id} className={`bc-card p-3 flex items-center justify-between border-l-4
            ${w.type === 'run' ? 'border-run-accent' : w.type === 'lift' ? 'border-lift-accent' : 'border-cardio-accent'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${w.type === 'run' ? 'bg-run-bg' : w.type === 'lift' ? 'bg-lift-bg' : 'bg-cardio-bg'}`}>
                <ActivityIcon type={w.type} size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">
                  {w.type === 'run' ? (w.details.runType || 'Run') : (w.details.sessionName || 'Lift')}
                </p>
                <p className="text-xs text-secondary">{formatDate(w.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {w.type === 'run' && w.details.actualDistance && (
                <span className="bc-data text-sm text-secondary">{w.details.actualDistance} mi</span>
              )}
              {w.type === 'run' && w.details.actualPace && (
                <span className="bc-data-mono text-sm text-run-accent">{w.details.actualPace}</span>
              )}
              {w.type === 'lift' && w.details.totalVolume && (
                <span className="bc-data text-sm text-lift-accent">{formatVolume(w.details.totalVolume)}</span>
              )}
              <ShareWorkoutButton
                workout={w}
                userName={user?.display_name || user?.email?.split('@')[0] || ''}
                deepLinkUrl={`https://basecamp.fit/workout/${w.id}`}
                onShareComplete={(wk) => incrementShareCount(wk.id)}
                variant="icon"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent PRs ── */}
      <div className="mb-6"><RecentPRs prs={prs.recent} /></div>

      {/* ── Modals ── */}
      {logTarget && (
        <LogForm workout={logTarget} onSave={handleSave} onClose={() => setLogTarget(null)} />
      )}
      {showCheckIn && (
        <ReadinessCheckIn onComplete={handleCheckInComplete} onClose={() => setShowCheckIn(false)} />
      )}
    </div>
  );
}


// ── Helpers ──────────────────────────────────────────────

function getWeeklyData(workouts, getValue) {
  if (workouts.length === 0) return [0, 0, 0, 0];
  const now = new Date();
  const weeks = [0, 0, 0, 0];
  workouts.forEach(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T12:00:00')) / (1000 * 60 * 60 * 24));
    if (diffDays < 7)       weeks[3] += getValue(w);
    else if (diffDays < 14) weeks[2] += getValue(w);
    else if (diffDays < 21) weeks[1] += getValue(w);
    else if (diffDays < 28) weeks[0] += getValue(w);
  });
  return weeks;
}

function calculateStreak(workouts) {
  const completedDates = new Set(
    workouts.filter(w => w.status === 'completed').map(w => w.date)
  );
  let streak = 0;
  // FIX: local date for streak calculation
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (completedDates.has(todayStr)) streak++;
  const check = new Date();
  check.setDate(check.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const dateStr = check.toLocaleDateString('en-CA');
    if (completedDates.has(dateStr)) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
}

function buildWeeklyChartData(workouts) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  return dayNames.map((day, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    // FIX: local date string for chart day matching
    const dateStr = date.toLocaleDateString('en-CA');
    const dayWorkouts = workouts.filter(w => w.date === dateStr);
    const runMiles = dayWorkouts
      .filter(w => w.type === 'run' && w.status === 'completed')
      .reduce((sum, w) => sum + (w.details.actualDistance || w.details.plannedDistance || 0), 0);
    const liftVolume = dayWorkouts
      .filter(w => w.type === 'lift' && w.status === 'completed')
      .reduce((sum, w) => sum + (w.details.totalVolume || 0), 0);
    return {
      day,
      date:      dateStr,
      runMiles:  Math.round(runMiles  * 10) / 10,
      liftScore: Math.round((liftVolume / 1000) * 10) / 10,
    };
  });
}