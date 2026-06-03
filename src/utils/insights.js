/**
 * BASECAMP — Cross-Training Insights Engine
 *
 * IDs are keyed to the underlying data (dates, metrics) NOT to today's date,
 * so dismissed insights stay dismissed until the data actually changes.
 */

// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

export function generateInsights(workouts) {
  if (!workouts || workouts.length === 0) return [];

  const insights = [
    ...checkLegDayRunConflict(workouts),
    ...checkVolumeSpike(workouts),
    ...checkRestDayNeeded(workouts),
    ...checkOvertraining(workouts),
    ...checkSkippedPattern(workouts),
    ...checkPaceCreep(workouts),
  ];

  const priority = { warning: 0, suggestion: 1, info: 2 };
  return insights.sort((a, b) => (priority[a.type] ?? 2) - (priority[b.type] ?? 2));
}


// ═══════════════════════════════════════════════════════
// TRAINING LOAD SCORE
// ═══════════════════════════════════════════════════════

export function calculateTrainingLoad(workouts) {
  const completed = workouts.filter(w => w.status === 'completed');
  const now = new Date();
  const weeks = [0, 0, 0, 0];

  completed.forEach(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    let score = 0;
    if (w.type === 'run')    score = (w.details.actualDistance || 0) * 10;
    else if (w.type === 'lift')   score = (w.details.totalVolume || 0) / 100;
    else if (w.type === 'cardio') score = (w.details.duration || 0) * 2;

    if (diffDays < 7)        weeks[3] += score;
    else if (diffDays < 14)  weeks[2] += score;
    else if (diffDays < 21)  weeks[1] += score;
    else if (diffDays < 28)  weeks[0] += score;
  });

  const roundedWeeks = weeks.map(w => Math.round(w));
  const current  = roundedWeeks[3];
  const previous = roundedWeeks[2];

  let trend = 'stable';
  let changePercent = 0;
  if (previous > 0) {
    changePercent = Math.round(((current - previous) / previous) * 100);
    if (changePercent >  10) trend = 'increasing';
    if (changePercent < -10) trend = 'decreasing';
  }

  return { weeks: roundedWeeks, current, previous, trend, changePercent };
}


// ═══════════════════════════════════════════════════════
// INSIGHT 1: LEG DAY + HARD RUN CONFLICT
// ID keyed to the specific workout dates involved — stable until workouts change
// ═══════════════════════════════════════════════════════

function checkLegDayRunConflict(workouts) {
  const insights = [];
  const LEG_GROUPS  = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  const HARD_RUNS   = ['Tempo', 'Intervals', 'Long Run', 'Race'];
  const today = new Date().toLocaleDateString('en-CA');
  const upcoming = workouts.filter(w => w.date >= today && w.status === 'planned');

  const legDays  = upcoming.filter(w =>
    w.type === 'lift' &&
    (w.details.muscleGroups || []).some(g => LEG_GROUPS.includes(g))
  );
  const hardRuns = upcoming.filter(w =>
    w.type === 'run' && HARD_RUNS.includes(w.details.runType)
  );

  for (const leg of legDays) {
    for (const run of hardRuns) {
      const legDate = new Date(leg.date + 'T00:00:00');
      const runDate = new Date(run.date + 'T00:00:00');
      const diffHours = Math.abs(runDate - legDate) / (1000 * 60 * 60);

      if (diffHours <= 24) {
        const legFirst = legDate <= runDate;
        insights.push({
          // ID keyed to the two workout dates — stable as long as these are planned
          id: `leg-run-conflict-${leg.date}-${run.date}`,
          type: 'warning',
          title: 'Leg Day + Hard Run Conflict',
          description: legFirst
            ? `You have ${leg.details.sessionName || 'legs'} on ${formatShortDate(leg.date)} and a ${run.details.runType} the next day. Heavy squats and deadlifts fatigue the same muscles used for hard running.`
            : `You have a ${run.details.runType} on ${formatShortDate(run.date)} with ${leg.details.sessionName || 'legs'} the day before. Your legs may not be recovered for quality speed work.`,
          action: { label: 'Swap Sessions', type: 'swap' },
        });
      }
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 2: VOLUME SPIKE
// ID keyed to the week boundaries — changes weekly, not daily
// ═══════════════════════════════════════════════════════

function checkVolumeSpike(workouts) {
  const insights = [];
  const completed = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const now = new Date();

  // Calendar week boundaries (Mon–Sun), not rolling 7-day windows
  const dow = now.getDay();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const weekKey = thisMonday.toLocaleDateString('en-CA');

  let thisWeekMiles = 0;
  let lastWeekMiles = 0;

  completed.forEach(w => {
    const wDate = new Date(w.date + 'T00:00:00');
    const dist = w.details.actualDistance || 0;
    if (wDate >= thisMonday)                            thisWeekMiles += dist;
    else if (wDate >= lastMonday && wDate < thisMonday) lastWeekMiles += dist;
  });

  if (lastWeekMiles > 0 && thisWeekMiles > 0) {
    const increase = ((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;
    if (increase > 15) {
      insights.push({
        // Keyed to week start — same ID all week, resets naturally next Monday
        id: `volume-spike-week-${weekKey}`,
        type: 'warning',
        title: 'Running Volume Spike',
        description: `Your mileage jumped ${Math.round(increase)}% this week (${thisWeekMiles.toFixed(1)} mi vs ${lastWeekMiles.toFixed(1)} mi last week). The guideline is no more than 10% increase. Consider keeping next week flat to let your body adapt.`,
        action: { label: 'Plan Deload', type: 'deload' },
      });
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 3: REST DAY NEEDED
// ID keyed to consecutive count — changes only when streak changes
// ═══════════════════════════════════════════════════════

function checkRestDayNeeded(workouts) {
  const insights = [];
  const completed = workouts.filter(w =>
    w.status === 'completed' &&
    ['run', 'lift', 'cardio'].includes(w.type)
  );
  const trainingDates = new Set(completed.map(w => w.date));

  let consecutiveDays = 0;
  const check = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = check.toLocaleDateString('en-CA');
    if (trainingDates.has(dateStr)) {
      consecutiveDays++;
      check.setDate(check.getDate() - 1);
    } else break;
  }

  // Find the start date of the streak for a stable ID
  const streakStart = new Date();
  streakStart.setDate(streakStart.getDate() - consecutiveDays + 1);
  const streakStartKey = streakStart.toLocaleDateString('en-CA');

  if (consecutiveDays >= 8) {
    insights.push({
      // Keyed to streak start date — changes only when streak resets
      id: `rest-needed-streak-${streakStartKey}`,
      type: 'warning',
      title: `${consecutiveDays} Days Without Rest`,
      description: `You've trained ${consecutiveDays} days in a row. Even elite athletes schedule rest days. Fatigue accumulates faster than you feel it — consider taking tomorrow off or doing active recovery only.`,
      action: { label: 'Schedule Rest', type: 'rest' },
    });
  } else if (consecutiveDays >= 6) {
    insights.push({
      id: `rest-soon-streak-${streakStartKey}`,
      type: 'suggestion',
      title: 'Rest Day Coming Up',
      description: `You've trained ${consecutiveDays} days straight. If you don't have a rest day in the next 1–2 days, consider scheduling one to prevent accumulated fatigue.`,
      action: null,
    });
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 4: OVERTRAINING SIGNALS
// ID keyed to RPE bucket — only changes when RPE trend changes
// ═══════════════════════════════════════════════════════

function checkOvertraining(workouts) {
  const insights = [];
  const now = new Date();
  const recentEasyRuns = workouts.filter(w => {
    if (w.type !== 'run' || w.status !== 'completed') return false;
    if (!['Easy Run', 'Recovery'].includes(w.details.runType)) return false;
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    return diffDays < 14;
  });

  if (recentEasyRuns.length < 3) return insights;

  const rpeSamples = recentEasyRuns
    .filter(w => w.details.rpe != null)
    .map(w => w.details.rpe);

  if (rpeSamples.length < 3) return insights;

  const avgRpe = rpeSamples.reduce((a, b) => a + b, 0) / rpeSamples.length;
  // Key to RPE rounded to 1dp — ID only changes when avg RPE materially changes
  const rpeKey = avgRpe.toFixed(1).replace('.', '_');

  if (avgRpe > 6) {
    insights.push({
      id: `overtraining-rpe-${rpeKey}`,
      type: 'warning',
      title: 'Easy Runs Feel Too Hard',
      description: `Your average RPE on easy runs is ${avgRpe.toFixed(1)} over the last 2 weeks. Easy runs should feel like RPE 3–5. Try slowing your easy pace by 15–30 seconds per mile.`,
      action: { label: 'Adjust Pace', type: 'pace' },
    });
  } else if (avgRpe > 5) {
    insights.push({
      id: `effort-creep-rpe-${rpeKey}`,
      type: 'suggestion',
      title: 'Easy Run Effort Creeping Up',
      description: `Your easy run RPE is averaging ${avgRpe.toFixed(1)}. Easy days should feel genuinely easy — if they don't, it often means you need more recovery.`,
      action: null,
    });
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 5: SKIPPED WORKOUT PATTERN
// ID keyed to skip counts — changes only when skip counts change
// ═══════════════════════════════════════════════════════

function checkSkippedPattern(workouts) {
  const insights = [];
  const now = new Date();
  const recent = workouts.filter(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    return diffDays < 14 && w.date <= now.toLocaleDateString('en-CA');
  });

  const runStats  = getTypeStats(recent, 'run');
  const liftStats = getTypeStats(recent, 'lift');

  if (runStats.total >= 4 && liftStats.total >= 3) {
    if (runStats.skipRate > 40 && liftStats.skipRate < 15) {
      insights.push({
        // Keyed to actual skip counts — ID stable unless counts change
        id: `skip-pattern-runs-${runStats.skipped}of${runStats.total}`,
        type: 'suggestion',
        title: 'Runs Getting Skipped',
        description: `You've completed ${liftStats.completed}/${liftStats.total} lifts but only ${runStats.completed}/${runStats.total} runs in the last 2 weeks. A shorter run is better than a skipped one — try reducing the planned distance on days you're pressed for time.`,
        action: null,
      });
    }

    if (liftStats.skipRate > 40 && runStats.skipRate < 15) {
      insights.push({
        id: `skip-pattern-lifts-${liftStats.skipped}of${liftStats.total}`,
        type: 'suggestion',
        title: 'Lifts Getting Skipped',
        description: `You've completed ${runStats.completed}/${runStats.total} runs but only ${liftStats.completed}/${liftStats.total} lifts in the last 2 weeks. Strength training protects against running injuries — even 2 short sessions per week makes a difference.`,
        action: null,
      });
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 6: PACE CREEP ON EASY RUNS
// ID is fully static — this insight is about a long-term pattern
// ═══════════════════════════════════════════════════════

function checkPaceCreep(workouts) {
  const insights = [];
  const easyRuns = workouts.filter(w =>
    w.type === 'run' &&
    w.status === 'completed' &&
    w.details.runType === 'Easy Run' &&
    w.details.actualPace &&
    w.details.targetPace
  );

  if (easyRuns.length < 3) return insights;

  let fasterCount = 0;
  easyRuns.forEach(w => {
    const actual     = parsePaceToDecimal(w.details.actualPace);
    const targetParts = w.details.targetPace.split('-');
    const targetFast  = parsePaceToDecimal(targetParts[0]?.trim());
    if (actual && targetFast && actual < targetFast - 0.08) fasterCount++;
  });

  const fasterPercent = (fasterCount / easyRuns.length) * 100;
  if (fasterPercent > 60) {
    insights.push({
      // Static ID — this is a persistent pattern insight, dismiss until data changes
      id: `pace-creep-easy-${fasterCount}of${easyRuns.length}`,
      type: 'info',
      title: 'Easy Runs Trending Fast',
      description: `${fasterCount} of your last ${easyRuns.length} easy runs were faster than target pace. Easy days should be genuinely conversational — if they're not, you may be undermining your hard workout quality.`,
      action: { label: 'Update Paces', type: 'pace' },
    });
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function formatShortDate(isoDate) {
  return new Date(isoDate + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function parsePaceToDecimal(paceStr) {
  if (!paceStr) return null;
  const parts = paceStr.split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins + secs / 60;
}

function getTypeStats(workouts, type) {
  const ofType    = workouts.filter(w => w.type === type);
  const completed = ofType.filter(w => w.status === 'completed').length;
  const skipped   = ofType.filter(w => w.status === 'skipped').length;
  return {
    total:    ofType.length,
    completed,
    skipped,
    skipRate: ofType.length > 0 ? (skipped / ofType.length) * 100 : 0,
  };
}