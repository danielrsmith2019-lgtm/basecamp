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
import { getFuelStatus } from '@/utils/nutrition';
import ShareWorkoutButton from '@/components/shared/ShareWorkoutButton';
import { incrementShareCount } from '@/lib/share-tracking';


export default function Dashboard() {
  const { workouts, prs, saveWorkout, isLoaded, adaptations, acceptAdaptation, rejectAdaptation } = useWorkouts();
  const { user } = useAuth();

  const [logTarget, setLogTarget]                 = useState(null);
  const [justLogged, setJustLogged]               = useState(null); // ADDED: track just-completed workout for share prompt
  const [dismissedInsights, setDismissedInsights] = useState(new Set());
  const [showCheckIn, setShowCheckIn]             = useState(false);
  const [checkInData, setCheckInData]             = useState(null);
  const [readinessScore, setReadinessScore]       = useState(null);
  const [todayCalories, setTodayCalories]         = useState(0);
  const [todayCalTarget, setTodayCalTarget]       = useState(2000);

  const today = new Date().toISOString().split('T')[0];

  const [insightsSectionCollapsed, setInsightsSectionCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('bc-insights-dismissed');
    if (!stored) return false;
    const { date } = JSON.parse(stored);
    return date === new Date().toISOString().split('T')[0];
  });

  const [adaptationsSectionCollapsed, setAdaptationsSectionCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('bc-adaptations-dismissed');
    if (!stored) return false;
    const { date } = JSON.parse(stored);
    return date === new Date().toISOString().split('T')[0];
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
          settings.last_checkin_data,
          workouts,
          getNutritionLog,
          user.id
        );
        setReadinessScore(score);
      }
    }
    checkTrigger();
  }, [user, isLoaded, workouts]);

  // ── Nutrition fuel status load ─────────────────────────
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

  const stats = useMemo(() => {
    const runs  = workouts.filter(w => w.type === 'run');
    const lifts = workouts.filter(w => w.type === 'lift');
    const completedRuns  = runs.filter(w => w.status === 'completed');
    const completedLifts = lifts.filter(w => w.status === 'completed');
    const plannedRuns    = runs.filter(w => w.status !== 'skipped');
    const plannedLifts   = lifts.filter(w => w.status !== 'skipped');

    // ── Weekly progress (this week's sessions by day) ──
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().split('T')[0];

    const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const thisWeekRunProgress = weekDays.map((label, i) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
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
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
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

    return {
      runCompletionRate:  plannedRuns.length  > 0 ? Math.round((completedRuns.length  / plannedRuns.length)  * 100) : 0,
      liftCompletionRate: plannedLifts.length > 0 ? Math.round((completedLifts.length / plannedLifts.length) * 100) : 0,
      completedRuns:  completedRuns.length,
      totalRuns:      plannedRuns.length,
      completedLifts: completedLifts.length,
      totalLifts:     plannedLifts.length,
      currentWeekMileage: (getWeeklyData(completedRuns,  w => w.details.actualDistance || 0)[3] || 0).toFixed(1),
      weeklyMileageData:   getWeeklyData(completedRuns,  w => w.details.actualDistance || 0),
      currentWeekVolume:   getWeeklyData(completedLifts, w => w.details.totalVolume    || 0)[3] || 0,
      weeklyVolumeData:    getWeeklyData(completedLifts, w => w.details.totalVolume    || 0),
      streak: calculateStreak(workouts),
      thisWeekRunProgress,
      thisWeekLiftProgress,
      thisWeekRunsCompleted,
      thisWeekRunsPlanned,
      thisWeekLiftsCompleted,
      thisWeekLiftsPlanned,
    };
  }, [workouts]);

  const todayWorkouts = useMemo(() =>
    workouts.filter(w => w.date === today && w.type !== 'rest'),
  [workouts, today]);

  const recentActivity = useMemo(() =>
    workouts.filter(w => w.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
  [workouts]);

  const weeklyChartData = useMemo(() => buildWeeklyChartData(workouts), [workouts]);

  // ── Fuel status ────────────────────────────────────────
  const fuelStatus = getFuelStatus(todayCalories, todayCalTarget);

  // CHANGED: save handler now tracks just-logged workout for share prompt
  function handleSave(data) {
    saveWorkout(data);
    if (data.status === 'completed') {
      setJustLogged(data);
    }
    setLogTarget(null);
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>

      {/* ── Post-workout share prompt ── */}
      {/* ADDED: shows after logging a completed workout */}
      {justLogged && (
        <div className="bc-card mb-6 border-l-4 border-bc-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
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
              <button
                onClick={() => setJustLogged(null)}
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
              if (next) {
                localStorage.setItem('bc-adaptations-dismissed', JSON.stringify({ date: today }));
              } else {
                localStorage.removeItem('bc-adaptations-dismissed');
              }
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
            <PlanAdaptationList
              adaptations={adaptations}
              onAccept={acceptAdaptation}
              onReject={rejectAdaptation}
            />
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
              if (next) {
                localStorage.setItem('bc-insights-dismissed', JSON.stringify({ date: today }));
              } else {
                localStorage.removeItem('bc-insights-dismissed');
              }
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
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onDismiss={(id) => setDismissedInsights(prev => new Set([...prev, id]))}
                  onAction={(i)  => setDismissedInsights(prev => new Set([...prev, i.id]))}
                />
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
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: fuelStatus.color }}
                title={fuelStatus.label}
              />
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
                  ${w.type === 'run' ? 'border-run-accent bg-run-bg' : 'border-lift-accent bg-lift-bg'}
                  ${w.status === 'completed' ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  {w.status === 'planned' && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: fuelStatus.color }}
                      title={`Fuel: ${fuelStatus.label} · ${todayCalories} of ${todayCalTarget} cal`}
                    />
                  )}
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                    {w.type === 'run'
                      ? <RunTypeIcon runType={w.details.runType} size={18} />
                      : <LiftSessionIcon sessionName={w.details.sessionName} size={18} />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {w.type === 'run'
                        ? w.details.runDescription || w.details.runType
                        : w.details.sessionName}
                    </p>
                    <p className="text-xs text-secondary">
                      {w.type === 'run' && (
                        <>
                          <span className="bc-data">{w.details.plannedDistance} mi</span>
                          {' @ '}
                          <span className="bc-data">{w.details.targetPace}</span>
                        </>
                      )}
                      {w.type === 'lift' && (w.details.muscleGroups || []).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.status === 'planned' ? (
                    <button onClick={() => setLogTarget(w)} className="bc-btn-log min-h-[44px]">
                      Log It
                    </button>
                  ) : (
                    <>
                      {/* ADDED: share icon on completed today's workouts */}
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
          <div className="bc-empty py-6">
            <p className="bc-empty-title">No workouts scheduled for today.</p>
            <p className="bc-empty-text">Rest day or add a session from the schedule.</p>
          </div>
        )}
      </div>

      {/* ── Readiness Score ── */}
      {readinessScore !== null && (
        <div className="bc-card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full"
                     style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#F2F2F7" strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none"
                    stroke={getReadinessColor(readinessScore)}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="163.36"
                    strokeDashoffset={163.36 * (1 - readinessScore / 100)} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bc-data text-base font-bold"
                        style={{ color: getReadinessColor(readinessScore) }}>
                    {readinessScore}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-primary">
                  {getReadinessLabel(readinessScore)}
                </p>
                {checkInData && (
                  <p className="bc-caption mt-0.5">
                    🌙 {checkInData.sleepHours}h
                    {' · '}Energy {checkInData.energyLevel}/5
                    {' · '}Soreness {checkInData.soreness}/5
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCheckIn(true)}
              className="bc-btn-secondary !text-xs !py-1.5 !px-3 min-h-[44px]">
              Update
            </button>
          </div>

          {shouldSuggestSwap(readinessScore, todayWorkouts) && (
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
              <span className="text-base" style={{ color: '#FF9500' }}>⚠️</span>
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
      {/* CHANGED: bento-grid gets responsive overrides for mobile 2-col */}
      <p className="bc-caption uppercase tracking-wider mb-3">Performance</p>
      <div className="bento-grid mb-6">

        {/* ── Run Completion ── */}
        <div className="bc-card p-5 bento-hero">
          <div className="flex items-start justify-between mb-1">
            <Metric label="Run Completion" value={`${stats.runCompletionRate}%`} size="hero" color="text-run-accent" />
            <span className="bc-caption mt-1">
              {stats.thisWeekRunsCompleted}/{stats.thisWeekRunsPlanned} this week
            </span>
          </div>
          <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden mt-2 mb-3">
            <div className="h-full rounded-full bg-run-accent transition-[width] duration-700 ease-out"
              style={{ width: `${stats.runCompletionRate}%` }} />
          </div>
          {/* Weekly day bars */}
          <div className="flex items-center gap-1 mb-2">
            {stats.thisWeekRunProgress.map((day, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className="w-full h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor:
                      day.completed ? '#2E7D32' :
                      day.skipped   ? '#FFEBEE' :
                      day.planned   ? '#A5D6A7' :
                      day.isToday   ? '#E8F5E9' :
                      '#F2F2F7',
                    opacity: day.isFuture && !day.planned ? 0.4 : 1,
                  }}
                />
                <span className="text-[8px] font-medium"
                      style={{ color: day.isToday ? '#2E7D32' : '#AEAEB2' }}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-tertiary">
            <span className="bc-data">{stats.completedRuns}</span> of{' '}
            <span className="bc-data">{stats.totalRuns}</span> total runs
          </p>
        </div>

        {/* ── Lift Completion ── */}
        <div className="bc-card p-5 bento-half">
          <div className="flex items-start justify-between mb-1">
            <Metric label="Lift Completion" value={`${stats.liftCompletionRate}%`} size="hero" color="text-lift-accent" />
            <span className="bc-caption mt-1">
              {stats.thisWeekLiftsCompleted}/{stats.thisWeekLiftsPlanned} this week
            </span>
          </div>
          <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden mt-2 mb-3">
            <div className="h-full rounded-full bg-lift-accent transition-[width] duration-700 ease-out"
              style={{ width: `${stats.liftCompletionRate}%` }} />
          </div>
          {/* Weekly day bars */}
          <div className="flex items-center gap-1 mb-2">
            {stats.thisWeekLiftProgress.map((day, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className="w-full h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor:
                      day.completed ? '#1565C0' :
                      day.skipped   ? '#FFEBEE' :
                      day.planned   ? '#90CAF9' :
                      day.isToday   ? '#E3F2FD' :
                      '#F2F2F7',
                    opacity: day.isFuture && !day.planned ? 0.4 : 1,
                  }}
                />
                <span className="text-[8px] font-medium"
                      style={{ color: day.isToday ? '#1565C0' : '#AEAEB2' }}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-tertiary">
            <span className="bc-data">{stats.completedLifts}</span> of{' '}
            <span className="bc-data">{stats.totalLifts}</span> total lifts
          </p>
        </div>

        {/* ── Training Load ── */}
        <div className="bento-third">
          <TrainingLoadCard load={trainingLoad} />
        </div>

        {/* ── Weekly Miles ── */}
        <div className="bc-card p-4 bento-quarter">
          <div className="flex items-end justify-between mb-1">
            <Metric label="Weekly Miles" value={stats.currentWeekMileage} size="lg" />
            <Sparkline data={stats.weeklyMileageData} color="#34C759" width={60} height={20} />
          </div>
          <p className="text-[10px] text-tertiary">Last 4 weeks trend</p>
        </div>

        {/* ── Weekly Volume ── */}
        <div className="bc-card p-4 bento-quarter">
          <div className="flex items-end justify-between mb-1">
            <Metric
              label="Weekly Volume"
              value={stats.currentWeekVolume > 0
                ? (stats.currentWeekVolume / 1000).toFixed(1) + 'k'
                : '0'}
              unit="lbs"
              size="lg"
            />
            <Sparkline data={stats.weeklyVolumeData} color="#007AFF" width={60} height={20} />
          </div>
          <p className="text-[10px] text-tertiary">Last 4 weeks</p>
        </div>

        {/* ── Streak ── */}
        <div className="bc-card p-4 bento-quarter">
          <p className="bc-caption uppercase tracking-wider mb-2">Streak</p>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <span className="bc-data text-2xl font-bold text-primary">{stats.streak}</span>
              <span className="bc-data text-sm text-tertiary">
                {stats.streak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <Flame size={22} style={{ color: '#FF9500' }} />
          </div>
          <p className="text-[10px] text-tertiary">in a row</p>
        </div>

        <div className="hidden md:block bento-quarter" />
      </div>

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
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '0.5px solid rgba(60,60,67,0.12)',
                  borderRadius: '14px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-jetbrains)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ color: '#1C1C1E', marginBottom: '4px' }}
                itemStyle={{ color: '#8E8E93', padding: '1px 0' }}
                cursor={{ fill: 'rgba(0,122,255,0.06)' }}
              />
              <Bar dataKey="runMiles" name="Run (mi)" stackId="stack" radius={[0, 0, 4, 4]}>
                {weeklyChartData.map((_, i) => <Cell key={i} fill="#34C759" fillOpacity={0.85} />)}
              </Bar>
              <Bar dataKey="liftScore" name="Lift (score)" stackId="stack" radius={[4, 4, 0, 0]}>
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
            ${w.type === 'run' ? 'border-run-accent' : 'border-lift-accent'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${w.type === 'run' ? 'bg-run-bg' : 'bg-lift-bg'}`}>
                <ActivityIcon type={w.type} size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">
                  {w.type === 'run' ? w.details.runType : w.details.sessionName}
                </p>
                <p className="text-xs text-secondary">{formatDate(w.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {w.type === 'run' && w.details.actualDistance && (
                <span className="bc-data text-sm text-secondary">{w.details.actualDistance} mi</span>
              )}
              {w.type === 'run' && w.details.actualPace && (
                <span className="bc-data text-sm text-run-accent">{w.details.actualPace}</span>
              )}
              {w.type === 'lift' && w.details.totalVolume && (
                <span className="bc-data text-sm text-lift-accent">{formatVolume(w.details.totalVolume)}</span>
              )}
              {/* ADDED: share icon on recent activity items */}
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
      <div className="mb-6">
        <RecentPRs prs={prs.recent} />
      </div>

      {/* ── Modals ── */}
      {logTarget && (
        <LogForm workout={logTarget} onSave={handleSave} onClose={() => setLogTarget(null)} />
      )}
      {showCheckIn && (
        <ReadinessCheckIn
          onComplete={handleCheckInComplete}
          onClose={() => setShowCheckIn(false)}
        />
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
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
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
  const now = new Date();
  if (completedDates.has(now.toISOString().split('T')[0])) streak++;
  const check = new Date(now);
  check.setDate(check.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const dateStr = check.toISOString().split('T')[0];
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
    const dateStr = date.toISOString().split('T')[0];
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