/**
 * progressiveOverload.js
 *
 * Analyzes lift history per exercise and suggests next session
 * weight and reps based on what was actually completed.
 *
 * Rules:
 *  1. Find the most recent completed session containing this exercise
 *  2. If the user hit ALL reps at target in the last session → increment weight
 *  3. If the user hit most reps (≥80%) but not all → hold weight, aim for full reps
 *  4. If the user missed reps significantly (<80%) → reduce weight 5%
 *  5. Increment amount depends on exercise type:
 *     - Compound (squat, deadlift, bench, row, OHP): +5 lbs
 *     - Isolation (curl, extension, lateral, fly): +2.5 lbs
 *     - Bodyweight (pull-up, dip, push-up): +1 rep
 *  6. After 3 consecutive sessions at same weight hitting all reps: force increment
 *
 * Returns null if no history — LogForm falls back to plan prescription.
 */

// Exercises treated as compound movements (larger increments)
const COMPOUND_PATTERNS = [
  'squat','deadlift','bench press','barbell row','overhead press','ohp',
  'romanian deadlift','rdl','hip thrust','leg press','pull-up','pullup',
  'chin-up','chinup','dip','barbell curl','incline press','decline press',
];

// Exercises that are bodyweight (increment reps not weight)
const BODYWEIGHT_PATTERNS = [
  'pull-up','pullup','chin-up','chinup','dip','push-up','pushup',
  'inverted row','ring row',
];

function classifyExercise(name) {
  if (!name) return 'isolation';
  const n = name.toLowerCase();
  if (BODYWEIGHT_PATTERNS.some(p => n.includes(p))) return 'bodyweight';
  if (COMPOUND_PATTERNS.some(p => n.includes(p))) return 'compound';
  return 'isolation';
}

function incrementFor(type) {
  return type === 'compound' ? 5 : type === 'bodyweight' ? 0 : 2.5;
}

/**
 * getSuggestion(exerciseName, workouts)
 *
 * @param {string} exerciseName
 * @param {Array}  workouts — all completed lift workouts from DB
 * @returns {{ weight, reps, suggestedWeight, suggestedReps, lastDate,
 *             consecutiveSessions, direction, reason }} | null
 */
export function getSuggestion(exerciseName, workouts) {
  if (!exerciseName || !workouts?.length) return null;

  const name = exerciseName.toLowerCase().trim();
  const type = classifyExercise(name);

  // Find all completed lift sessions that contain this exercise, newest first
  const sessions = workouts
    .filter(w => w.type === 'lift' && w.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(w => {
      const ex = (w.details?.exercises || []).find(
        e => e.name?.toLowerCase().trim() === name
      );
      if (!ex) return null;

      // Normalize sets to array form with weight + reps
      const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
      const sets = rawSets
        .filter(s => s.weight != null && s.reps != null)
        .map(s => ({
          weight:    Number(s.weight),
          reps:      Number(s.reps),
          targetReps:Number(s.targetReps || s.reps),
          completed: !!s.completed,
        }));

      if (sets.length === 0) return null;

      const completedSets = sets.filter(s => s.completed);
      const totalReps     = completedSets.reduce((s, set) => s + set.reps, 0);
      const targetReps    = completedSets.reduce((s, set) => s + set.targetReps, 0);
      const avgWeight     = completedSets.length > 0
        ? completedSets.reduce((s, set) => s + set.weight, 0) / completedSets.length
        : 0;

      return {
        date:        w.date,
        avgWeight:   Math.round(avgWeight),
        reps:        completedSets.length > 0 ? Math.round(totalReps / completedSets.length) : 0,
        hitAllReps:  targetReps > 0 && totalReps >= targetReps,
        repRate:     targetReps > 0 ? totalReps / targetReps : 1,
        setCount:    completedSets.length,
      };
    })
    .filter(Boolean);

  if (sessions.length === 0) return null;

  const last = sessions[0];
  const inc  = incrementFor(type);

  // Count consecutive sessions where all reps were hit at same weight
  let consecutiveHits = 0;
  for (const s of sessions) {
    if (s.hitAllReps && s.avgWeight === last.avgWeight) consecutiveHits++;
    else break;
  }

  // Determine suggestion
  let suggestedWeight = last.avgWeight;
  let suggestedReps   = last.reps;
  let direction       = 'hold';
  let reason          = '';

  if (type === 'bodyweight') {
    // Bodyweight: increment reps
    if (last.hitAllReps || consecutiveHits >= 2) {
      suggestedReps = last.reps + 1;
      direction = 'up';
      reason = `+1 rep — you hit all reps last time`;
    } else if (last.repRate < 0.75) {
      suggestedReps = Math.max(1, last.reps - 1);
      direction = 'down';
      reason = `−1 rep — missed reps last time`;
    } else {
      reason = `Same reps — work toward ${last.reps} clean`;
    }
  } else if (last.hitAllReps) {
    // Hit all reps → increase weight
    suggestedWeight = Math.round((last.avgWeight + inc) / 2.5) * 2.5;
    direction = 'up';
    reason = `+${inc} lbs — hit all reps last session`;
  } else if (consecutiveHits >= 3) {
    // Stuck at same weight 3+ sessions → force increment
    suggestedWeight = Math.round((last.avgWeight + inc) / 2.5) * 2.5;
    direction = 'up';
    reason = `+${inc} lbs — ${consecutiveHits} sessions at this weight`;
  } else if (last.repRate >= 0.8) {
    // Hit most reps → hold and push for full reps
    reason = `Same weight — aim for all reps`;
  } else {
    // Missed reps significantly → back off 5%
    suggestedWeight = Math.round((last.avgWeight * 0.95) / 2.5) * 2.5;
    direction = 'down';
    reason = `−5% — struggled last session`;
  }

  return {
    // What they did last time
    lastDate:     last.date,
    lastWeight:   last.avgWeight,
    lastReps:     last.reps,
    lastSetCount: last.setCount,
    // Suggestion for this session
    suggestedWeight,
    suggestedReps,
    direction,   // 'up' | 'down' | 'hold'
    reason,
    consecutiveHits,
    exerciseType: type,
  };
}

/**
 * getExerciseHistory(exerciseName, workouts, limit)
 *
 * Returns recent session data for sparkline / trend display.
 * Each entry: { date, avgWeight, reps, volume }
 */
export function getExerciseHistory(exerciseName, workouts, limit = 6) {
  if (!exerciseName || !workouts?.length) return [];

  const name = exerciseName.toLowerCase().trim();

  return workouts
    .filter(w => w.type === 'lift' && w.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map(w => {
      const ex = (w.details?.exercises || []).find(
        e => e.name?.toLowerCase().trim() === name
      );
      if (!ex) return null;
      const sets = (Array.isArray(ex.sets) ? ex.sets : [])
        .filter(s => s.completed && s.weight && s.reps);
      if (!sets.length) return null;
      const avgWeight = sets.reduce((s,set) => s+Number(set.weight), 0) / sets.length;
      const avgReps   = sets.reduce((s,set) => s+Number(set.reps),   0) / sets.length;
      return {
        date:      w.date,
        avgWeight: Math.round(avgWeight),
        reps:      Math.round(avgReps),
        volume:    sets.reduce((s,set) => s+Number(set.weight)*Number(set.reps), 0),
      };
    })
    .filter(Boolean)
    .slice(0, limit)
    .reverse(); // chronological for sparkline
}