/**
 * Readiness Score — 0-100 composite from check-in + training data.
 *
 * Factors:
 *   - Acute:Chronic load ratio (40%) — 7-day vs 28-day rolling average
 *   - Sleep hours (25%)
 *   - Energy level (20%)
 *   - Soreness (15%)
 */

// ── Training load helpers ──────────────────────────────

function getTrainingLoad(workouts, days) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return workouts
    .filter(w => w.status === 'completed' && w.date >= cutoffStr)
    .reduce((sum, w) => {
      if (w.type === 'run') return sum + (w.details.actualDistance || 0) * 10;
      if (w.type === 'lift') return sum + (w.details.totalVolume || 0) / 1000;
      return sum + 5; // cardio flat score
    }, 0);
}

function getDaysSinceRest(workouts) {
  const today = new Date().toISOString().split('T')[0];
  const restDays = workouts
    .filter(w => w.type === 'rest' && w.status === 'completed' && w.date <= today)
    .map(w => w.date)
    .sort()
    .reverse();

  if (restDays.length === 0) return 14; // penalize if no rest logged
  const last = new Date(restDays[0] + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - last) / (1000 * 60 * 60 * 24));
}

// ── Main score function ────────────────────────────────

export async function calculateReadinessScore(checkIn, workouts = [], getNutritionLogFn = null, userId = null) {
  const { sleepHours = 7, energyLevel = 3, soreness = 2 } = checkIn || {};

  // Factor 1: Acute:Chronic load ratio (40%)
  const acute   = getTrainingLoad(workouts, 7);
  const chronic = getTrainingLoad(workouts, 28) / 4;
  const acr = chronic > 0 ? acute / chronic : 1;
  let loadScore;
  if (acr >= 0.8 && acr <= 1.3)  loadScore = 100;
  else if (acr < 0.8)             loadScore = Math.max(0, acr / 0.8 * 100);
  else                            loadScore = Math.max(0, 100 - (acr - 1.3) * 100);

  // Factor 2: Sleep (25%)
  const sleepScore = Math.min(100, Math.max(0, ((sleepHours - 4) / 4) * 100));

  // Factor 3: Energy (20%)
  const energyScore = ((energyLevel - 1) / 4) * 100;

  // Factor 4: Soreness (15%)
  const sorenessScore = ((5 - soreness) / 4) * 100;

  // Days since rest penalty
  const daysSinceRest = getDaysSinceRest(workouts);
  const restPenalty = daysSinceRest > 7 ? Math.min(20, (daysSinceRest - 7) * 3) : 0;

  // Weighted composite
  const raw = (
    loadScore     * 0.40 +
    sleepScore    * 0.25 +
    energyScore   * 0.20 +
    sorenessScore * 0.15
  );

  let score = Math.round(Math.max(0, Math.min(100, raw - restPenalty)));

  // Nutrition penalty — check yesterday's intake
  if (getNutritionLogFn && userId) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const log = await getNutritionLogFn(userId, yesterdayStr);
      if (log?.daily_totals?.calories) {
        const yesterdayCals  = log.daily_totals.calories;
        // Use baseline 2000 as fallback target
        const yesterdayTarget = log.daily_totals.target || 2000;
        const adherence = yesterdayCals / yesterdayTarget;

        if (adherence < 0.6)       score = Math.max(0, score - 20);
        else if (adherence < 0.8)  score = Math.max(0, score - 10);
      }
    } catch (e) {
      // Nutrition log unavailable — skip penalty
    }
  }

  return score;
}

export function getReadinessColor(score) {
  if (score >= 70) return '#34C759';
  if (score >= 40) return '#FF9500';
  return '#FF3B30';
}

export function getReadinessLabel(score) {
  if (score >= 85) return 'Peak ready';
  if (score >= 70) return 'Ready to train';
  if (score >= 55) return 'Train with care';
  if (score >= 40) return 'Take it easy';
  return 'Consider rest';
}

const HARD_RUN_TYPES = ['tempo', 'interval', 'long_run', 'race'];

export function shouldSuggestSwap(score, todayWorkouts) {
  if (score >= 50) return false;
  return todayWorkouts.some(w =>
    w.type === 'run' && HARD_RUN_TYPES.includes(w.details?.runType)
  );
}