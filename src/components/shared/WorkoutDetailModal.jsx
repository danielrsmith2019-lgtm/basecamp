'use client';

import { useState } from 'react';
import { formatDate, comparePaces } from '@/utils/runUtils';
import { formatVolume } from '@/utils/liftUtils';
import { Moon, Trash2, CalendarDays, X, SkipForward } from 'lucide-react';
import LogForm from './LogForm';
import { useWorkouts } from '@/lib/WorkoutContext';

const STATUS_BADGE = {
  completed: { label: 'Done',    bg: 'bg-bc-green-light', text: 'text-bc-green-dark' },
  planned:   { label: 'Planned', bg: 'bg-bc-blue-light',  text: 'text-bc-blue-dark'  },
  skipped:   { label: 'Skipped', bg: 'bg-bc-red-light',   text: 'text-bc-red-dark'   },
};

export default function WorkoutDetailModal({ workout, onClose, onSave }) {
  const { removeWorkout, saveWorkout } = useWorkouts();

  const [showLogForm,    setShowLogForm]    = useState(false);
  const [showDeleteConf, setShowDeleteConf] = useState(false);
  const [showDateEdit,   setShowDateEdit]   = useState(false);
  const [newDate,        setNewDate]        = useState(workout?.date || '');
  const [deleting,       setDeleting]       = useState(false);
  const [savingDate,     setSavingDate]     = useState(false);
  const [showSkipPanel,  setShowSkipPanel]  = useState(false);
  const [skipReason,     setSkipReason]     = useState('');

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

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeWorkout?.(workout.id);
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
      setShowDeleteConf(false);
    }
  }

  async function handleDateSave() {
    if (!newDate || newDate === workout.date) { setShowDateEdit(false); return; }
    setSavingDate(true);
    try {
      await saveWorkout?.({ ...workout, date: newDate });
      onSave?.({ ...workout, date: newDate });
      setSavingDate(false);
      setShowDateEdit(false);
      onClose();
    } catch (err) {
      console.error('Date save error:', err);
      setSavingDate(false);
    }
  }

  async function handleSkip() {
    try {
      const updated = { ...workout, status: 'skipped', details: { ...workout.details, notes: skipReason || workout.details?.notes || '' } };
      await saveWorkout?.(updated);
      onSave?.(updated);
      onClose();
    } catch (err) {
      console.error('Skip error:', err);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end
                 sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px]
                   shadow-xl max-w-lg w-full flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 96px)', marginBottom: '80px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 flex-shrink-0">
          <button
            onClick={() => { setShowDateEdit(v => !v); setShowDeleteConf(false); setShowSkipPanel(false); setNewDate(workout.date); }}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary
                       transition-colors min-h-[44px] -ml-1 px-1">
            <CalendarDays size={13} />
            {showDateEdit ? 'Cancel date edit' : 'Change date'}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center
                       text-secondary hover:text-primary transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* ── Inline date editor ── */}
        {showDateEdit && (
          <div className="mx-5 mt-3 p-3 bg-canvas rounded-[12px] border border-border
                          flex items-center gap-3 flex-shrink-0">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="bc-input !py-1.5 !px-2 !text-sm flex-1"
              style={{ minHeight: 36 }}
            />
            <button
              onClick={handleDateSave}
              disabled={savingDate || !newDate}
              className="px-3 py-1.5 bg-bc-blue text-white text-xs font-semibold
                         rounded-[8px] disabled:opacity-40 min-h-[36px]">
              {savingDate ? 'Saving…' : 'Save date'}
            </button>
          </div>
        )}

        {/* ── Scrollable content ── */}
        <div className="overflow-auto flex-1 px-5 py-3">
          {workout.type === 'run'  && <RunDetail  workout={workout} />}
          {workout.type === 'lift' && <LiftDetail workout={workout} />}
          {workout.type === 'rest' && <RestDetail workout={workout} />}
        </div>

        {/* ── Skip confirmation inline ── */}
        {showSkipPanel && (
          <div className="mx-5 mb-3 p-3 bg-bc-orange-light border border-bc-orange/20
                          rounded-[12px] flex-shrink-0">
            <p className="text-sm font-semibold text-bc-orange-dark mb-1">Mark as skipped?</p>
            <p className="text-xs text-secondary mb-2">Add an optional reason:</p>
            <input
              type="text"
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
              placeholder="e.g. travelling, sick, rest day..."
              className="bc-input !py-1.5 !text-xs mb-3"
              style={{ fontSize: '16px' }}
              onKeyDown={e => e.key === 'Enter' && handleSkip()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 py-2 text-white text-xs font-semibold rounded-[8px]"
                style={{ background: '#FF9500' }}>
                Mark Skipped
              </button>
              <button
                onClick={() => setShowSkipPanel(false)}
                className="flex-1 py-2 bg-canvas text-secondary text-xs font-medium
                           rounded-[8px] border border-border">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Delete confirmation inline ── */}
        {showDeleteConf && (
          <div className="mx-5 mb-3 p-3 bg-bc-red-light border border-bc-red/20
                          rounded-[12px] flex-shrink-0">
            <p className="text-sm font-semibold text-bc-red-dark mb-1">Delete this workout?</p>
            <p className="text-xs text-secondary mb-3">This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 text-white text-xs font-semibold rounded-[8px]
                           disabled:opacity-40"
                style={{ background: '#FF3B30' }}>
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setShowDeleteConf(false)}
                className="flex-1 py-2 bg-canvas text-secondary text-xs font-medium
                           rounded-[8px] border border-border">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex gap-2 p-5 pt-3 border-t border-border flex-shrink-0">
          {workout.status === 'planned' && (
            <button onClick={() => setShowLogForm(true)}
              className="bc-btn-primary flex-1 !py-2.5 !text-sm">
              Log {workout.type === 'run' ? 'Run' : 'Workout'}
            </button>
          )}
          {workout.status === 'completed' && (
            <button onClick={() => setShowLogForm(true)}
              className="flex-1 py-2.5 bg-canvas text-secondary text-sm font-medium
                         rounded-[10px] border border-border hover:text-primary transition-all">
              Edit Entry
            </button>
          )}
          {workout.status === 'skipped' && (
            <button onClick={() => setShowLogForm(true)}
              className="flex-1 py-2.5 bg-canvas text-secondary text-sm font-medium
                         rounded-[10px] border border-border hover:text-primary transition-all">
              Log Anyway
            </button>
          )}

          {/* Skip — only for planned workouts */}
          {workout.status === 'planned' && (
            <button
              onClick={() => { setShowSkipPanel(v => !v); setShowDeleteConf(false); setShowDateEdit(false); }}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px]
                          border text-sm font-medium transition-all min-h-[44px]
                          ${showSkipPanel
                            ? 'bg-bc-orange-light border-bc-orange/30 text-bc-orange-dark'
                            : 'border-border text-secondary hover:border-bc-orange/30 hover:text-bc-orange-dark'}`}>
              <SkipForward size={14} />
              Skip
            </button>
          )}

          <button
            onClick={() => { setShowDeleteConf(v => !v); setShowDateEdit(false); setShowSkipPanel(false); }}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px]
                        border text-sm font-medium transition-all min-h-[44px]
                        ${showDeleteConf
                          ? 'bg-bc-red-light border-bc-red/30 text-bc-red'
                          : 'border-border text-secondary hover:border-bc-red/30 hover:text-bc-red'}`}>
            <Trash2 size={14} />
            {showDeleteConf ? 'Cancel' : 'Delete'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-canvas text-secondary text-sm font-medium
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
  const statusInfo     = STATUS_BADGE[status] || STATUS_BADGE.planned;
  const paceComparison = status === 'completed'
    ? comparePaces(details.actualPace, details.targetPace)
    : null;

  const RUN_LABELS = {
    easy: 'Easy Run', tempo: 'Tempo Run', interval: 'Intervals',
    long_run: 'Long Run', recovery: 'Recovery Run', fartlek: 'Fartlek',
  };
  function getRunLabel(t) {
    if (!t) return 'Run';
    const key   = t.toLowerCase().replace(/_/g, ' ');
    const found = Object.entries(RUN_LABELS).find(([k]) => k.toLowerCase().replace(/_/g, ' ') === key);
    return found ? found[1] : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div>
      <h3 className="text-[17px] font-semibold text-primary mb-0.5">{getRunLabel(details.runType)}</h3>
      <p className="text-sm text-secondary mb-3">{formatDate(date)}</p>

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

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-run-bg rounded-[14px] p-3">
          <p className="bc-caption uppercase tracking-wider mb-2">Planned</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-secondary">Distance</span>
              <span className="text-sm font-bold text-run-accent"
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {details.plannedDistance} mi
              </span>
            </div>
            {details.targetPace && (
              <div className="flex justify-between">
                <span className="text-xs text-secondary">Pace</span>
                <span className="text-sm font-semibold text-run-accent"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {details.targetPace}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-[14px] p-3 ${status === 'completed' ? 'bg-bc-green-light' : 'bg-canvas'}`}>
          <p className="bc-caption uppercase tracking-wider mb-2">Actual</p>
          {status === 'completed' ? (
            <div className="space-y-1.5">
              {details.actualDistance != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">Distance</span>
                  <span className="text-sm font-bold text-bc-green-dark"
                    style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {details.actualDistance} mi
                  </span>
                </div>
              )}
              {details.actualPace && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">Pace</span>
                  <span className={`text-sm font-semibold ${paceComparison?.color || 'text-bc-green-dark'}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {details.actualPace}
                    {paceComparison?.label && (
                      <span className="text-[10px] ml-1 opacity-70">{paceComparison.label}</span>
                    )}
                  </span>
                </div>
              )}
              {details.rpe != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">RPE</span>
                  <span className="text-sm font-semibold text-primary">{details.rpe}/10</span>
                </div>
              )}
              {details.caloriesBurned != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-secondary">Calories</span>
                  <span className="text-sm font-semibold text-bc-green-dark"
                    style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {details.caloriesBurned}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-tertiary italic">Not logged yet</p>
          )}
        </div>
      </div>

      {details.notes && (
        <p className="text-sm text-secondary italic">&ldquo;{details.notes}&rdquo;</p>
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
      <h3 className="text-[17px] font-semibold text-primary mb-0.5">
        {details.sessionName || 'Workout'}
      </h3>
      <p className="text-sm text-secondary mb-3">{formatDate(date)}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <span className={`bc-pill text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
        {(details.muscleGroups || []).map(mg => (
          <span key={mg} className="bc-pill bg-lift-bg text-lift-accent text-[10px]">{mg}</span>
        ))}
      </div>

      {(details.totalVolume != null || details.duration != null || details.totalSets != null) && (
        <div className="flex gap-4 mb-4 p-3 bg-lift-bg rounded-[14px] flex-wrap">
          {details.totalSets != null && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-lift-accent"
                style={{ fontVariantNumeric: 'tabular-nums' }}>{details.totalSets}</span>
              <span className="bc-caption">Sets</span>
            </div>
          )}
          {details.totalVolume != null && (
            <>
              {details.totalSets != null && <div className="w-px bg-border" />}
              <div className="flex flex-col">
                <span className="text-lg font-bold text-lift-accent"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVolume(details.totalVolume)}</span>
                <span className="bc-caption">Volume</span>
              </div>
            </>
          )}
          {details.duration && (
            <>
              <div className="w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-lift-accent"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{details.duration}m</span>
                <span className="bc-caption">Duration</span>
              </div>
            </>
          )}
          {details.caloriesBurned && (
            <>
              <div className="w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-lift-accent"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{details.caloriesBurned}</span>
                <span className="bc-caption">Cal burned</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {(details.exercises || []).map((exercise, i) => (
          <div key={i} className="bg-canvas rounded-[12px] p-3 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary">{exercise.name}</span>
              {exercise.muscleGroup && (
                <span className="bc-pill bg-lift-bg text-lift-accent text-[10px]">
                  {exercise.muscleGroup}
                </span>
              )}
            </div>
            {Array.isArray(exercise.sets) ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {['Set', 'lbs', 'Reps', 'RPE'].map(h => (
                    <span key={h} className="bc-caption text-center uppercase">{h}</span>
                  ))}
                </div>
                {exercise.sets.map((set, j) => (
                  <div key={j} className="grid grid-cols-4 gap-2 py-1 border-t border-border/50">
                    <span className="text-xs text-tertiary text-center"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>{set.setNumber}</span>
                    <span className="text-xs font-semibold text-primary text-center"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {set.weight ?? set.targetWeight ?? '—'}
                    </span>
                    <span className="text-xs font-semibold text-primary text-center"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {set.reps ?? set.targetReps ?? '—'}
                    </span>
                    <span className="text-xs text-secondary text-center">{set.rpe ?? '—'}</span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-xs text-tertiary">
                {exercise.sets} sets × {exercise.reps} reps
              </p>
            )}
          </div>
        ))}
      </div>

      {details.notes && (
        <p className="text-sm text-secondary mt-4 italic">&ldquo;{details.notes}&rdquo;</p>
      )}
    </div>
  );
}


// ── Rest Detail ──────────────────────────────────────────

function RestDetail({ workout }) {
  const REST_LABELS = {
    full_rest: 'Rest Day', off_running: 'No Running',
    off_lifting: 'No Lifting', active_recovery: 'Active Recovery',
  };
  function getRestLabel(t) {
    if (!t) return 'Rest Day';
    const key   = t.toLowerCase().replace(/_/g, ' ');
    const found = Object.entries(REST_LABELS).find(([k]) => k.replace(/_/g, ' ') === key);
    return found ? found[1] : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 rounded-[20px] bg-rest-bg flex items-center justify-center mx-auto mb-3">
        <Moon size={28} className="text-rest-accent" strokeWidth={2} />
      </div>
      <h3 className="text-[17px] font-semibold text-primary mb-1">
        {getRestLabel(workout.details?.restType)}
      </h3>
      <p className="text-sm text-secondary">{formatDate(workout.date)}</p>
      {workout.details?.notes && (
        <p className="text-sm text-tertiary mt-3 italic">{workout.details.notes}</p>
      )}
    </div>
  );
}