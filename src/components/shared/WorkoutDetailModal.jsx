'use client';

/**
 * WorkoutDetailModal — Views workout details and opens LogForm for editing.
 */

import { useState } from 'react';
import { formatDate, getRunTypeEmoji, comparePaces } from '@/utils/runUtils';
import { getSessionEmoji, getMuscleGroupColors, formatVolume } from '@/utils/liftUtils';
import LogForm from './LogForm';

const STATUS_BADGE = {
  completed: { label: 'Done',    bg: 'bg-bc-green-light', text: 'text-bc-green-dark' },
  planned:   { label: 'Planned', bg: 'bg-bc-blue-light',  text: 'text-bc-blue-dark'  },
  skipped:   { label: 'Skipped', bg: 'bg-bc-red-light',   text: 'text-bc-red-dark'   },
};

export default function WorkoutDetailModal({ workout, onClose, onSave }) {
  const [showLogForm, setShowLogForm] = useState(false);

  if (!workout) return null;

  if (showLogForm) {
    return (
      <LogForm
        workout={workout}
        onSave={(data) => {
          onSave?.(data);
          setShowLogForm(false);
          onClose();
        }}
        onClose={() => setShowLogForm(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end
                 sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px]
                   shadow-xl max-w-lg w-full p-5 max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}>

        {/* ── Close button ── */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                       text-secondary hover:text-primary text-lg transition-colors">
            ×
          </button>
        </div>

        {workout.type === 'run'  && <RunDetail  workout={workout} />}
        {workout.type === 'lift' && <LiftDetail workout={workout} />}
        {workout.type === 'rest' && <RestDetail workout={workout} />}

        {/* ── Action buttons ── */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          {workout.status === 'planned' && (
            <button
              onClick={() => setShowLogForm(true)}
              className="bc-btn-primary flex-1 py-2.5 text-sm">
              Log {workout.type === 'run' ? 'Run' : 'Workout'}
            </button>
          )}
          {workout.status === 'completed' && (
            <button
              onClick={() => setShowLogForm(true)}
              className="flex-1 py-2.5 bg-canvas text-secondary text-sm font-medium
                         rounded-[10px] border border-border hover:text-primary transition-all">
              Edit Entry
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-canvas text-secondary text-sm font-medium
                       rounded-[10px] border border-border hover:text-primary transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Run Detail ───────────────────────────────────────────

function RunDetail({ workout }) {
  const { date, status, details } = workout;
  const statusInfo = STATUS_BADGE[status] || STATUS_BADGE.planned;
  const paceComparison = status === 'completed'
    ? comparePaces(details.actualPace, details.targetPace)
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{getRunTypeEmoji(details.runType)}</span>
        <h3 className="text-[17px] font-semibold text-primary">{details.runType}</h3>
      </div>
      <p className="text-sm text-secondary mb-4">{formatDate(date)}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {details.phase && (
          <span className="bc-pill bg-canvas text-tertiary text-[10px] border border-border">
            {details.phase.replace(/Phase \d+: /, '')}
          </span>
        )}
        <span className={`bc-pill text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
      </div>

      {details.runDescription && (
        <p className="text-sm text-secondary mb-4">{details.runDescription}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Planned */}
        <div className="bg-run-bg rounded-[14px] p-3">
          <p className="bc-caption uppercase tracking-wider mb-2">Planned</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Distance</span>
              <span className="bc-data text-sm text-run-accent">{details.plannedDistance} mi</span>
            </div>
            {details.targetPace && (
              <div className="flex justify-between">
                <span className="text-xs text-secondary">Pace</span>
                <span className="bc-data text-sm text-run-accent">{details.targetPace}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actual */}
        <div className={`rounded-[14px] p-3 ${status === 'completed' ? 'bg-bc-green-light' : 'bg-canvas'}`}>
          <p className="bc-caption uppercase tracking-wider mb-2">Actual</p>
          {status === 'completed' ? (
            <div className="space-y-1.5">
              {details.actualDistance != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">Distance</span>
                  <span className="bc-data text-sm text-bc-green-dark">{details.actualDistance} mi</span>
                </div>
              )}
              {details.actualPace && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">Pace</span>
                  <span className={`bc-data text-sm ${paceComparison?.color || 'text-bc-green-dark'}`}>
                    {details.actualPace}
                  </span>
                </div>
              )}
              {details.rpe != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">RPE</span>
                  <span className="bc-data text-sm text-primary">{details.rpe}/10</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-tertiary italic">Not logged yet</p>
          )}
        </div>
      </div>

      {details.notes && (
        <p className="text-sm text-secondary mt-4 italic">&ldquo;{details.notes}&rdquo;</p>
      )}
    </div>
  );
}


// ── Lift Detail ──────────────────────────────────────────

function LiftDetail({ workout }) {
  const { date, status, details } = workout;
  const statusInfo = STATUS_BADGE[status] || STATUS_BADGE.planned;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{getSessionEmoji(details.sessionName)}</span>
        <h3 className="text-[17px] font-semibold text-primary">{details.sessionName || 'Workout'}</h3>
      </div>
      <p className="text-sm text-secondary mb-3">{formatDate(date)}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <span className={`bc-pill text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
        {(details.muscleGroups || []).map(mg => (
          <span key={mg} className="bc-pill bg-lift-bg text-lift-accent text-[10px]">{mg}</span>
        ))}
      </div>

      {details.totalVolume != null && (
        <div className="flex gap-6 mb-4 p-3 bg-lift-bg rounded-[14px]">
          <div className="flex flex-col">
            <span className="bc-data text-lg font-bold text-lift-accent">{details.totalSets}</span>
            <span className="bc-caption">Sets</span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex flex-col">
            <span className="bc-data text-lg font-bold text-lift-accent">
              {formatVolume(details.totalVolume)}
            </span>
            <span className="bc-caption">Volume</span>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
  {Array.isArray(exercise.sets) ? (
    exercise.sets.map((set, j) => (
      <div key={j} className="grid grid-cols-4 gap-2 text-xs py-0.5">
        <span className="bc-data text-tertiary text-center">{set.setNumber}</span>
        <span className="bc-data text-primary text-center">{set.weight ?? set.targetWeight ?? '—'}</span>
        <span className="bc-data text-primary text-center">{set.reps ?? set.targetReps ?? '—'}</span>
        <span className="bc-data text-secondary text-center">{set.rpe ?? '—'}</span>
      </div>
    ))
  ) : (
    <div className="text-xs text-tertiary py-1">
      {exercise.sets} sets × {exercise.reps} reps
    </div>
  )}
</div>

      {details.notes && (
        <p className="text-sm text-secondary mt-4 italic">&ldquo;{details.notes}&rdquo;</p>
      )}
    </div>
  );
}


// ── Rest Detail ──────────────────────────────────────────

function RestDetail({ workout }) {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 rounded-[20px] bg-rest-bg flex items-center justify-center
                      mx-auto mb-3 text-3xl">
        😴
      </div>
      <h3 className="text-[17px] font-semibold text-primary mb-1">
        {workout.details?.restType || 'Rest Day'}
      </h3>
      <p className="text-sm text-secondary">{formatDate(workout.date)}</p>
      {workout.details?.notes && (
        <p className="text-sm text-tertiary mt-3 italic">{workout.details.notes}</p>
      )}
    </div>
  );
}