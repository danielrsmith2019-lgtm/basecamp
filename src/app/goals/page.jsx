'use client';

/**
 * Goals — Multi-sport goal tracking with progress rings.
 * Goals are computed from actual workout data, not manually entered.
 *
 * Three sections: Running Goals, Lifting Goals, Combined Goals.
 * Each goal shows a progress ring, on-track/behind status, and projected date.
 */

import { useState, useMemo } from 'react';
import { useWorkouts } from '@/lib/WorkoutContext';
import { formatDate, parsePace } from '@/utils/runUtils';
import { calculateE1RM, formatVolume } from '@/utils/liftUtils';
import ProgressRing from '@/components/shared/ProgressRing';
import { Flame, Trophy, Target, Footprints, Dumbbell, BarChart3, CalendarCheck, Repeat, Scale } from 'lucide-react';

// ═══════════════════════════════════════════════════════
// GOAL DEFINITIONS (unchanged)
// ═══════════════════════════════════════════════════════

const GOAL_TEMPLATES = {
  running: [
    { id: 'run-plan-completion', title: 'Complete Training Plan', description: 'Finish all planned runs in the training plan.', icon: '📋', compute: computePlanCompletion },
    { id: 'run-weekly-mileage', title: 'Weekly Mileage Target', description: 'Hit 25+ miles in a single week.', icon: CalendarCheck, target: 25, compute: computeWeeklyMileage },
    { id: 'run-race-pace', title: 'Sub-4:00 Marathon Pace', description: 'Average pace under 9:09/mi on long runs.', icon: '🏁', targetPace: 9.15, compute: computeRacePace },
    { id: 'run-long-run-distance', title: 'Long Run 10+ Miles', description: 'Complete a long run of 10 miles or more.', icon: '🏔️', target: 10, compute: computeLongRunDistance },
  ],
  lifting: [
    { id: 'lift-bench-pr', title: 'Bench Press 225 lbs', description: 'Estimated 1RM of 225 lbs on bench press.', icon: '💪', exercise: 'Barbell Bench Press', target: 225, compute: computeLiftE1RM },
    { id: 'lift-squat-pr', title: 'Squat 315 lbs', description: 'Estimated 1RM of 315 lbs on back squat.', icon: '🦵', exercise: 'Barbell Back Squat', target: 315, compute: computeLiftE1RM },
    { id: 'lift-plan-completion', title: 'Complete All Lifts', description: 'Finish all planned lifting sessions.', icon: '📋', compute: computeLiftPlanCompletion },
    { id: 'lift-weekly-volume', title: '20k Weekly Volume', description: 'Hit 20,000 lbs total volume in a single week.', icon: '📊', target: 20000, compute: computeWeeklyVolume },
  ],
  combined: [
    { id: 'combined-training-days', title: 'Train 5 Days/Week', description: 'Complete at least 5 training sessions per week (any type).', icon: '🔥', target: 5, compute: computeTrainingDays },
    { id: 'combined-streak', title: '14-Day Streak', description: 'Complete a planned workout for 14 consecutive days.', icon: '🔥', target: 14, compute: computeStreak },
    { id: 'combined-consistency', title: '80% Overall Adherence', description: 'Complete at least 80% of all planned workouts.', icon: '✅', target: 80, compute: computeOverallAdherence },
    { id: 'combined-balance', title: 'Balanced Training', description: 'Complete at least 3 runs AND 3 lifts every week for 4 weeks.', icon: '⚖️', target: 4, compute: computeTrainingBalance },
  ],
};


// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function GoalsPage() {
  const { workouts, isLoaded } = useWorkouts();
  const [activeTab, setActiveTab] = useState('all');

  const goals = useMemo(() => {
    if (workouts.length === 0) return { running: [], lifting: [], combined: [] };
    return {
      running:  GOAL_TEMPLATES.running.map(g => ({ ...g, ...g.compute(workouts, g) })),
      lifting:  GOAL_TEMPLATES.lifting.map(g => ({ ...g, ...g.compute(workouts, g) })),
      combined: GOAL_TEMPLATES.combined.map(g => ({ ...g, ...g.compute(workouts, g) })),
    };
  }, [workouts]);

  const allGoals = [...goals.running, ...goals.lifting, ...goals.combined];
  const completedGoals = allGoals.filter(g => g.percentage >= 100);
  const activeGoals = allGoals.filter(g => g.percentage < 100);

  const tabs = [
    { key: 'all',      label: `All (${allGoals.length})` },
    { key: 'running',  label: `🏃 Running (${goals.running.length})` },
    { key: 'lifting',  label: `🏋️ Lifting (${goals.lifting.length})` },
    { key: 'combined', label: `🔥 Combined (${goals.combined.length})` },
  ];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="bc-caption uppercase tracking-wider mb-4">Goals</h2>

      {/* ── Summary stats ── */}
      <div className="bc-card flex items-center gap-6 mb-6 py-4">
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
            {allGoals.length > 0
              ? Math.round(allGoals.reduce((s, g) => s + g.percentage, 0) / allGoals.length)
              : 0}%
          </span>
          <span className="bc-label mt-1">Avg Progress</span>
        </div>
      </div>

      {/* ── Tab Toggle ── */}
      <div className="bc-tab-bar mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`bc-tab ${activeTab === tab.key ? 'bc-tab-active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Goal Sections ── */}
      {(activeTab === 'all' || activeTab === 'running') && goals.running.length > 0 && (
        <GoalSection title="Running Goals" goals={goals.running} accentColor="#34C759" />
      )}
      {(activeTab === 'all' || activeTab === 'lifting') && goals.lifting.length > 0 && (
        <GoalSection title="Lifting Goals" goals={goals.lifting} accentColor="#007AFF" />
      )}
      {(activeTab === 'all' || activeTab === 'combined') && goals.combined.length > 0 && (
        <GoalSection title="Combined Goals" goals={goals.combined} accentColor="#AF52DE" />
      )}

      {/* ── Achievements ── */}
      {completedGoals.length > 0 && (
        <div className="mt-8">
          <p className="bc-caption uppercase tracking-wider mb-3">Achievements</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {completedGoals.map(goal => (
              <div key={goal.id} className="bc-card p-4 text-center border-l-4 border-bc-green">
                <span className="text-3xl block mb-2">{goal.icon}</span>
                <p className="text-xs font-semibold text-primary">{goal.title}</p>
                <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px] mt-2">
                  ✓ Achieved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// GOAL SECTION
// ═══════════════════════════════════════════════════════

function GoalSection({ title, goals, accentColor }) {
  return (
    <div className="mb-8">
      <p className="bc-caption uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// GOAL CARD
// ═══════════════════════════════════════════════════════

function GoalCard({ goal, accentColor }) {
  const isComplete = goal.percentage >= 100;
  const statusConfig = getGoalStatus(goal);

  return (
    <div className={`bc-card p-5 ${isComplete ? 'border-l-4 border-bc-green' : ''}`}>
      <div className="flex gap-4">
        {/* Progress Ring */}
        <ProgressRing
          percentage={goal.percentage}
          size={72}
          strokeWidth={5}
          color={isComplete ? '#34C759' : accentColor}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{goal.icon}</span>
            <h4 className="text-sm font-semibold text-primary truncate">{goal.title}</h4>
          </div>

          <p className="text-xs text-secondary mb-2">{goal.description}</p>

          <p className="bc-data text-xs text-primary mb-2">{goal.progressText}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`bc-pill text-[10px] ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
            {goal.projectedDate && !isComplete && (
              <span className="text-[10px] text-tertiary">
                Est. {goal.projectedDate}
              </span>
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
  if (goal.percentage >= 100) {
    return { label: 'Achieved',     icon: '✓', bg: 'bg-bc-green-light',  text: 'text-bc-green-dark' };
  }
  if (goal.status === 'ahead') {
    return { label: 'Ahead',        icon: '↑', bg: 'bg-bc-green-light',  text: 'text-bc-green-dark' };
  }
  if (goal.status === 'on-track') {
    return { label: 'On Track',     icon: '→', bg: 'bg-bc-blue-light',   text: 'text-bc-blue-dark' };
  }
  if (goal.status === 'behind') {
    return { label: 'Behind',       icon: '↓', bg: 'bg-bc-orange-light', text: 'text-bc-orange-dark' };
  }
  return   { label: 'In Progress',  icon: '→', bg: 'bg-surface-alt',     text: 'text-secondary' };
}


// ═══════════════════════════════════════════════════════
// COMPUTE FUNCTIONS (all unchanged)
// ═══════════════════════════════════════════════════════

function getWeeksOfData(workouts) {
  const dates = workouts.map(w => w.date).sort();
  if (dates.length < 2) return 1;
  const first = new Date(dates[0] + 'T00:00:00');
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  return Math.max(1, Math.ceil((last - first) / (7 * 24 * 60 * 60 * 1000)));
}

function computePlanCompletion(workouts) {
  const runs = workouts.filter(w => w.type === 'run');
  const notSkipped = runs.filter(w => w.status !== 'skipped');
  const completed = runs.filter(w => w.status === 'completed');
  const total = notSkipped.length || 1;
  const percentage = Math.round((completed.length / total) * 100);
  const pastDue = runs.filter(w => w.date <= new Date().toISOString().split('T')[0]);
  const pastCompleted = pastDue.filter(w => w.status === 'completed');
  const adherence = pastDue.length > 0 ? pastCompleted.length / pastDue.length : 1;
  return { percentage, progressText: `${completed.length} of ${total} runs completed`, status: adherence >= 0.85 ? 'ahead' : adherence >= 0.65 ? 'on-track' : 'behind', projectedDate: null };
}

function computeWeeklyMileage(workouts, goal) {
  const target = goal.target;
  const runs = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  const mondayStr = monday.toISOString().split('T')[0];
  const thisWeekRuns = runs.filter(w => w.date >= mondayStr);
  const thisWeekMiles = thisWeekRuns.reduce((s, w) => s + (w.details.actualDistance || 0), 0);
  const weekBuckets = {};
  runs.forEach(w => {
    const d = new Date(w.date + 'T00:00:00');
    const wDay = d.getDay();
    const wMonOffset = wDay === 0 ? -6 : 1 - wDay;
    const wMon = new Date(d);
    wMon.setDate(wMon.getDate() + wMonOffset);
    const key = wMon.toISOString().split('T')[0];
    weekBuckets[key] = (weekBuckets[key] || 0) + (w.details.actualDistance || 0);
  });
  const bestWeek = Math.max(0, ...Object.values(weekBuckets));
  const percentage = Math.round((bestWeek / target) * 100);
  const daysLeft = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek);
  return { percentage, progressText: `Best week: ${bestWeek.toFixed(1)} mi · This week: ${thisWeekMiles.toFixed(1)} mi`, status: thisWeekMiles >= target * 0.6 ? 'on-track' : thisWeekMiles >= target * 0.3 ? 'on-track' : 'behind', projectedDate: percentage >= 100 ? null : `${daysLeft} days left this week` };
}

function computeRacePace(workouts, goal) {
  const longRuns = workouts.filter(w => w.type === 'run' && w.status === 'completed' && (w.details.runType === 'Long Run' || (w.details.actualDistance || 0) >= 8) && w.details.actualPace);
  if (longRuns.length === 0) return { percentage: 0, progressText: 'No qualifying long runs yet', status: 'behind', projectedDate: null };
  const paces = longRuns.map(r => parsePace(r.details.actualPace)).filter(Boolean);
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const target = goal.targetPace;
  const startPace = 11;
  const percentage = avgPace <= target ? 100 : Math.round(((startPace - avgPace) / (startPace - target)) * 100);
  const avgMin = Math.floor(avgPace);
  const avgSec = Math.round((avgPace - avgMin) * 60);
  return { percentage: Math.max(0, percentage), progressText: `Avg long run pace: ${avgMin}:${avgSec.toString().padStart(2, '0')}/mi (${longRuns.length} runs)`, status: avgPace <= target ? 'ahead' : avgPace <= target + 0.5 ? 'on-track' : 'behind', projectedDate: null };
}

function computeLongRunDistance(workouts, goal) {
  const runs = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const longest = runs.reduce((max, w) => Math.max(max, w.details.actualDistance || 0), 0);
  const percentage = Math.round((longest / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `Longest run: ${longest} mi of ${goal.target} mi goal`, status: percentage >= 100 ? 'ahead' : percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeLiftE1RM(workouts, goal) {
  const lifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
  let bestE1RM = 0;
  lifts.forEach(session => {
    (session.details.exercises || []).forEach(exercise => {
      if (exercise.name !== goal.exercise) return;
      (exercise.sets || []).forEach(set => {
        if (!set.completed || !set.weight || !set.reps) return;
        const e1rm = calculateE1RM(set.weight, set.reps);
        if (e1rm > bestE1RM) bestE1RM = e1rm;
      });
    });
  });
  const percentage = goal.target > 0 ? Math.round((bestE1RM / goal.target) * 100) : 0;
  let projectedDate = null;
  if (bestE1RM > 0 && bestE1RM < goal.target) {
    const weeksOfData = getWeeksOfData(workouts);
    const weeklyGain = bestE1RM / weeksOfData * 0.02;
    if (weeklyGain > 0) {
      const weeksNeeded = Math.ceil((goal.target - bestE1RM) / (weeklyGain * 10));
      const projected = new Date();
      projected.setDate(projected.getDate() + weeksNeeded * 7);
      projectedDate = formatDate(projected.toISOString().split('T')[0]);
    }
  }
  return { percentage: Math.min(100, percentage), progressText: bestE1RM > 0 ? `Current e1RM: ${bestE1RM} lbs of ${goal.target} lbs` : `No ${goal.exercise} data yet`, status: percentage >= 100 ? 'ahead' : percentage >= 70 ? 'on-track' : 'behind', projectedDate };
}

function computeLiftPlanCompletion(workouts) {
  const lifts = workouts.filter(w => w.type === 'lift');
  const notSkipped = lifts.filter(w => w.status !== 'skipped');
  const completed = lifts.filter(w => w.status === 'completed');
  const total = notSkipped.length || 1;
  const percentage = Math.round((completed.length / total) * 100);
  return { percentage, progressText: `${completed.length} of ${total} lift sessions completed`, status: percentage >= 85 ? 'ahead' : percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeWeeklyVolume(workouts, goal) {
  const lifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
  const weekBuckets = {};
  lifts.forEach(w => {
    const d = new Date(w.date + 'T00:00:00');
    const wDay = d.getDay();
    const wMonOffset = wDay === 0 ? -6 : 1 - wDay;
    const wMon = new Date(d);
    wMon.setDate(wMon.getDate() + wMonOffset);
    const key = wMon.toISOString().split('T')[0];
    weekBuckets[key] = (weekBuckets[key] || 0) + (w.details.totalVolume || 0);
  });
  const bestWeek = Math.max(0, ...Object.values(weekBuckets));
  const percentage = Math.round((bestWeek / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `Best week: ${formatVolume(bestWeek)} of ${formatVolume(goal.target)} target`, status: percentage >= 100 ? 'ahead' : percentage >= 60 ? 'on-track' : 'behind', projectedDate: null };
}

function computeTrainingDays(workouts, goal) {
  const completed = workouts.filter(w => w.status === 'completed' && ['run', 'lift', 'cardio'].includes(w.type));
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  const mondayStr = monday.toISOString().split('T')[0];
  const thisWeekDates = new Set(completed.filter(w => w.date >= mondayStr).map(w => w.date));
  const daysThisWeek = thisWeekDates.size;
  const weekCounts = [];
  for (let i = 0; i < 4; i++) {
    const wStart = new Date(monday);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);
    const dates = new Set(completed.filter(w => w.date >= wStart.toISOString().split('T')[0] && w.date < wEnd.toISOString().split('T')[0]).map(w => w.date));
    weekCounts.push(dates.size);
  }
  const avgDays = weekCounts.reduce((a, b) => a + b, 0) / weekCounts.length;
  const percentage = Math.round((avgDays / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `This week: ${daysThisWeek}/${goal.target} days · Avg: ${avgDays.toFixed(1)}/wk`, status: avgDays >= goal.target ? 'ahead' : avgDays >= goal.target * 0.7 ? 'on-track' : 'behind', projectedDate: null };
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
    const dateStr = check.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) { streak++; check.setDate(check.getDate() - 1); } else break;
  }
  const percentage = Math.round((streak / goal.target) * 100);
  const allDates = [...completedDates].sort();
  let longestStreak = 0, currentRun = 1;
  for (let i = 1; i < allDates.length; i++) {
    const diff = (new Date(allDates[i] + 'T00:00:00') - new Date(allDates[i - 1] + 'T00:00:00')) / (1000 * 60 * 60 * 24);
    if (diff === 1) { currentRun++; } else { longestStreak = Math.max(longestStreak, currentRun); currentRun = 1; }
  }
  longestStreak = Math.max(longestStreak, currentRun);
  return { percentage: Math.min(100, percentage), progressText: `Current: ${streak} days · Best ever: ${longestStreak} days`, status: streak >= goal.target ? 'ahead' : streak >= goal.target * 0.5 ? 'on-track' : 'behind', projectedDate: streak < goal.target ? `${goal.target - streak} more days` : null };
}

function computeOverallAdherence(workouts, goal) {
  const now = new Date().toISOString().split('T')[0];
  const pastWorkouts = workouts.filter(w => w.date <= now && w.type !== 'rest');
  const completed = pastWorkouts.filter(w => w.status === 'completed');
  const total = pastWorkouts.length || 1;
  const adherence = Math.round((completed.length / total) * 100);
  return { percentage: Math.min(100, Math.round((adherence / goal.target) * 100)), progressText: `${adherence}% adherence (${completed.length}/${total} workouts)`, status: adherence >= goal.target ? 'ahead' : adherence >= goal.target * 0.8 ? 'on-track' : 'behind', projectedDate: null };
}

function computeTrainingBalance(workouts, goal) {
  const completed = workouts.filter(w => w.status === 'completed');
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  let balancedWeeks = 0;
  const weeksToCheck = Math.min(goal.target + 2, 8);
  for (let i = 0; i < weeksToCheck; i++) {
    const wStart = new Date(monday);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);
    const weekWorkouts = completed.filter(w => w.date >= wStart.toISOString().split('T')[0] && w.date < wEnd.toISOString().split('T')[0]);
    if (weekWorkouts.filter(w => w.type === 'run').length >= 3 && weekWorkouts.filter(w => w.type === 'lift').length >= 3) balancedWeeks++;
  }
  const percentage = Math.round((balancedWeeks / goal.target) * 100);
  return { percentage: Math.min(100, percentage), progressText: `${balancedWeeks} of ${goal.target} balanced weeks (3+ runs & 3+ lifts)`, status: balancedWeeks >= goal.target ? 'ahead' : balancedWeeks >= goal.target * 0.5 ? 'on-track' : 'behind', projectedDate: balancedWeeks < goal.target ? `${goal.target - balancedWeeks} more weeks needed` : null };
}