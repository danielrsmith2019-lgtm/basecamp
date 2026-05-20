// utils/adaptation.js
//
// Adaptive Plan Engine — runs after every logged workout.
// Four rules:
// 1. Missed Sessions → reduce next week's volume 10%
// 2. Pace Trending Fast → tighten future pace targets
// 3. Overexertion → flag high RPE on easy runs
// 4. Cross-Domain Balance → hold volume if one domain is lagging

// ── Helper: parse pace string "M:SS" to total seconds ──
function paceToSeconds(pace) {
  if (!pace || typeof pace !== 'string') return null;
  if (pace.includes('-')) {
    const parts = pace.split('-').map(p => paceToSeconds(p.trim()));
    if (parts[0] === null || parts[1] === null) return null;
    return Math.round((parts[0] + parts[1]) / 2);
  }
  const parts = pace.split(':');
  if (parts.length !== 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// ── Helper: seconds back to "M:SS" ──
function secondsToPace(totalSec) {
  if (!totalSec || totalSec <= 0) return null;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Helper: get ISO week key "YYYY-WNN" ──
function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getCurrentWeekKey() {
  return getISOWeek(new Date().toLocaleDateString('en-CA'));
}

function getNextWeekKey() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return getISOWeek(d.toLocaleDateString('en-CA'));
}

// ── Helper: check localStorage cooldown ──
// Returns true if this adaptation type is on cooldown (accepted < daysRequired ago)
function isOnCooldown(type, daysRequired = 7) {
  if (typeof window === 'undefined') return false;
  try {
    const stored = JSON.parse(localStorage.getItem(`bc-adapt-accepted-${type}`) || 'null');
    if (!stored) return false;
    const acceptedDate = new Date(stored.acceptedAt);
    const daysSince = (Date.now() - acceptedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < daysRequired;
  } catch { return false; }
}

// Called by WorkoutContext when an adaptation is accepted
export function markAdaptationAccepted(type) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`bc-adapt-accepted-${type}`, JSON.stringify({
      acceptedAt: new Date().toISOString(),
    }));
  } catch {}
}


// ══════════════════════════════════════════════
// RULE 1: MISSED SESSIONS
// ══════════════════════════════════════════════
function checkMissedSessions(workouts) {
  const currentWeek = getCurrentWeekKey();
  const thisWeekWorkouts = workouts.filter(w => getISOWeek(w.date) === currentWeek);
  const planned  = thisWeekWorkouts.filter(w => w.status === 'planned' && w.type !== 'rest');
  const skipped  = thisWeekWorkouts.filter(w => w.status === 'skipped');
  const today    = new Date().toLocaleDateString('en-CA');
  const missedCount = planned.filter(w => w.date <= today).length + skipped.length;

  if (missedCount < 2) return null;

  const nextWeek = getNextWeekKey();
  const nextWeekWorkouts = workouts.filter(w => getISOWeek(w.date) === nextWeek && w.status === 'planned');
  const nextWeekRuns  = nextWeekWorkouts.filter(w => w.type === 'run');
  const nextWeekLifts = nextWeekWorkouts.filter(w => w.type === 'lift');
  const currentMileage = nextWeekRuns.reduce((sum, w) => sum + (w.details?.plannedDistance || 0), 0);
  const reducedMileage = Math.round(currentMileage * 0.9 * 10) / 10;

  if (currentMileage === 0 && nextWeekLifts.length === 0) return null;

  return {
    id: `missed-${currentWeek}`,  // stable: one per week
    type: 'missed_sessions',
    severity: 'warning',
    title: 'Volume Reduction Recommended',
    description: `You missed ${missedCount} planned sessions this week. To prevent overreaching when you return, next week's volume should be reduced by 10%.`,
    science: 'Returning to full volume after missed sessions increases injury risk. A 10% reduction allows your body to readapt without losing fitness (Schwellnus et al., 2016).',
    changes: {
      before: { mileage: currentMileage, label: `${currentMileage} mi planned` },
      after:  { mileage: reducedMileage, label: `${reducedMileage} mi (reduced 10%)` },
      affectedWorkoutIds: nextWeekRuns.map(w => w.id),
      reductionFactor: 0.9,
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}


// ══════════════════════════════════════════════
// RULE 2: PACE TRENDING FAST
// FIX: stable ID keyed to actual pace data, not Date.now()
// FIX: 14-day cooldown after acceptance to prevent feedback loop
// ══════════════════════════════════════════════
function checkPaceTrending(workouts) {
  // 14-day cooldown — prevents the feedback loop where each 10s adjustment
  // immediately triggers another suggestion
  if (isOnCooldown('pace_trending_fast', 14)) return null;

  const completedEasyRuns = workouts
    .filter(w =>
      w.type === 'run' &&
      w.status === 'completed' &&
      w.details?.runType === 'easy' &&
      w.details?.actualPace &&
      w.details?.targetPace
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (completedEasyRuns.length < 3) return null;

  let totalDiffSec = 0;
  let validCount = 0;

  completedEasyRuns.forEach(run => {
    const targetSec = paceToSeconds(run.details.targetPace);
    const actualSec = paceToSeconds(run.details.actualPace);
    if (targetSec !== null && actualSec !== null) {
      totalDiffSec += (targetSec - actualSec);
      validCount++;
    }
  });

  if (validCount < 3) return null;

  const avgDiffSec = totalDiffSec / validCount;

  // Only fire if averaging >30 seconds faster (raised from 15 to reduce noise)
  if (avgDiffSec <= 30) return null;

  const adjustment = 10;
  const today = new Date().toLocaleDateString('en-CA');
  const futureEasyRuns = workouts.filter(w =>
    w.type === 'run' &&
    w.status === 'planned' &&
    w.date > today &&
    (w.details?.runType === 'easy' || w.details?.runType === 'recovery')
  );

  const sampleRun = futureEasyRuns[0];
  const samplePaceSec = sampleRun ? paceToSeconds(sampleRun.details?.targetPace) : null;

  // Stable ID: keyed to the rounded avg diff and the sample pace
  // Changes only when the actual pace gap materially changes (>5s shift)
  const idKey = `${Math.round(avgDiffSec / 5) * 5}-${samplePaceSec || 'na'}`;

  return {
    id: `pace-trend-${idKey}`,  // stable — only changes if pace gap changes
    type: 'pace_trending_fast',
    severity: 'positive',
    title: "You're Faster Than Your Targets",
    description: `Your last 3 easy runs averaged ${Math.round(avgDiffSec)} seconds/mile faster than your target pace. Your fitness has improved — we can tighten your targets by ${adjustment} sec/mile.`,
    science: 'Consistent sub-target pacing on easy runs indicates improved aerobic fitness. Recalibrating targets ensures your training zones remain accurate for the polarized distribution model (Seiler, 2010).',
    changes: {
      before: {
        pace: samplePaceSec ? secondsToPace(samplePaceSec) : 'current targets',
        label: `Current easy pace: ${samplePaceSec ? secondsToPace(samplePaceSec) : 'N/A'}`,
      },
      after: {
        pace: samplePaceSec ? secondsToPace(samplePaceSec - adjustment) : 'adjusted targets',
        label: `New easy pace: ${samplePaceSec ? secondsToPace(samplePaceSec - adjustment) : 'N/A'} (-${adjustment}s)`,
      },
      adjustmentSeconds: adjustment,
      affectedWorkoutIds: futureEasyRuns.map(w => w.id),
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}


// ══════════════════════════════════════════════
// RULE 3: OVEREXERTION ON EASY RUNS
// FIX: stable ID keyed to RPE bucket, not Date.now()
// ══════════════════════════════════════════════
function checkOverexertion(workouts) {
  const recentEasyRuns = workouts
    .filter(w =>
      w.type === 'run' &&
      w.status === 'completed' &&
      w.details?.runType === 'easy' &&
      w.details?.rpe != null
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (recentEasyRuns.length < 3) return null;

  const avgRpe = recentEasyRuns.reduce((sum, w) => sum + w.details.rpe, 0) / recentEasyRuns.length;

  if (avgRpe <= 6) return null;

  // Stable ID: keyed to RPE bucket (changes only when RPE materially changes)
  const rpeBucket = Math.round(avgRpe * 2) / 2; // rounds to nearest 0.5

  return {
    id: `overexertion-rpe-${rpeBucket}`,  // stable
    type: 'overexertion',
    severity: 'warning',
    title: 'Easy Runs Are Too Hard',
    description: `Your average RPE on easy runs is ${avgRpe.toFixed(1)} — it should be 3-5. You're running your easy days too hard, which compromises recovery and defeats the purpose of polarized training.`,
    science: 'Easy runs at RPE 6+ accumulate unnecessary fatigue without additional aerobic benefit. The 80/20 model requires true easy effort (RPE 3-5) on easy days to maximize adaptation from hard sessions (Stöggl & Sperlich, 2015).',
    changes: {
      before: { rpe: avgRpe.toFixed(1), label: `Average easy run RPE: ${avgRpe.toFixed(1)}` },
      after:  { rpe: '4-5',             label: 'Target easy run RPE: 4-5 (conversational pace)' },
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}


// ══════════════════════════════════════════════
// RULE 4: CROSS-DOMAIN BALANCE
// ══════════════════════════════════════════════
function checkCrossDomainBalance(workouts) {
  const currentWeek = getCurrentWeekKey();
  const today = new Date().toLocaleDateString('en-CA');
  const thisWeekWorkouts = workouts.filter(w =>
    getISOWeek(w.date) === currentWeek && w.date <= today
  );

  const plannedRuns  = thisWeekWorkouts.filter(w => w.type === 'run'  && ['completed','planned','skipped'].includes(w.status));
  const plannedLifts = thisWeekWorkouts.filter(w => w.type === 'lift' && ['completed','planned','skipped'].includes(w.status));

  if (plannedRuns.length === 0 || plannedLifts.length === 0) return null;

  const completedRuns  = plannedRuns.filter(w => w.status === 'completed');
  const completedLifts = plannedLifts.filter(w => w.status === 'completed');

  const runCompletionRate  = completedRuns.length  / plannedRuns.length;
  const liftCompletionRate = completedLifts.length / plannedLifts.length;

  const imbalanced = (runCompletionRate > 0.8 && liftCompletionRate < 0.4) ||
                     (liftCompletionRate > 0.8 && runCompletionRate < 0.4);

  if (!imbalanced) return null;

  const strongSide = runCompletionRate > liftCompletionRate ? 'running' : 'lifting';
  const weakSide   = strongSide === 'running' ? 'lifting' : 'running';
  const strongRate = Math.round((strongSide === 'running' ? runCompletionRate : liftCompletionRate) * 100);
  const weakRate   = Math.round((weakSide   === 'running' ? runCompletionRate : liftCompletionRate) * 100);

  return {
    id: `balance-${currentWeek}`,  // stable: one per week
    type: 'cross_domain_balance',
    severity: 'info',
    title: 'Training Imbalance Detected',
    description: `You completed ${strongRate}% of your ${strongSide} but only ${weakRate}% of your ${weakSide} this week. Next week's ${strongSide} volume will hold steady rather than increase, to avoid deepening the imbalance.`,
    science: 'Increasing load on one modality while the other lags creates asymmetric fatigue patterns that can mask overtraining signals (Hickson, 1980).',
    changes: {
      before: { label: `${strongSide}: ${strongRate}% complete | ${weakSide}: ${weakRate}% complete` },
      after:  { label: `Next week: ${strongSide} volume holds steady, no increase` },
      holdSide: strongSide,
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}


// ══════════════════════════════════════════════
// MAIN: Run all adaptation rules
// ══════════════════════════════════════════════
export function checkAdaptations(workouts) {
  return [
    checkMissedSessions(workouts),
    checkPaceTrending(workouts),
    checkOverexertion(workouts),
    checkCrossDomainBalance(workouts),
  ].filter(a => a !== null);
}


// ══════════════════════════════════════════════
// APPLY: Execute an accepted adaptation
// ══════════════════════════════════════════════
export function applyAdaptation(adaptation, workouts) {
  const updates = [];

  // Mark cooldown on accept so this adaptation type rests for 14 days
  markAdaptationAccepted(adaptation.type);

  switch (adaptation.type) {
    case 'missed_sessions': {
      const factor = adaptation.changes.reductionFactor || 0.9;
      const ids    = adaptation.changes.affectedWorkoutIds || [];
      ids.forEach(id => {
        const w = workouts.find(w => w.id === id);
        if (!w) return;
        const newDistance = Math.round((w.details?.plannedDistance || 0) * factor * 10) / 10;
        updates.push({
          id,
          details: {
            ...w.details,
            plannedDistance: newDistance,
            adaptationApplied: 'Volume reduced 10% due to missed sessions',
          },
        });
      });
      break;
    }

    case 'pace_trending_fast': {
      const adj = adaptation.changes.adjustmentSeconds || 10;
      const ids = adaptation.changes.affectedWorkoutIds || [];
      ids.forEach(id => {
        const w = workouts.find(w => w.id === id);
        if (!w || !w.details?.targetPace) return;
        const currentSec = paceToSeconds(w.details.targetPace);
        if (currentSec === null) return;
        const newPace = secondsToPace(currentSec - adj);
        updates.push({
          id,
          details: {
            ...w.details,
            targetPace: newPace,
            adaptationApplied: `Pace target tightened by ${adj}s/mi`,
          },
        });
      });
      break;
    }

    case 'overexertion':
    case 'cross_domain_balance':
      // Advisory only — no workout modifications
      break;
  }

  return updates;
}