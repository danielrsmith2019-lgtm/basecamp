'use client';

/**
 * WorkoutDetailModal — Views workout details and opens LogForm for editing.
 * Now integrates with LogForm instead of showing placeholder alerts.
 */

import { useState } from 'react';
import { formatDate, getRunTypeEmoji, getPhaseColors, getStatusInfo, comparePaces } from '@/utils/runUtils';
import { getSessionEmoji, getMuscleGroupColors, formatVolume } from '@/utils/liftUtils';
import LogForm from './LogForm';

export default function WorkoutDetailModal({ workout, onClose, onSave }) {
  const [showLogForm, setShowLogForm] = useState(false);

  if (!workout) return null;

  // If LogForm is open, render that instead
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-card shadow-modal
                   max-w-lg w-full p-5 animate-modal-in max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>

        {workout.type === 'run' && <RunDetail workout={workout} />}
        {workout.type === 'lift' && <LiftDetail workout={workout} />}
        {workout.type === 'rest' && <RestDetail workout={workout} />}

        {/* Action buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          {workout.status === 'planned' && (
            <button
              onClick={() => setShowLogForm(true)}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-medium
                         rounded-lg hover:brightness-110 transition-all"
            >
              Log {workout.type === 'run' ? 'Run' : 'Workout'}
            </button>
          )}
          {workout.status === 'completed' && (
            <button
              onClick={() => setShowLogForm(true)}
              className="flex-1 py-2.5 bg-surface text-secondary text-sm font-medium
                         rounded-lg hover:text-primary transition-all"
            >
              Edit Entry
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-surface text-secondary text-sm
                       rounded-lg hover:text-primary transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


function RunDetail({ workout }) {
  const { date, status, details } = workout;
  const phaseColors = getPhaseColors(details.phase);
  const statusInfo = getStatusInfo(status);
  const paceComparison = status === 'completed' ? comparePaces(details.actualPace, details.targetPace) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{getRunTypeEmoji(details.runType)}</span>
        <h3 className="text-lg font-bold text-primary">{details.runType}</h3>
      </div>
      <p className="text-sm text-secondary mb-4">{formatDate(date)}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {details.phase && (
          <span className={`stride-badge ${phaseColors.bg} ${phaseColors.text}`}>
            {details.phase.replace(/Phase \d+: /, '')}
          </span>
        )}
        <span className={`stride-badge ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.emoji} {statusInfo.label}
        </span>
      </div>

      {details.runDescription && (
        <p className="text-sm text-secondary mb-4">{details.runDescription}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-lg p-3">
          <p className="stride-section-label mb-2">Planned</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-muted">Distance</span>
              <span className="stride-data text-sm text-primary">{details.plannedDistance} mi</span>
            </div>
            {details.targetPace && (
              <div className="flex justify-between">
                <span className="text-xs text-muted">Pace</span>
                <span className="stride-data text-sm text-primary">{details.targetPace}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg p-3 ${status === 'completed' ? 'bg-surface' : 'bg-surface/50'}`}>
          <p className="stride-section-label mb-2">Actual</p>
          {status === 'completed' ? (
            <div className="space-y-1.5">
              {details.actualDistance != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted">Distance</span>
                  <span className="stride-data text-sm text-primary">{details.actualDistance} mi</span>
                </div>
              )}
              {details.actualPace && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted">Pace</span>
                  <span className={`stride-data text-sm ${paceComparison?.color || 'text-primary'}`}>
                    {details.actualPace}
                  </span>
                </div>
              )}
              {details.rpe != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted">RPE</span>
                  <span className="stride-data text-sm text-primary">{details.rpe}/10</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted italic">Not logged yet</p>
          )}
        </div>
      </div>

      {details.notes && (
        <p className="text-sm text-secondary mt-4 italic">&ldquo;{details.notes}&rdquo;</p>
      )}
    </div>
  );
}


function LiftDetail({ workout }) {
  const { date, status, details } = workout;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{getSessionEmoji(details.sessionName)}</span>
        <h3 className="text-lg font-bold text-primary">{details.sessionName || 'Workout'}</h3>
      </div>
      <p className="text-sm text-secondary mb-4">{formatDate(date)}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(details.muscleGroups || []).map(mg => {
          const colors = getMuscleGroupColors(mg);
          return <span key={mg} className={`stride-badge ${colors.bg} ${colors.text}`}>{mg}</span>;
        })}
      </div>

      {details.totalVolume != null && (
        <div className="flex gap-4 mb-4">
          <div className="stride-stat">
            <span className="stride-data text-lg font-bold text-primary">{details.totalSets}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">Sets</span>
          </div>
          <div className="stride-stat">
            <span className="stride-data text-lg font-bold text-activity-lift">{formatVolume(details.totalVolume)}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">Volume</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(details.exercises || []).map((exercise, i) => (
          <div key={i} className="bg-surface rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">{exercise.name}</span>
              <span className={`stride-badge text-[10px] ${getMuscleGroupColors(exercise.muscleGroup).bg} ${getMuscleGroupColors(exercise.muscleGroup).text}`}>
                {exercise.muscleGroup}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs mb-1">
              <span className="text-muted uppercase text-center">Set</span>
              <span className="text-muted uppercase text-center">lbs</span>
              <span className="text-muted uppercase text-center">Reps</span>
              <span className="text-muted uppercase text-center">RPE</span>
            </div>
            {(exercise.sets || []).map((set, j) => (
              <div key={j} className="grid grid-cols-4 gap-2 text-xs py-0.5">
                <span className="stride-data text-muted text-center">{set.setNumber}</span>
                <span className="stride-data text-primary text-center">{set.weight ?? set.targetWeight ?? '—'}</span>
                <span className="stride-data text-primary text-center">{set.reps ?? set.targetReps ?? '—'}</span>
                <span className="stride-data text-secondary text-center">{set.rpe ?? '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {details.notes && (
        <p className="text-sm text-secondary mt-4 italic">&ldquo;{details.notes}&rdquo;</p>
      )}
    </div>
  );
}


function RestDetail({ workout }) {
  return (
    <div className="text-center py-4">
      <span className="text-4xl mb-3 block">😴</span>
      <h3 className="text-lg font-bold text-primary mb-1">{workout.details?.restType || 'Rest Day'}</h3>
      <p className="text-sm text-secondary">{formatDate(workout.date)}</p>
      {workout.details?.notes && (
        <p className="text-sm text-muted mt-3 italic">{workout.details.notes}</p>
      )}
    </div>
  );
}