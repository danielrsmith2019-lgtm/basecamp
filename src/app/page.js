'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatDate, getRunTypeEmoji } from '@/utils/runUtils';
import { getSessionEmoji, formatVolume } from '@/utils/liftUtils';
import { generateInsights, calculateTrainingLoad } from '@/utils/insights';
import Sparkline from '@/components/shared/Sparkline';
import InsightCard from '@/components/shared/InsightCard';
import TrainingLoadCard from '@/components/shared/TrainingLoadCard';
import RecentPRs from '@/components/shared/RecentPRs';
import LogForm from '@/components/shared/LogForm';
import { useWorkouts } from '@/lib/WorkoutContext';

export default function Dashboard() {
  const { workouts, prs, saveWorkout, isLoaded } = useWorkouts();
  const [logTarget, setLogTarget] = useState(null);
  const [dismissedInsights, setDismissedInsights] = useState(new Set());

  const today = new Date().toISOString().split('T')[0];

  const allInsights = useMemo(() => generateInsights(workouts), [workouts]);
  const trainingLoad = useMemo(() => calculateTrainingLoad(workouts), [workouts]);
  const visibleInsights = useMemo(() => {
    return allInsights.filter(i => !dismissedInsights.has(i.id));
  }, [allInsights, dismissedInsights]);

  const stats = useMemo(() => {
    const runs = workouts.filter(w => w.type === 'run');
    const lifts = workouts.filter(w => w.type === 'lift');
    const completedRuns = runs.filter(w => w.status === 'completed');
    const completedLifts = lifts.filter(w => w.status === 'completed');
    const plannedRuns = runs.filter(w => w.status !== 'skipped');
    const plannedLifts = lifts.filter(w => w.status !== 'skipped');

    return {
      runCompletionRate: plannedRuns.length > 0
        ? Math.round((completedRuns.length / plannedRuns.length) * 100) : 0,
      liftCompletionRate: plannedLifts.length > 0
        ? Math.round((completedLifts.length / plannedLifts.length) * 100) : 0,
      completedRuns: completedRuns.length,
      totalRuns: plannedRuns.length,
      completedLifts: completedLifts.length,
      totalLifts: plannedLifts.length,
      currentWeekMileage: (getWeeklyData(completedRuns, w => w.details.actualDistance || 0)[3] || 0).toFixed(1),
      weeklyMileageData: getWeeklyData(completedRuns, w => w.details.actualDistance || 0),
      currentWeekVolume: getWeeklyData(completedLifts, w => w.details.totalVolume || 0)[3] || 0,
      weeklyVolumeData: getWeeklyData(completedLifts, w => w.details.totalVolume || 0),
      streak: calculateStreak(workouts),
    };
  }, [workouts]);

  const todayWorkouts = useMemo(() => workouts.filter(w => w.date === today), [workouts, today]);
  const recentActivity = useMemo(() => {
    return workouts.filter(w => w.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [workouts]);
  const weeklyChartData = useMemo(() => buildWeeklyChartData(workouts), [workouts]);

  function handleSave(data) {
    saveWorkout(data);
    setLogTarget(null);
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* INSIGHTS */}
      {visibleInsights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="stride-section-label mb-0">Cross-Training Insights</p>
            <span className="stride-badge bg-phase-peak/20 text-phase-peak text-[10px]">
              {visibleInsights.length} alert{visibleInsights.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {visibleInsights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={(id) => setDismissedInsights(prev => new Set([...prev, id]))}
                onAction={(i) => setDismissedInsights(prev => new Set([...prev, i.id]))}
              />
            ))}
          </div>
        </div>
      )}

      {/* TODAY'S PLAN */}
      <div className="stride-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="stride-section-label mb-0">Today&apos;s Plan</p>
          <span className="text-xs text-secondary">{formatDate(today)}</span>
        </div>
        {todayWorkouts.length > 0 ? (
          <div className="space-y-3">
            {todayWorkouts.map(w => (
              <div key={w.id} className={`flex items-center justify-between p-3 rounded-lg border-l-4
                ${w.type === 'run' ? 'border-activity-run' : 'border-activity-lift'}
                ${w.status === 'completed' ? 'bg-status-done/5' : 'bg-surface'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {w.type === 'run' ? getRunTypeEmoji(w.details.runType) : getSessionEmoji(w.details.sessionName)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {w.type === 'run' ? w.details.runDescription || w.details.runType : w.details.sessionName}
                    </p>
                    <p className="text-xs text-secondary">
                      {w.type === 'run' && (<><span className="stride-data">{w.details.plannedDistance} mi</span> @ <span className="stride-data">{w.details.targetPace}</span></>)}
                      {w.type === 'lift' && (w.details.muscleGroups || []).join(', ')}
                    </p>
                  </div>
                </div>
                {w.status === 'planned' ? (
                  <button onClick={() => setLogTarget(w)}
                    className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:brightness-110 transition-all">
                    Log It
                  </button>
                ) : (
                  <span className="stride-badge bg-status-done/20 text-status-done text-xs">✓ Done</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-secondary text-sm">No workouts scheduled for today.</p>
            <p className="text-muted text-xs mt-1">Rest day or add a session from the schedule.</p>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <p className="stride-section-label">Performance</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="stride-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Run Completion</p>
          <p className="stride-data text-2xl font-bold text-phase-base mb-1">{stats.runCompletionRate}%</p>
          <div className="stride-progress-track mb-1">
            <div className="h-full rounded-full bg-[image:var(--gradient-completion)]"
              style={{ width: `${stats.runCompletionRate}%`, transition: 'width 0.8s ease' }} />
          </div>
          <p className="text-[10px] text-muted"><span className="stride-data">{stats.completedRuns}</span> of <span className="stride-data">{stats.totalRuns}</span> runs</p>
        </div>

        <div className="stride-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Lift Completion</p>
          <p className="stride-data text-2xl font-bold text-activity-lift mb-1">{stats.liftCompletionRate}%</p>
          <div className="stride-progress-track mb-1">
            <div className="h-full rounded-full bg-[image:var(--gradient-mileage)]"
              style={{ width: `${stats.liftCompletionRate}%`, transition: 'width 0.8s ease' }} />
          </div>
          <p className="text-[10px] text-muted"><span className="stride-data">{stats.completedLifts}</span> of <span className="stride-data">{stats.totalLifts}</span> lifts</p>
        </div>

        <TrainingLoadCard load={trainingLoad} />

        <div className="stride-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Weekly Miles</p>
          <div className="flex items-end justify-between mb-1">
            <p className="stride-data text-2xl font-bold text-primary">{stats.currentWeekMileage}</p>
            <Sparkline data={stats.weeklyMileageData} color="#4ADE80" width={60} height={20} />
          </div>
          <p className="text-[10px] text-muted">Last 4 weeks trend</p>
        </div>

        <div className="stride-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Weekly Volume</p>
          <div className="flex items-end justify-between mb-1">
            <p className="stride-data text-xl font-bold text-primary">
              {stats.currentWeekVolume > 0 ? (stats.currentWeekVolume / 1000).toFixed(1) + 'k' : '0'}
            </p>
            <Sparkline data={stats.weeklyVolumeData} color="#60A5FA" width={60} height={20} />
          </div>
          <p className="text-[10px] text-muted">lbs · Last 4 weeks</p>
        </div>

        <div className="stride-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Streak</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <p className="stride-data text-3xl font-bold text-primary">{stats.streak}</p>
          </div>
          <p className="text-[10px] text-muted mt-1">{stats.streak === 1 ? 'day' : 'days'} in a row</p>
        </div>
      </div>

      {/* WEEKLY CHART */}
      <p className="stride-section-label">Weekly Training Load</p>
      <div className="stride-card p-5 mb-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height={192} minWidth={200}>
            <BarChart data={weeklyChartData} barGap={2}>
              <XAxis dataKey="day" axisLine={false} tickLine={false}
                tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'var(--font-dm-sans)' }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-jetbrains)' }}
                labelStyle={{ color: '#E2E8F0', marginBottom: '4px' }}
                itemStyle={{ color: '#94A3B8', padding: '1px 0' }}
                cursor={{ fill: 'rgba(37, 99, 235, 0.1)' }} />
              <Bar dataKey="runMiles" name="Run (mi)" stackId="stack" radius={[0, 0, 0, 0]}>
                {weeklyChartData.map((_, i) => <Cell key={i} fill="#4ADE80" fillOpacity={0.8} />)}
              </Bar>
              <Bar dataKey="liftScore" name="Lift (score)" stackId="stack" radius={[4, 4, 0, 0]}>
                {weeklyChartData.map((_, i) => <Cell key={i} fill="#60A5FA" fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-activity-run opacity-80" /><span className="text-xs text-muted">Run Miles</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-activity-lift opacity-80" /><span className="text-xs text-muted">Lift Score</span></div>
        </div>
      </div>

      {/* RECENT PRs */}
      <div className="mb-6">
        <RecentPRs prs={prs.recent} />
      </div>

      {/* RECENT ACTIVITY */}
      <p className="stride-section-label">Recent Activity</p>
      <div className="space-y-2 mb-6">
        {recentActivity.map(w => (
          <div key={w.id} className={`stride-card stride-accent-left p-3 flex items-center justify-between
            ${w.type === 'run' ? 'border-activity-run' : 'border-activity-lift'}`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{w.type === 'run' ? getRunTypeEmoji(w.details.runType) : getSessionEmoji(w.details.sessionName)}</span>
              <div>
                <p className="text-sm font-medium text-primary">{w.type === 'run' ? w.details.runType : w.details.sessionName}</p>
                <p className="text-xs text-secondary">{formatDate(w.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {w.type === 'run' && w.details.actualDistance && <span className="stride-data text-sm text-secondary">{w.details.actualDistance} mi</span>}
              {w.type === 'run' && w.details.actualPace && <span className="stride-data text-sm text-primary">{w.details.actualPace}</span>}
              {w.type === 'lift' && w.details.totalVolume && <span className="stride-data text-sm text-activity-lift">{formatVolume(w.details.totalVolume)}</span>}
            </div>
          </div>
        ))}
      </div>

      {logTarget && <LogForm workout={logTarget} onSave={handleSave} onClose={() => setLogTarget(null)} />}
    </div>
  );
}

// ── Helpers (unchanged) ──
function getWeeklyData(workouts, getValue) {
  if (workouts.length === 0) return [0, 0, 0, 0];
  const now = new Date();
  const weeks = [0, 0, 0, 0];
  workouts.forEach(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) weeks[3] += getValue(w);
    else if (diffDays < 14) weeks[2] += getValue(w);
    else if (diffDays < 21) weeks[1] += getValue(w);
    else if (diffDays < 28) weeks[0] += getValue(w);
  });
  return weeks;
}

function calculateStreak(workouts) {
  const completedDates = new Set(workouts.filter(w => w.status === 'completed').map(w => w.date));
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
    const runMiles = dayWorkouts.filter(w => w.type === 'run' && w.status === 'completed')
      .reduce((sum, w) => sum + (w.details.actualDistance || w.details.plannedDistance || 0), 0);
    const liftVolume = dayWorkouts.filter(w => w.type === 'lift' && w.status === 'completed')
      .reduce((sum, w) => sum + (w.details.totalVolume || 0), 0);
    return { day, date: dateStr, runMiles: Math.round(runMiles * 10) / 10, liftScore: Math.round((liftVolume / 1000) * 10) / 10 };
  });
}