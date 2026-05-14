'use client';

/**
 * LiftCard — Displays a single lift workout as a styled card.
 * Follows the STRIDE RunCard anatomy exactly:
 *   → Left accent border (blue for lifting)
 *   → Row 1: emoji + session name + date
 *   → Row 2: muscle group badges
 *   → Row 3: exercise count + total volume in font-mono
 *   → Row 4: top set details (if completed)
 */

import { formatDate } from '@/utils/runUtils';
import {
  getMuscleGroupColors,
  getSessionEmoji,
  formatVolume,
  summarizeExercises,
  findBestSet,
} from '@/utils/liftUtils';

export default function LiftCard({ workout, onClick }) {
  if (!workout) return null;

  const { date, status, details } = workout;
  const {
    sessionName,
    muscleGroups = [],
    exercises = [],
    totalVolume,
    totalSets,
    duration,
    notes,
  } = details;

  const emoji = getSessionEmoji(sessionName);

  // Find the best set across all exercises for the "top set" display
  let topSet = null;
  let topSetExercise = '';
  for (const exercise of exercises) {
    const best = findBestSet(exercise.sets || []);
    if (best && (!topSet || best.e1rm > topSet.e1rm)) {
      topSet = best;
      topSetExercise = exercise.name;
    }
  }

  const statusMap = {
    completed: { label: 'Done',    emoji: '✓', bg: 'bg-status-done/20',    text: 'text-status-done' },
    planned:   { label: 'Planned', emoji: '—', bg: 'bg-status-planned/20', text: 'text-status-planned' },
    skipped:   { label: 'Skipped', emoji: '✗', bg: 'bg-status-skipped/20', text: 'text-status-skipped' },
  };
  const statusInfo = statusMap[status] || statusMap.planned;

  return (
    <div
      onClick={() => onClick?.(workout)}
      className="bc-card stride-accent-left border-activity-lift p-4 cursor-pointer"
    >
      {/* ── Row 1: Emoji + Session Name + Date ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="font-semibold text-primary">{sessionName || 'Workout'}</span>
        </div>
        <span className="text-sm text-secondary">{formatDate(date)}</span>
      </div>

      {/* ── Row 2: Muscle Group Badges + Status ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {muscleGroups.map(mg => {
          const colors = getMuscleGroupColors(mg);
          return (
            <span key={mg} className={`stride-badge ${colors.bg} ${colors.text}`}>
              {mg}
            </span>
          );
        })}
        <span className={`stride-badge ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.emoji} {statusInfo.label}
        </span>
      </div>

      {/* ── Row 3: Exercise Summary + Volume ── */}
      <div className="flex items-center gap-4 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted uppercase tracking-wide">Exercises</span>
          <span className="stride-data text-sm text-primary">
            {exercises.length}
          </span>
        </div>
        {totalSets != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted uppercase tracking-wide">Sets</span>
            <span className="stride-data text-sm text-primary">
              {totalSets}
            </span>
          </div>
        )}
        {totalVolume != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted uppercase tracking-wide">Volume</span>
            <span className="stride-data text-sm text-primary">
              {formatVolume(totalVolume)}
            </span>
          </div>
        )}
      </div>

      {/* Exercise list preview */}
      <p className="text-xs text-secondary mt-1">
        {summarizeExercises(exercises)}
      </p>

      {/* ── Row 4: Top Set (completed only) ── */}
      {status === 'completed' && topSet && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted uppercase tracking-wide">Top Set</span>
              <span className="stride-data text-sm text-primary">
                {topSetExercise}
              </span>
            </div>
            <span className="stride-data text-sm text-activity-lift">
              {topSet.weight} lbs × {topSet.reps}
            </span>
            <span className="text-xs text-secondary">
              e1RM: <span className="stride-data">{topSet.e1rm}</span>
            </span>
          </div>
          {duration && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted uppercase tracking-wide">Duration</span>
              <span className="stride-data text-sm text-secondary">{duration} min</span>
            </div>
          )}
          {notes && (
            <p className="text-xs text-secondary mt-2 italic">{notes}</p>
          )}
        </div>
      )}

      {status === 'skipped' && notes && (
        <p className="text-xs text-status-skipped mt-2 italic">{notes}</p>
      )}
    </div>
  );
}