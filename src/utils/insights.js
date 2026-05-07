/**
 * BASECAMP — Cross-Training Insights Engine
 * 
 * The feature no other app has: analyzing BOTH run and lift data
 * together to surface conflicts, risks, and recommendations.
 * 
 * Each insight generator returns an array of insight objects:
 * {
 *   id:          unique string for React keys and dismiss tracking
 *   type:        'warning' | 'suggestion' | 'info'
 *   icon:        emoji
 *   title:       short headline
 *   description: 1-2 sentence explanation
 *   action:      { label: string, type: string } | null
 * }
 */


// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

/**
 * Runs all insight generators against the workout data.
 * Returns a flat array of insights sorted by priority (warnings first).
 * 
 * @param {Workout[]} workouts - All workouts (planned + completed + skipped)
 * @returns {Object[]} Array of insight objects
 */
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

  // Sort: warnings first, then suggestions, then info
  const priority = { warning: 0, suggestion: 1, info: 2 };
  return insights.sort((a, b) => (priority[a.type] ?? 2) - (priority[b.type] ?? 2));
}


// ═══════════════════════════════════════════════════════
// TRAINING LOAD SCORE
// ═══════════════════════════════════════════════════════

/**
 * Calculates a unified weekly training load score.
 * Combines run miles and lift volume into a single number.
 * 
 * Formula:
 *   runScore = total miles × 10 (so 20 miles = 200 points)
 *   liftScore = total volume / 100 (so 10,000 lbs = 100 points)
 *   totalScore = runScore + liftScore
 * 
 * Returns scores for the last 4 weeks plus trend direction.
 * 
 * @param {Workout[]} workouts
 * @returns {{ weeks: number[], current: number, previous: number, trend: string, changePercent: number }}
 */
export function calculateTrainingLoad(workouts) {
  const completed = workouts.filter(w => w.status === 'completed');
  const now = new Date();

  const weeks = [0, 0, 0, 0]; // [3 weeks ago, 2 weeks ago, last week, this week]

  completed.forEach(w => {
    const wDate = new Date(w.date + 'T00:00:00');
    const diffDays = Math.floor((now - wDate) / (1000 * 60 * 60 * 24));

    let score = 0;
    if (w.type === 'run') {
      score = (w.details.actualDistance || 0) * 10;
    } else if (w.type === 'lift') {
      score = (w.details.totalVolume || 0) / 100;
    } else if (w.type === 'cardio') {
      score = (w.details.duration || 0) * 2;
    }

    if (diffDays < 7) weeks[3] += score;
    else if (diffDays < 14) weeks[2] += score;
    else if (diffDays < 21) weeks[1] += score;
    else if (diffDays < 28) weeks[0] += score;
  });

  const roundedWeeks = weeks.map(w => Math.round(w));
  const current = roundedWeeks[3];
  const previous = roundedWeeks[2];

  let trend = 'stable';
  let changePercent = 0;
  if (previous > 0) {
    changePercent = Math.round(((current - previous) / previous) * 100);
    if (changePercent > 10) trend = 'increasing';
    else if (changePercent < -10) trend = 'decreasing';
  }

  return {
    weeks: roundedWeeks,
    current,
    previous,
    trend,
    changePercent,
  };
}


// ═══════════════════════════════════════════════════════
// INSIGHT 1: LEG DAY + HARD RUN CONFLICT
// ═══════════════════════════════════════════════════════

/**
 * Checks if a hard run (tempo, intervals, long run) is scheduled
 * within 24 hours of a leg-heavy lift session.
 */
function checkLegDayRunConflict(workouts) {
  const insights = [];
  const LEG_GROUPS = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  const HARD_RUNS = ['Tempo', 'Intervals', 'Long Run', 'Race'];

  // Only look at planned or upcoming workouts (not past completed ones)
  const today = new Date().toISOString().split('T')[0];
  const upcoming = workouts.filter(w => w.date >= today && w.status === 'planned');

  const legDays = upcoming.filter(w => {
    if (w.type !== 'lift') return false;
    const groups = w.details.muscleGroups || [];
    return groups.some(g => LEG_GROUPS.includes(g));
  });

  const hardRuns = upcoming.filter(w => {
    if (w.type !== 'run') return false;
    return HARD_RUNS.includes(w.details.runType);
  });

  for (const leg of legDays) {
    for (const run of hardRuns) {
      const legDate = new Date(leg.date + 'T00:00:00');
      const runDate = new Date(run.date + 'T00:00:00');
      const diffHours = Math.abs(runDate - legDate) / (1000 * 60 * 60);

      if (diffHours <= 24) {
        const legFirst = legDate <= runDate;
        insights.push({
          id: `leg-run-conflict-${leg.date}-${run.date}`,
          type: 'warning',
          icon: '⚠️',
          title: 'Leg Day + Hard Run Conflict',
          description: legFirst
            ? `You have ${leg.details.sessionName || 'legs'} on ${formatShortDate(leg.date)} and a ${run.details.runType} the next day. Heavy squats and deadlifts fatigue the same muscles used for hard running. Consider swapping the run to an easy day or moving the leg session.`
            : `You have a ${run.details.runType} on ${formatShortDate(run.date)} with ${leg.details.sessionName || 'legs'} the day before. Your legs may not be recovered for quality speed work.`,
          action: { label: 'Swap Sessions', type: 'swap' },
        });
      }
    }
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 2: VOLUME SPIKE (>15% WEEK-OVER-WEEK)
// ═══════════════════════════════════════════════════════

/**
 * Checks if running volume increased more than 15% from last week
 * without a deload. The 10% rule is standard; 15% is a generous threshold.
 */
function checkVolumeSpike(workouts) {
  const insights = [];
  const completed = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const now = new Date();

  let thisWeekMiles = 0;
  let lastWeekMiles = 0;

  completed.forEach(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    const dist = w.details.actualDistance || 0;

    if (diffDays < 7) thisWeekMiles += dist;
    else if (diffDays < 14) lastWeekMiles += dist;
  });

  if (lastWeekMiles > 0 && thisWeekMiles > 0) {
    const increase = ((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;

    if (increase > 15) {
      insights.push({
        id: `volume-spike-${now.toISOString().split('T')[0]}`,
        type: 'warning',
        icon: '📈',
        title: 'Running Volume Spike',
        description: `Your mileage jumped ${Math.round(increase)}% this week (${thisWeekMiles.toFixed(1)} mi vs ${lastWeekMiles.toFixed(1)} mi last week). The general guideline is no more than 10% increase. Consider keeping next week flat or reducing slightly to let your body adapt.`,
        action: { label: 'Plan Deload', type: 'deload' },
      });
    }
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 3: REST DAY NEEDED (8+ CONSECUTIVE DAYS)
// ═══════════════════════════════════════════════════════

/**
 * Checks if the user has trained 8+ consecutive days without a full rest day.
 */
function checkRestDayNeeded(workouts) {
  const insights = [];
  const completed = workouts.filter(w =>
    w.status === 'completed' && (w.type === 'run' || w.type === 'lift' || w.type === 'cardio')
  );

  const trainingDates = new Set(completed.map(w => w.date));

  // Count backwards from today
  let consecutiveDays = 0;
  const check = new Date();

  for (let i = 0; i < 30; i++) {
    const dateStr = check.toISOString().split('T')[0];
    if (trainingDates.has(dateStr)) {
      consecutiveDays++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  if (consecutiveDays >= 8) {
    insights.push({
      id: `rest-needed-${consecutiveDays}`,
      type: 'warning',
      icon: '😴',
      title: `${consecutiveDays} Days Without Rest`,
      description: `You've trained ${consecutiveDays} days in a row. Even elite athletes schedule rest days. Fatigue accumulates faster than you feel it — consider taking tomorrow off or doing active recovery only.`,
      action: { label: 'Schedule Rest', type: 'rest' },
    });
  } else if (consecutiveDays >= 6) {
    insights.push({
      id: `rest-soon-${consecutiveDays}`,
      type: 'suggestion',
      icon: '💤',
      title: 'Rest Day Coming Up',
      description: `You've trained ${consecutiveDays} days straight. If you don't have a rest day in the next 1–2 days, consider scheduling one to prevent accumulated fatigue.`,
      action: null,
    });
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 4: OVERTRAINING SIGNALS
// ═══════════════════════════════════════════════════════

/**
 * Checks for signs of overtraining:
 * - RPE trending upward on easy runs (should be 3-5, not 6+)
 * - Pace getting slower on easy runs despite same effort
 */
function checkOvertraining(workouts) {
  const insights = [];
  const now = new Date();

  // Look at easy runs in the last 2 weeks
  const recentEasyRuns = workouts.filter(w => {
    if (w.type !== 'run' || w.status !== 'completed') return false;
    if (!['Easy Run', 'Recovery'].includes(w.details.runType)) return false;
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    return diffDays < 14;
  });

  if (recentEasyRuns.length >= 3) {
    // Check average RPE on easy runs
    const rpeSamples = recentEasyRuns
      .filter(w => w.details.rpe != null)
      .map(w => w.details.rpe);

    if (rpeSamples.length >= 3) {
      const avgRpe = rpeSamples.reduce((a, b) => a + b, 0) / rpeSamples.length;

      if (avgRpe > 6) {
        insights.push({
          id: `overtraining-rpe-${now.toISOString().split('T')[0]}`,
          type: 'warning',
          icon: '🔴',
          title: 'Easy Runs Feel Too Hard',
          description: `Your average RPE on easy runs is ${avgRpe.toFixed(1)} over the last 2 weeks. Easy runs should feel like RPE 3–5. This could mean you're running too fast on easy days, or accumulated fatigue is catching up. Try slowing your easy pace by 15–30 seconds per mile.`,
          action: { label: 'Adjust Pace', type: 'pace' },
        });
      } else if (avgRpe > 5) {
        insights.push({
          id: `effort-creep-${now.toISOString().split('T')[0]}`,
          type: 'suggestion',
          icon: '🟡',
          title: 'Easy Run Effort Creeping Up',
          description: `Your easy run RPE is averaging ${avgRpe.toFixed(1)}. Not alarming yet, but keep an eye on it. Easy days should feel genuinely easy — if they don't, it often means you need more recovery.`,
          action: null,
        });
      }
    }
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// INSIGHT 5: SKIPPED WORKOUT PATTERN
// ═══════════════════════════════════════════════════════

/**
 * Checks if one type of workout is being skipped more than the other.
 * e.g., "You've completed all your lifts but skipped 3 of 5 runs"
 */
function checkSkippedPattern(workouts) {
  const insights = [];
  const now = new Date();

  // Last 2 weeks only
  const recent = workouts.filter(w => {
    const diffDays = Math.floor((now - new Date(w.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    return diffDays < 14 && w.date <= now.toISOString().split('T')[0];
  });

  const runStats = getTypeStats(recent, 'run');
  const liftStats = getTypeStats(recent, 'lift');

  // Check if runs are being skipped but lifts aren't (or vice versa)
  if (runStats.total >= 4 && liftStats.total >= 3) {
    if (runStats.skipRate > 40 && liftStats.skipRate < 15) {
      insights.push({
        id: `skip-pattern-runs-${now.toISOString().split('T')[0]}`,
        type: 'suggestion',
        icon: '🏃',
        title: 'Runs Getting Skipped',
        description: `You've completed ${liftStats.completed}/${liftStats.total} lifts but only ${runStats.completed}/${runStats.total} runs in the last 2 weeks. If it's an injury, listen to your body. If it's motivation, try shortening the planned distance — a 2-mile run is better than a skipped 4-mile run.`,
        action: null,
      });
    }

    if (liftStats.skipRate > 40 && runStats.skipRate < 15) {
      insights.push({
        id: `skip-pattern-lifts-${now.toISOString().split('T')[0]}`,
        type: 'suggestion',
        icon: '🏋️',
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
// ═══════════════════════════════════════════════════════

/**
 * Checks if easy runs are consistently faster than the target pace.
 * Running easy runs too fast is the #1 amateur mistake.
 */
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

  // Count how many easy runs were faster than target
  let fasterCount = 0;
  easyRuns.forEach(w => {
    const actual = parsePaceToDecimal(w.details.actualPace);
    const targetParts = w.details.targetPace.split('-');
    const targetFast = parsePaceToDecimal(targetParts[0]?.trim());

    if (actual && targetFast && actual < targetFast - 0.08) { // 5+ seconds faster
      fasterCount++;
    }
  });

  const fasterPercent = (fasterCount / easyRuns.length) * 100;

  if (fasterPercent > 60) {
    insights.push({
      id: 'pace-creep-easy',
      type: 'info',
      icon: '⏱️',
      title: 'Easy Runs Trending Fast',
      description: `${fasterCount} of your last ${easyRuns.length} easy runs were faster than the target pace. This could mean your fitness has improved and targets need updating, or that you're not running easy days easy enough. The 80/20 rule works — most miles should be truly conversational.`,
      action: { label: 'Update Paces', type: 'pace' },
    });
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════

function formatShortDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
  const ofType = workouts.filter(w => w.type === type);
  const completed = ofType.filter(w => w.status === 'completed').length;
  const skipped = ofType.filter(w => w.status === 'skipped').length;
  return {
    total: ofType.length,
    completed,
    skipped,
    skipRate: ofType.length > 0 ? (skipped / ofType.length) * 100 : 0,
  };
}