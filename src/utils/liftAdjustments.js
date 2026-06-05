/**
 * liftAdjustments.js
 *
 * Generates concrete exercise adjustments for a planned lift session
 * based on recent training context (yesterday's run, tomorrow's race, etc.)
 *
 * Returns an array of adjustment objects. LogForm applies them on demand.
 */

const HARD_RUN_TYPES    = ['Tempo', 'Intervals', 'Long Run', 'Race'];
const LEG_COMPOUNDS     = ['squat', 'deadlift', 'leg press', 'rdl', 'romanian deadlift', 'lunge', 'hack squat', 'step up'];
const CNS_PATTERNS      = ['deadlift', 'squat', 'power clean', 'hang clean', 'snatch', 'thruster', 'clean and jerk'];
const ISOLATION_SIGNALS = ['curl', 'extension', 'lateral raise', 'fly', 'kickback', 'shrug', 'crunch', 'raise'];

function isLegCompound(name) {
  const n = (name || '').toLowerCase();
  return LEG_COMPOUNDS.some(p => n.includes(p));
}

function isCNSIntensive(name) {
  const n = (name || '').toLowerCase();
  return CNS_PATTERNS.some(p => n.includes(p));
}

function isIsolation(name) {
  const n = (name || '').toLowerCase();
  return ISOLATION_SIGNALS.some(p => n.includes(p));
}

function setCount(ex) {
  return Array.isArray(ex.sets) ? ex.sets.length : (typeof ex.sets === 'number' ? ex.sets : 3);
}

function daysBetween(dateA, dateB) {
  return (new Date(dateB + 'T00:00:00') - new Date(dateA + 'T00:00:00')) / 86400000;
}

// ── Rule A: Post-threshold-run leg reduction ──────────────────
function ruleA(workouts, { date, exercises }) {
  const yesterday = new Date(date + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const ydayStr = yesterday.toLocaleDateString('en-CA');

  const hardRun = workouts.find(w =>
    w.type === 'run' && w.status === 'completed' &&
    w.date === ydayStr &&
    HARD_RUN_TYPES.includes(w.details.runType) &&
    (w.details.actualDistance || 0) >= 5
  );

  if (!hardRun) return [];
  const hasLeg = exercises.some(ex => isLegCompound(ex.name));
  if (!hasLeg) return [];

  const adjs = [];
  for (const ex of exercises) {
    if (!isLegCompound(ex.name)) continue;
    const n = setCount(ex);
    adjs.push({
      id: `rule-a-sets-${ex.name}`,
      exerciseName: ex.name,
      adjustmentType: 'reduce_sets',
      reason: `Residual lower body fatigue from yesterday's ${hardRun.details.runType} (${hardRun.details.actualDistance} mi)`,
      suggestion: `Reduce to ${Math.max(1, n - 1)} sets — legs are still recovering`,
      originalValue: n,
      suggestedValue: Math.max(1, n - 1),
      severity: 'should',
      ruleId: 'rule-a',
    });
  }
  adjs.push({
    id: 'rule-a-rest',
    exerciseName: null,
    adjustmentType: 'extend_rest',
    reason: `Residual fatigue from yesterday's ${hardRun.details.runType}`,
    suggestion: 'Increase rest periods by 30s for all leg exercises',
    originalValue: null,
    suggestedValue: 30,
    severity: 'should',
    ruleId: 'rule-a',
  });
  return adjs;
}

// ── Rule B: Pre-hard-run leg protection ──────────────────────
function ruleB(workouts, { date, exercises }) {
  const tomorrow = new Date(date + 'T00:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tmrStr = tomorrow.toLocaleDateString('en-CA');

  const hardRun = workouts.find(w =>
    w.type === 'run' && w.status === 'planned' &&
    w.date === tmrStr && HARD_RUN_TYPES.includes(w.details.runType)
  );
  if (!hardRun) return [];

  const adjs = [];
  for (const ex of exercises) {
    if (!isLegCompound(ex.name)) continue;
    const n = setCount(ex);
    adjs.push({
      id: `rule-b-${ex.name}`,
      exerciseName: ex.name,
      adjustmentType: 'reduce_sets',
      reason: `Heavy legs today will impair tomorrow's ${hardRun.details.runType}`,
      suggestion: `Reduce ${ex.name} by 1 set and leave 2+ reps in reserve on each set`,
      originalValue: n,
      suggestedValue: Math.max(1, n - 1),
      severity: 'should',
      ruleId: 'rule-b',
    });
  }
  return adjs;
}

// ── Rule C: Same muscle high frequency ───────────────────────
function ruleC(workouts, { date, exercises }) {
  const cutoff = new Date(date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const todayMuscles = new Set(exercises.map(ex => ex.muscleGroup).filter(Boolean));
  const adjs = [];

  for (const mg of todayMuscles) {
    const recentSessions = workouts.filter(w =>
      w.type === 'lift' && w.status === 'completed' &&
      w.date >= cutoffStr && w.date < date &&
      (w.details.muscleGroups || []).includes(mg)
    );
    if (recentSessions.length < 2) continue; // 3+ including today

    for (const ex of exercises) {
      if (ex.muscleGroup !== mg) continue;
      if (isIsolation(ex.name)) {
        adjs.push({
          id: `rule-c-isolation-${ex.name}`,
          exerciseName: ex.name,
          adjustmentType: 'skip',
          reason: `High frequency for ${mg} — ${recentSessions.length + 1} sessions in 5 days`,
          suggestion: `Remove ${ex.name} — isolation work for ${mg} is unnecessary at this frequency`,
          originalValue: ex.name,
          suggestedValue: null,
          severity: 'must',
          ruleId: 'rule-c',
        });
      } else {
        const n = setCount(ex);
        adjs.push({
          id: `rule-c-compound-${ex.name}`,
          exerciseName: ex.name,
          adjustmentType: 'reduce_sets',
          reason: `High frequency for ${mg} — ${recentSessions.length + 1} sessions in 5 days`,
          suggestion: `Reduce ${ex.name} by 1 set to allow recovery`,
          originalValue: n,
          suggestedValue: Math.max(1, n - 1),
          severity: 'must',
          ruleId: 'rule-c',
        });
      }
    }
  }
  return adjs;
}

// ── Rule D: CNS fatigue — shift to hypertrophy ranges ────────
function ruleD(workouts, { date, exercises }) {
  const cutoff = new Date(date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const recentHeavy = workouts.filter(w =>
    w.status === 'completed' && w.date >= cutoffStr && w.date < date &&
    (
      (w.type === 'lift' && (w.details.exercises || []).some(ex => isCNSIntensive(ex.name))) ||
      (w.type === 'run' && HARD_RUN_TYPES.includes(w.details.runType))
    )
  );
  if (recentHeavy.length < 3) return [];

  const adjs = [];
  for (const ex of exercises) {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const hasHeavySets = sets.some(s => (s.targetReps || s.reps || 10) <= 5);
    if (!hasHeavySets) continue;
    adjs.push({
      id: `rule-d-${ex.name}`,
      exerciseName: ex.name,
      adjustmentType: 'reduce_weight',
      reason: 'CNS fatigue detected — 3+ high-intensity sessions in 5 days',
      suggestion: `Shift ${ex.name} to 8-12 rep range at ~70% weight to reduce neural demand`,
      originalValue: sets[0]?.targetReps || '1-5',
      suggestedValue: '8-12 reps at 70%',
      severity: 'should',
      ruleId: 'rule-d',
    });
  }
  return adjs;
}

// ── Rule E: Volume spike protection (>20% vs same session last week) ──
function ruleE(workouts, { date, exercises, sessionName }) {
  if (!exercises.length) return [];

  const oneWeekAgo  = new Date(date + 'T00:00:00'); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(date + 'T00:00:00'); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const wkStr = oneWeekAgo.toLocaleDateString('en-CA');
  const twStr = twoWeeksAgo.toLocaleDateString('en-CA');

  const firstWord = (sessionName || '').toLowerCase().split(' ')[0];
  const lastWeekSessions = workouts.filter(w =>
    w.type === 'lift' && w.status === 'completed' &&
    w.date >= twStr && w.date <= wkStr &&
    (firstWord ? (w.details.sessionName || '').toLowerCase().includes(firstWord) : true)
  );
  if (!lastWeekSessions.length) return [];

  // Estimate today's volume
  let todayVol = 0;
  exercises.forEach(ex => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    sets.forEach(s => todayVol += (s.targetReps || s.reps || 10) * (s.targetWeight || s.weight || 100));
  });

  const lastWeekVol = lastWeekSessions.reduce((s, w) => s + (w.details.totalVolume || 0), 0);
  if (!lastWeekVol || (todayVol - lastWeekVol) / lastWeekVol <= 0.2) return [];

  const inc = Math.round(((todayVol - lastWeekVol) / lastWeekVol) * 100);
  const bySetCount = [...exercises].sort((a, b) => setCount(b) - setCount(a));

  return bySetCount.slice(0, 2).map(ex => ({
    id: `rule-e-${ex.name}`,
    exerciseName: ex.name,
    adjustmentType: 'reduce_sets',
    reason: `>${inc}% volume increase vs last week — above 10% raises injury risk`,
    suggestion: `Reduce ${ex.name} by 1 set to cap weekly volume increase`,
    originalValue: setCount(ex),
    suggestedValue: Math.max(1, setCount(ex) - 1),
    severity: 'consider',
    ruleId: 'rule-e',
  }));
}

// ── Rule F: Pre-race / pre-interval protection (within 5 days) ──
function ruleF(workouts, { date, exercises }) {
  const RACE_TYPES = ['Race', 'Intervals', 'Tempo'];
  let nearestRace = null, daysUntil = null;

  for (let i = 1; i <= 5; i++) {
    const check = new Date(date + 'T00:00:00');
    check.setDate(check.getDate() + i);
    const checkStr = check.toLocaleDateString('en-CA');
    const found = workouts.find(w =>
      w.type === 'run' && w.status === 'planned' &&
      w.date === checkStr && RACE_TYPES.includes(w.details.runType)
    );
    if (found) { nearestRace = found; daysUntil = i; break; }
  }

  if (!nearestRace) return [];

  const severity = daysUntil <= 3 ? 'must' : 'should';
  const adjs = [];

  for (const ex of exercises) {
    if (!isLegCompound(ex.name)) continue;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const hasMaxEffort = sets.some(s => (s.targetReps || s.reps || 10) <= 3);
    if (!hasMaxEffort) continue;
    adjs.push({
      id: `rule-f-${ex.name}`,
      exerciseName: ex.name,
      adjustmentType: 'reduce_weight',
      reason: `${nearestRace.details.runType} in ${daysUntil} days — max-effort leg work this close risks performance`,
      suggestion: `Shift ${ex.name} to 5-8 rep range — avoid failure sets within ${daysUntil} days of your ${nearestRace.details.runType}`,
      originalValue: sets[0]?.targetReps || '1-3',
      suggestedValue: '5-8 reps',
      severity,
      ruleId: 'rule-f',
    });
  }
  return adjs;
}

// ── Main export ───────────────────────────────────────────────
export function generateLiftAdjustments(workouts, todayWorkout) {
  if (!workouts || !todayWorkout) return [];

  const exercises    = todayWorkout.exercises || todayWorkout.details?.exercises || [];
  const date         = todayWorkout.date || new Date().toLocaleDateString('en-CA');
  const sessionName  = todayWorkout.details?.sessionName || todayWorkout.sessionName || '';
  const type         = todayWorkout.type || todayWorkout.details?.type || 'lift';

  if (type !== 'lift' || !exercises.length) return [];

  const ctx = { date, exercises, sessionName };

  const raw = [
    ...ruleA(workouts, ctx),
    ...ruleB(workouts, ctx),
    ...ruleC(workouts, ctx),
    ...ruleD(workouts, ctx),
    ...ruleE(workouts, ctx),
    ...ruleF(workouts, ctx),
  ];

  // Deduplicate by exerciseName + adjustmentType
  const seen = new Set();
  return raw.filter(adj => {
    const key = `${adj.exerciseName || '_'}-${adj.adjustmentType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Apply a single adjustment to an exercises array ──────────
export function applyAdjustment(exercises, adj, restPreset) {
  switch (adj.adjustmentType) {
    case 'reduce_sets':
      return {
        exercises: exercises.map(ex => {
          if (ex.name !== adj.exerciseName) return ex;
          const sets = Array.isArray(ex.sets) ? ex.sets : [];
          if (sets.length <= 1) return ex;
          return { ...ex, sets: sets.slice(0, -1) };
        }),
        restPreset,
      };

    case 'reduce_weight':
      return {
        exercises: exercises.map(ex => {
          if (ex.name !== adj.exerciseName) return ex;
          return {
            ...ex,
            sets: (Array.isArray(ex.sets) ? ex.sets : []).map(s => ({
              ...s,
              targetWeight: s.targetWeight ? Math.round((s.targetWeight * 0.9) / 2.5) * 2.5 : null,
              weight:       s.weight       ? Math.round((s.weight       * 0.9) / 2.5) * 2.5 : null,
            })),
          };
        }),
        restPreset,
      };

    case 'extend_rest':
      return { exercises, restPreset: restPreset + (adj.suggestedValue || 30) };

    case 'skip':
      return {
        exercises: exercises.map(ex =>
          ex.name === adj.exerciseName ? { ...ex, isSkipped: true } : ex
        ),
        restPreset,
      };

    default:
      return { exercises, restPreset };
  }
}
