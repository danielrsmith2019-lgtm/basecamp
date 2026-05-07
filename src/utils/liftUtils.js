/**
 * BASECAMP — Lifting Utilities
 * Ported from the Fitness App's lifting logic.
 * Follows the same pattern as runUtils.js — pure functions, no side effects.
 */


// ═══════════════════════════════════════════════════════
// MUSCLE GROUP HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Maps muscle groups to Tailwind color classes.
 * Uses the STRIDE badge pattern — bg with low opacity + matching text.
 */
export function getMuscleGroupColors(muscleGroup) {
  const map = {
    'Chest':       { bg: 'bg-phase-build/20',    text: 'text-phase-build' },
    'Back':        { bg: 'bg-phase-base/20',     text: 'text-phase-base' },
    'Quads':       { bg: 'bg-phase-peak/20',     text: 'text-phase-peak' },
    'Hamstrings':  { bg: 'bg-phase-peak/20',     text: 'text-phase-peak' },
    'Glutes':      { bg: 'bg-phase-peak/20',     text: 'text-phase-peak' },
    'Shoulders':   { bg: 'bg-phase-taper/20',    text: 'text-phase-taper' },
    'Biceps':      { bg: 'bg-phase-recovery/20', text: 'text-phase-recovery' },
    'Triceps':     { bg: 'bg-phase-recovery/20', text: 'text-phase-recovery' },
    'Abs':         { bg: 'bg-accent/20',         text: 'text-accent' },
    'Calves':      { bg: 'bg-phase-peak/20',     text: 'text-phase-peak' },
    'Traps':       { bg: 'bg-phase-base/20',     text: 'text-phase-base' },
    'Forearms':    { bg: 'bg-secondary/20',      text: 'text-secondary' },
  };
  return map[muscleGroup] || { bg: 'bg-muted/20', text: 'text-muted' };
}

/**
 * Maps session names to emoji icons.
 * Follows STRIDE's emoji-first iconography pattern.
 */
// Emoji icons removed — use LiftSessionIcon from '@/utils/icons' instead.
export function getSessionEmoji(sessionName) {
  return null; // Deprecated: use <LiftSessionIcon> component
}


// ═══════════════════════════════════════════════════════
// VOLUME & STRENGTH CALCULATIONS
// ═══════════════════════════════════════════════════════

/**
 * Formats a volume number for display.
 * Example: 12450 → "12,450 lbs"
 */
export function formatVolume(volume) {
  if (!volume || isNaN(volume)) return '—';
  return volume.toLocaleString() + ' lbs';
}

/**
 * Calculates estimated 1 Rep Max using the Epley formula.
 * Formula: weight × (1 + reps / 30)
 * 
 * @param {number} weight - Weight lifted
 * @param {number} reps - Reps completed (must be > 0)
 * @returns {number} Estimated 1RM, rounded to nearest integer
 */
export function calculateE1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight; // Actual 1RM
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Finds the best set in an exercise (highest estimated 1RM).
 * Returns the set object plus the calculated e1RM.
 */
export function findBestSet(sets) {
  let best = null;
  let bestE1RM = 0;

  for (const set of sets) {
    if (set.completed && set.weight && set.reps) {
      const e1rm = calculateE1RM(set.weight, set.reps);
      if (e1rm > bestE1RM) {
        bestE1RM = e1rm;
        best = { ...set, e1rm };
      }
    }
  }

  return best;
}

/**
 * Summarizes a list of exercises for card display.
 * Example: "Bench Press, OHP, Lateral Raises +2 more"
 */
export function summarizeExercises(exercises, maxShow = 3) {
  if (!exercises || exercises.length === 0) return 'No exercises';
  const names = exercises.map(e => e.name);
  if (names.length <= maxShow) return names.join(', ');
  return names.slice(0, maxShow).join(', ') + ` +${names.length - maxShow} more`;
}