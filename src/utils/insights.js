/**
 * BASECAMP — Cross-Training Insights Engine
 *
 * IDs are keyed to the underlying data (dates, metrics) NOT to today's date,
 * so dismissed insights stay dismissed until the data actually changes.
 */

// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

export function generateInsights(workouts, trainingProfile) {
  if (!workouts || workouts.length === 0) return [];

  const profile = trainingProfile?.primaryType || 'hybrid';

  const insights = [
    // Concurrent training rules — runner & hybrid
    ...(profile !== 'lifter' ? [
      ...checkLegDayRunConflict(workouts),
      ...checkVolumeSpike(workouts),
      ...checkOvertraining(workouts),
      ...checkPaceCreep(workouts),
      ...checkSameDaySequencing(workouts),
      ...checkTempoRunLegGap(workouts),
      ...checkCNSFatigue(workouts),
    ] : []),

    // Universal rules
    ...checkRestDayNeeded(workouts),
    ...checkSkippedPattern(workouts),
    ...checkDeloadIndicator(workouts),

    // Hybrid-only balance check
    ...(profile === 'hybrid' ? checkWeeklyModalityBalance(workouts) : []),

    // Lift-specific rules — lifter & hybrid
    ...(profile !== 'runner' ? [
      ...checkSameMuscleRecovery(workouts),
      ...checkStrengthPlateau(workouts),
      ...checkVolumePerMuscleGroup(workouts),
      ...checkExerciseVariety(workouts),
      ...checkMuscleGroupImbalance(workouts),
    ] : []),
  ];

  // Deduplicate by ID — multiple rules can fire for the same scenario
  const seenIds = new Set();
  const deduped = insights.filter(i => {
    if (seenIds.has(i.id)) return false;
    seenIds.add(i.id);
    return true;
  });

  const priority = { warning: 0, suggestion: 1, info: 2 };
  return deduped.sort((a, b) => (priority[a.type] ?? 2) - (priority[b.type] ?? 2));
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
  const fourteenOut = new Date(); fourteenOut.setDate(fourteenOut.getDate() + 14);
  const maxDate14 = fourteenOut.toLocaleDateString('en-CA');
  const upcoming = workouts.filter(w => w.date >= today && w.date <= maxDate14 && w.status === 'planned');

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

      // Only fire when leg comes BEFORE the run — checkTempoRunLegGap covers run-before-leg
      if (diffHours > 0 && diffHours <= 24 && legDate < runDate) {
        insights.push({
          id: `leg-run-conflict-${leg.date}-${run.date}`,
          category: 'leg-run-conflict',
          type: 'warning',
          title: 'Leg Day + Hard Run Conflict',
          description: `You have ${leg.details.sessionName || 'legs'} on ${formatShortDate(leg.date)} and a ${run.details.runType} the next day. Heavy squats and deadlifts fatigue the same muscles used for hard running. Consider swapping the order or adding a day between them.`,
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

function getWeekKey(date) {
  const d = date ? new Date(date + 'T00:00:00') : new Date();
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  monday.setHours(0, 0, 0, 0);
  return monday.toLocaleDateString('en-CA');
}

function isoWeekKey(dateStr) {
  return getWeekKey(dateStr);
}


// ═══════════════════════════════════════════════════════
// NEW RULE 1: SAME-DAY SEQUENCING
// ═══════════════════════════════════════════════════════

function checkSameDaySequencing(workouts) {
  const insights = [];
  const today = new Date().toLocaleDateString('en-CA');
  const sevenOut = new Date(); sevenOut.setDate(sevenOut.getDate() + 7);
  const maxDate  = sevenOut.toLocaleDateString('en-CA');
  // Limit to next 7 days — same-day sequencing advice is only actionable near-term
  const upcoming = workouts.filter(w => w.date >= today && w.date <= maxDate && w.status === 'planned');

  const HARD_RUN_TYPES = ['Tempo', 'Intervals', 'Long Run', 'Race'];
  const LEG_GROUPS     = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

  const byDate = {};
  upcoming.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });

  const seenDates = new Set();
  for (const [date, dayWorkouts] of Object.entries(byDate)) {
    if (seenDates.has(date)) continue;
    const runs  = dayWorkouts.filter(w => w.type === 'run');
    const lifts = dayWorkouts.filter(w => w.type === 'lift');
    if (!runs.length || !lifts.length) continue;

    for (const run of runs) {
      const isHardRun = HARD_RUN_TYPES.includes(run.details.runType);
      for (const lift of lifts) {
        const isLegLift = (lift.details.muscleGroups || []).some(g => LEG_GROUPS.includes(g));
        if (seenDates.has(date)) continue;
        if (isHardRun && isLegLift) {
          seenDates.add(date);
          insights.push({
            id: `same-day-sequence-${date}`,
            category: 'same-day-sequence',
            type: 'warning',
            title: 'Hard Run + Legs Same Day',
            description: `A ${run.details.runType || 'hard run'} and lower body lifting on the same day significantly compounds fatigue. If you must do both today, lift first — strength output drops 15-20% after hard cardio. Better: move the run to tomorrow or swap it for easy cardio.`,
          });
        } else if (!seenDates.has(date)) {
          seenDates.add(date);
          insights.push({
            id: `same-day-lift-first-${date}`,
            category: 'same-day-lift-first',
            type: 'suggestion',
            title: 'Lift Before You Run Today',
            description: `You have lifting and a run scheduled today. Do the lifting session first — strength performance is better when legs are fresh. If the run is easy, same-day is fine after lifting.`,
          });
        }
      }
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 2: TEMPO RUN → HEAVY LEGS GAP (<48H)
// ═══════════════════════════════════════════════════════

function checkTempoRunLegGap(workouts) {
  const insights = [];
  const HARD_RUN_TYPES  = ['Tempo', 'Intervals', 'Long Run'];
  const HEAVY_LEG_NAMES = ['squat', 'deadlift', 'leg press', 'rdl', 'romanian deadlift', 'lunge', 'hack squat'];

  const hardRuns = workouts.filter(w =>
    w.type === 'run' &&
    (w.status === 'completed' || w.status === 'planned') &&
    HARD_RUN_TYPES.includes(w.details.runType)
  );

  const heavyLegSessions = workouts.filter(w =>
    w.type === 'lift' &&
    (w.status === 'completed' || w.status === 'planned') &&
    (w.details.exercises || []).some(ex =>
      HEAVY_LEG_NAMES.some(p => (ex.name || '').toLowerCase().includes(p))
    )
  );

  const seen = new Set();
  for (const run of hardRuns) {
    for (const lift of heavyLegSessions) {
      const runDate  = new Date(run.date  + 'T00:00:00');
      const liftDate = new Date(lift.date + 'T00:00:00');
      const diffH    = (liftDate - runDate) / 3600000;
      if (diffH <= 0 || diffH >= 48) continue;
      const key = `${run.date}-${lift.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      insights.push({
        id: `tempo-leg-gap-${run.date}-${lift.date}`,
        type: 'warning',
        title: 'Threshold Run Too Close to Heavy Legs',
        description: `Your ${run.details.runType} on ${formatShortDate(run.date)} leaves significant quad and hamstring fatigue that persists 24-48 hours. A heavy leg session ${Math.round(diffH)} hours later raises injury risk and will underperform. Minimum 48h gap is recommended between threshold running and heavy lower body work.`,
      });
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 3: CNS FATIGUE ACCUMULATION
// ═══════════════════════════════════════════════════════

function checkCNSFatigue(workouts) {
  const insights = [];
  const CNS_PATTERNS = ['deadlift', 'squat', 'power clean', 'hang clean', 'snatch', 'thruster', 'clean and jerk'];
  const HARD_RUNS    = ['Tempo', 'Intervals', 'Long Run', 'Race'];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');
  const todayStr  = now.toLocaleDateString('en-CA');

  const recentCNSLifts = workouts.filter(w =>
    w.type === 'lift' && w.status === 'completed' &&
    w.date >= cutoffStr && w.date <= todayStr &&
    (w.details.exercises || []).some(ex =>
      CNS_PATTERNS.some(p => (ex.name || '').toLowerCase().includes(p))
    )
  );

  const recentHardRuns = workouts.filter(w =>
    w.type === 'run' && w.status === 'completed' &&
    w.date >= cutoffStr && w.date <= todayStr &&
    HARD_RUNS.includes(w.details.runType)
  );

  if (recentCNSLifts.length >= 3 && recentHardRuns.length >= 1) {
    const runType = recentHardRuns[0].details.runType || 'threshold';
    insights.push({
      id: `cns-fatigue-${cutoffStr}`,
      type: 'warning',
      title: 'CNS Load Accumulation This Week',
      description: `Heavy compound lifts and hard running both heavily stress the central nervous system. You have ${recentCNSLifts.length} CNS-intensive sessions in the last 5 days including ${runType} running. Performance and injury risk are both affected. Consider 1-2 days of light training or rest before your next heavy session.`,
    });
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 4: WEEKLY MODALITY BALANCE (hybrid only)
// ═══════════════════════════════════════════════════════

function checkWeeklyModalityBalance(workouts) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const recent = workouts.filter(w =>
    w.status === 'completed' && w.date >= cutoffStr &&
    (w.type === 'run' || w.type === 'lift')
  );

  const runCount  = recent.filter(w => w.type === 'run').length;
  const liftCount = recent.filter(w => w.type === 'lift').length;
  const total     = runCount + liftCount;

  if (total < 6) return [];

  const weekKey = getWeekKey();

  if (runCount > liftCount * 2) {
    const runPct  = Math.round((runCount / total) * 100);
    return [{
      id: `modality-balance-${weekKey}`,
      type: 'info',
      title: 'Training Skewing Toward Running',
      description: `Your last 2 weeks are ${runPct}% running and ${100 - runPct}% lifting. Research on concurrent training shows best adaptations occur between a 40/60–60/40 split. Consider adding more lifting sessions to balance training stress and reduce adaptation interference.`,
    }];
  }
  if (liftCount > runCount * 2) {
    const liftPct = Math.round((liftCount / total) * 100);
    return [{
      id: `modality-balance-${weekKey}`,
      type: 'info',
      title: 'Training Skewing Toward Lifting',
      description: `Your last 2 weeks are ${liftPct}% lifting and ${100 - liftPct}% running. Research on concurrent training shows best adaptations occur between a 40/60–60/40 split. Consider adding more runs to balance training stress.`,
    }];
  }
  return [];
}


// ═══════════════════════════════════════════════════════
// NEW RULE 5: SAME MUSCLE GROUP RECOVERY (<48H)
// ═══════════════════════════════════════════════════════

function checkSameMuscleRecovery(workouts) {
  const insights = [];
  const CLUSTERS = [
    { name: 'Legs',  groups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
    { name: 'Push',  groups: ['Chest', 'Shoulders', 'Triceps'] },
    { name: 'Pull',  groups: ['Back', 'Biceps', 'Rear Delts'] },
  ];

  const relevantWorkouts = workouts
    .filter(w => w.type === 'lift' && (w.status === 'completed' || w.status === 'planned'))
    .sort((a, b) => a.date.localeCompare(b.date));

  let count = 0;
  const seen = new Set();

  for (const cluster of CLUSTERS) {
    const sessions = relevantWorkouts.filter(w =>
      (w.details.muscleGroups || []).some(g => cluster.groups.includes(g))
    );

    for (let i = 0; i < sessions.length - 1; i++) {
      const a = sessions[i], b = sessions[i + 1];
      const key = `${a.id || a.date}-${b.id || b.date}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const diffH = (new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00')) / 3600000;
      if (diffH <= 0 || diffH >= 48) continue;
      if (++count > 2) return insights;

      const nextDay = new Date(b.date + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      insights.push({
        id: `muscle-recovery-${cluster.name.toLowerCase()}-${a.date}-${b.date}`,
        type: 'warning',
        title: `${cluster.name} — Undertrained Recovery Time`,
        description: `You have ${a.details.sessionName || cluster.name} and ${b.details.sessionName || cluster.name} targeting ${cluster.name.toLowerCase()} muscle groups only ${Math.round(diffH)} hours apart. Research shows minimum 48 hours between sessions targeting the same muscles is required for structural repair. Consider shifting the later session to ${formatShortDate(nextDay.toLocaleDateString('en-CA'))}.`,
      });
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 6: STRENGTH PLATEAU (4 sessions same weight)
// ═══════════════════════════════════════════════════════

function checkStrengthPlateau(workouts) {
  const COMPOUND_PATTERNS = [
    'squat', 'deadlift', 'bench', 'row', 'overhead press', 'ohp',
    'pull-up', 'pullup', 'chin-up', 'hip thrust', 'leg press', 'rdl', 'incline press', 'barbell',
  ];

  function isCompound(name) {
    const n = (name || '').toLowerCase();
    return COMPOUND_PATTERNS.some(p => n.includes(p));
  }

  const completedLifts = workouts
    .filter(w => w.type === 'lift' && w.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  const exerciseMap = {};
  for (const w of completedLifts) {
    for (const ex of (w.details.exercises || [])) {
      if (!ex.name || !isCompound(ex.name)) continue;
      const name = ex.name.trim();
      if (!exerciseMap[name]) exerciseMap[name] = [];
      const sets = (Array.isArray(ex.sets) ? ex.sets : []).filter(s => s.completed && s.weight && s.reps);
      if (!sets.length) continue;
      const avgW = sets.reduce((s, set) => s + Number(set.weight), 0) / sets.length;
      exerciseMap[name].push({ date: w.date, avgWeight: Math.round(avgW) });
    }
  }

  const plateaus = [];
  for (const [name, sessions] of Object.entries(exerciseMap)) {
    if (sessions.length < 5) continue;
    const last4 = sessions.slice(0, 4);
    const spanDays = (new Date(last4[0].date + 'T00:00:00') - new Date(last4[3].date + 'T00:00:00')) / 86400000;
    if (spanDays < 21) continue;
    const weights = last4.map(s => s.avgWeight);
    if (Math.max(...weights) - Math.min(...weights) <= 2.5) {
      plateaus.push({ name, weight: Math.round(weights.reduce((a, b) => a + b) / 4), spanWeeks: Math.round(spanDays / 7), totalSessions: sessions.length });
    }
  }

  plateaus.sort((a, b) => b.totalSessions - a.totalSessions);
  return plateaus.slice(0, 2).map(p => ({
    id: `plateau-${p.name.replace(/\s+/g, '-').toLowerCase()}`,
    type: 'suggestion',
    title: `${p.name} Progress Stalled`,
    description: `${p.name} has been at ${p.weight} lbs for ${p.spanWeeks} weeks across ${p.totalSessions} sessions. Options to break through: (1) increase reps before adding weight, (2) add a back-off set at 80%, (3) try a variation, (4) take a deload week then reset.`,
    category: 'progression',
  }));
}


// ═══════════════════════════════════════════════════════
// NEW RULE 7: WEEKLY VOLUME PER MUSCLE GROUP
// ═══════════════════════════════════════════════════════

function checkVolumePerMuscleGroup(workouts) {
  const insights = [];
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toLocaleDateString('en-CA');
  const sundayStr = new Date(monday.getTime() + 6 * 86400000).toLocaleDateString('en-CA');
  const weekKey   = mondayStr;

  const fourWeeksAgo = new Date(monday);
  fourWeeksAgo.setDate(monday.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toLocaleDateString('en-CA');

  const thisWeekLifts = workouts.filter(w =>
    w.type === 'lift' &&
    (w.status === 'planned' || w.status === 'completed') &&
    w.date >= mondayStr && w.date <= sundayStr
  );

  const recentLifts = workouts.filter(w =>
    w.type === 'lift' && w.status === 'completed' &&
    w.date >= fourWeeksAgoStr && w.date < mondayStr
  );

  const weekSets = {};
  for (const w of thisWeekLifts) {
    for (const ex of (w.details.exercises || [])) {
      const mg = ex.muscleGroup;
      if (!mg) continue;
      const count = Array.isArray(ex.sets) ? ex.sets.length : (typeof ex.sets === 'number' ? ex.sets : 3);
      weekSets[mg] = (weekSets[mg] || 0) + count;
    }
  }

  const muscleWeekHistory = {};
  for (const w of recentLifts) {
    const wk = isoWeekKey(w.date);
    for (const ex of (w.details.exercises || [])) {
      const mg = ex.muscleGroup;
      if (!mg) continue;
      if (!muscleWeekHistory[mg]) muscleWeekHistory[mg] = new Set();
      muscleWeekHistory[mg].add(wk);
    }
  }

  const regularlyTrained = new Set(
    Object.entries(muscleWeekHistory)
      .filter(([, weeks]) => weeks.size >= 3)
      .map(([mg]) => mg)
  );

  for (const [mg, sets] of Object.entries(weekSets)) {
    if (sets > 20) {
      insights.push({
        id: `high-volume-${mg.toLowerCase().replace(/\s+/g, '-')}-${weekKey}`,
        type: 'warning',
        title: `High Weekly Volume: ${mg}`,
        description: `You have ${sets} planned sets for ${mg} this week. Research suggests 10-20 sets per week is the effective range, with diminishing returns above 20. Consider reducing by ${sets - 18} sets or spreading across an extra session next week.`,
      });
    }
  }

  for (const mg of regularlyTrained) {
    if ((weekSets[mg] || 0) < 6) {
      insights.push({
        id: `low-volume-${mg.toLowerCase().replace(/\s+/g, '-')}-${weekKey}`,
        type: 'info',
        title: `Low Volume: ${mg} This Week`,
        description: `You have only ${weekSets[mg] || 0} sets planned for ${mg} this week. For continued adaptation, research recommends at least 10 sets per muscle group per week. Consider adding a session or extra sets for ${mg}.`,
      });
    }
  }

  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 8: EXERCISE VARIETY (6+ weeks same exercises)
// ═══════════════════════════════════════════════════════

function checkExerciseVariety(workouts) {
  const insights = [];
  const completedLifts = workouts
    .filter(w => w.type === 'lift' && w.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (completedLifts.length < 12) return insights;

  const sessionGroups = {};
  for (const w of completedLifts) {
    const key = (w.details.sessionName || '').split(' ')[0].toLowerCase() || 'workout';
    if (!sessionGroups[key]) sessionGroups[key] = [];
    sessionGroups[key].push(w);
  }

  for (const [sessionType, sessions] of Object.entries(sessionGroups)) {
    if (sessions.length < 6) continue;
    const now = new Date();
    const sixWeeksAgo = new Date(now);
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const sixWeeksAgoStr = sixWeeksAgo.toLocaleDateString('en-CA');
    const recent = sessions.filter(w => w.date >= sixWeeksAgoStr);
    if (recent.length < 6) continue;

    const getNames = ws => new Set(
      ws.flatMap(w => (w.details.exercises || []).map(ex => (ex.name || '').toLowerCase().trim()))
        .filter(Boolean)
    );

    const half     = Math.floor(recent.length / 2);
    const firstSet = getNames(recent.slice(0, half));
    const lastSet  = getNames(recent.slice(half));
    if (!firstSet.size || !lastSet.size) continue;

    const overlap = [...firstSet].filter(x => lastSet.has(x)).length / Math.min(firstSet.size, lastSet.size);
    if (overlap >= 0.8) {
      const name = sessions[sessions.length - 1].details.sessionName || sessionType;
      insights.push({
        id: `variety-${sessionType}-${sixWeeksAgoStr}`,
        type: 'suggestion',
        title: `Consider Rotating ${name} Exercises`,
        description: `Your ${name} sessions have used nearly identical exercises for ${recent.length} weeks. The body adapts to repeated stimuli — rotating exercises every 4-6 weeks is a well-established method to restart adaptation. Try swapping one primary and one accessory movement for fresh stimulus.`,
        category: 'variety',
      });
    }
  }
  return insights;
}


// ═══════════════════════════════════════════════════════
// NEW RULE 9: PUSH/PULL IMBALANCE (4-week window)
// ═══════════════════════════════════════════════════════

function checkMuscleGroupImbalance(workouts) {
  const PUSH_GROUPS = ['Chest', 'Shoulders', 'Triceps'];
  const PULL_GROUPS = ['Back', 'Biceps', 'Rear Delts'];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const recentLifts = workouts.filter(w =>
    w.type === 'lift' && w.status === 'completed' && w.date >= cutoffStr
  );
  if (recentLifts.length < 4) return [];

  let pushSets = 0, pullSets = 0;
  for (const w of recentLifts) {
    for (const ex of (w.details.exercises || [])) {
      const mg   = ex.muscleGroup || '';
      const sets = Array.isArray(ex.sets) ? ex.sets.length : 3;
      if (PUSH_GROUPS.includes(mg)) pushSets += sets;
      else if (PULL_GROUPS.includes(mg)) pullSets += sets;
    }
  }

  if (!pushSets || !pullSets) return [];
  const ratio = pushSets / pullSets;

  if (ratio > 1.5) {
    return [{
      id: `push-pull-balance-${cutoffStr}`,
      type: 'suggestion',
      title: 'More Pull Work Recommended',
      description: `Your push:pull ratio is ${ratio.toFixed(1)}:1 over the last 4 weeks. Anterior-dominant training increases shoulder injury risk over time. Adding rows, pull-ups, and rear delt work will improve posture, shoulder health, and overall balance.`,
      category: 'balance',
    }];
  }
  if (ratio < 0.67) {
    const inv = (pullSets / pushSets).toFixed(1);
    return [{
      id: `push-pull-balance-${cutoffStr}`,
      type: 'suggestion',
      title: 'More Push Work Recommended',
      description: `Your pull:push ratio is ${inv}:1 — pulling volume is dominating. Adding more pressing work will improve upper body balance and support shoulder joint health.`,
      category: 'balance',
    }];
  }
  return [];
}


// ═══════════════════════════════════════════════════════
// NEW RULE 10: DELOAD INDICATOR (3+ high-load weeks)
// ═══════════════════════════════════════════════════════

function checkDeloadIndicator(workouts) {
  const completed = workouts.filter(w => w.status === 'completed');
  const now = new Date();

  const weeklyLoads = [];
  for (let i = 0; i < 8; i++) {
    const wEnd   = new Date(now); wEnd.setDate(now.getDate() - i * 7);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
    const ws = wEnd.toLocaleDateString('en-CA');
    const ss = wStart.toLocaleDateString('en-CA');
    let load = 0;
    completed.filter(w => w.date >= ss && w.date < ws).forEach(w => {
      if (w.type === 'run')    load += (w.details.actualDistance || 0) * 10;
      else if (w.type === 'lift')   load += (w.details.totalVolume   || 0) / 100;
      else if (w.type === 'cardio') load += (w.details.duration      || 0) * 2;
    });
    weeklyLoads.push({ load: Math.round(load), weekStart: ss });
  }

  if (weeklyLoads.length < 4) return [];
  const peak = Math.max(...weeklyLoads.map(w => w.load));
  if (peak === 0) return [];

  let streak = 0;
  for (const { load } of weeklyLoads) {
    if (load >= peak * 0.8) streak++;
    else break;
  }

  if (streak >= 3) {
    return [{
      id: `deload-needed-${weeklyLoads[2]?.weekStart || ''}`,
      type: 'suggestion',
      title: 'Deload Week Recommended',
      description: `You have been training at high load for ${streak} consecutive weeks. Planned deload weeks — reducing volume by 40-50% for one week — consistently improve subsequent performance and reduce injury risk. Next week is a good candidate: keep the same exercises and frequency but cut sets by half.`,
      category: 'recovery',
    }];
  }
  return [];
}