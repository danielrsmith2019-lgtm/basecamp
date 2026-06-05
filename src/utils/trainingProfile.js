/**
 * Analyzes the last 30 days of completed workouts to determine a user's
 * primary training archetype.
 */
export function getUserTrainingProfile(workouts) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const recent = (workouts || []).filter(
    w => w.status === 'completed' && w.date >= cutoffStr
  );

  const runCount    = recent.filter(w => w.type === 'run').length;
  const liftCount   = recent.filter(w => w.type === 'lift').length;
  const cardioCount = recent.filter(w => w.type === 'cardio').length;
  const totalCount  = runCount + liftCount + cardioCount;

  const runFraction  = totalCount > 0 ? runCount  / totalCount : 0;
  const liftFraction = totalCount > 0 ? liftCount / totalCount : 0;

  let primaryType;
  if (totalCount < 3) {
    primaryType = 'new';
  } else if (runFraction >= 0.75 && liftCount <= 2) {
    primaryType = 'runner';
  } else if (liftFraction >= 0.75 && runCount <= 2) {
    primaryType = 'lifter';
  } else {
    primaryType = 'hybrid';
  }

  return {
    primaryType,
    runCount,
    liftCount,
    cardioCount,
    runFraction,
    liftFraction,
  };
}
