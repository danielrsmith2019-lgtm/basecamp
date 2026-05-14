'use client';

/**
 * LogForm — Unified workout logging modal.
 * Adapts fields based on workout type (run / lift / cardio).
 *
 * Two modes:
 *   1. LOGGING a planned workout: receives a workout with status 'planned',
 *      fills in actual data, updates status to 'completed'.
 *   2. CREATING a new workout: receives no workout, user picks type and date.
 *
 * Also supports EDITING a completed workout (same as logging, but pre-filled).
 */

import { useState, useMemo, useCallback } from 'react';
import ExerciseSearch from '@/components/lifting/ExerciseSearch';
import SetLogger from '@/components/lifting/SetLogger';
import { formatPace, calculatePace, comparePaces } from '@/utils/runUtils';
import { calculateLiftVolume } from '@/data/types';

const RUN_TYPES = [
  'Easy Run', 'Tempo', 'Intervals', 'Long Run', 'Race',
  'Shakeout', 'Recovery', 'REST',
];

const CARDIO_TYPES = [
  'Cycling', 'Swimming', 'Rowing', 'Elliptical',
  'Stair Climber', 'Walking', 'Hiking', 'Jump Rope', 'Other',
];

export default function LogForm({ workout, onSave, onClose }) {
  const initialType = workout?.type || 'run';
  const isEditing = workout?.status === 'completed';
  const isLogging = workout?.status === 'planned';
  const isNew = !workout;

  const [workoutType, setWorkoutType] = useState(initialType);

  // ── Run state ──
  const [runType, setRunType] = useState(workout?.details?.runType || 'Easy Run');
  const [distance, setDistance] = useState(
    isEditing ? (workout?.details?.actualDistance ?? '') : (workout?.details?.plannedDistance ?? '')
  );
  const [timeMin, setTimeMin] = useState(() => {
    const time = workout?.details?.actualTime;
    if (!time) return '';
    const parts = time.split(':');
    return parts.length === 3 ? String(parseInt(parts[0]) * 60 + parseInt(parts[1])) : parts[0];
  });
  const [timeSec, setTimeSec] = useState(() => {
    const time = workout?.details?.actualTime;
    if (!time) return '';
    const parts = time.split(':');
    return parts[parts.length - 1];
  });
  const [runRpe, setRunRpe] = useState(workout?.details?.rpe ?? '');
  const [runNotes, setRunNotes] = useState(workout?.details?.notes ?? '');

  // ── Lift state ──
  const [sessionName, setSessionName] = useState(workout?.details?.sessionName || '');
  const [exercises, setExercises] = useState(workout?.details?.exercises || []);
  const [liftNotes, setLiftNotes] = useState(workout?.details?.notes ?? '');

  // ── Cardio state ──
  const [cardioType, setCardioType] = useState(workout?.details?.activityType || 'Cycling');
  const [cardioDuration, setCardioDuration] = useState(workout?.details?.duration ?? '');
  const [heartRate, setHeartRate] = useState(workout?.details?.heartRate ?? '');
  const [cardioCalories, setCardioCalories] = useState(workout?.details?.caloriesBurned ?? '');
  const [cardioRpe, setCardioRpe] = useState(workout?.details?.rpe ?? '');
  const [cardioNotes, setCardioNotes] = useState(workout?.details?.notes ?? '');

  // ── Shared state ──
  const [date, setDate] = useState(workout?.date || new Date().toISOString().split('T')[0]);

  // ── Live pace calculation ──
  const livePace = useMemo(() => {
    const d = parseFloat(distance);
    const m = parseInt(timeMin) || 0;
    const s = parseInt(timeSec) || 0;
    if (!d || d === 0 || (m === 0 && s === 0)) return null;
    const totalMin = m + s / 60;
    const pace = totalMin / d;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
  }, [distance, timeMin, timeSec]);

  function buildTimeString() {
    const m = parseInt(timeMin) || 0;
    const s = parseInt(timeSec) || 0;
    if (m === 0 && s === 0) return null;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleAddExercise(exercise) {
    const newExercise = {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      sets: [
        { setNumber: 1, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 2, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 3, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
      ],
    };
    setExercises(prev => [...prev, newExercise]);
    if (!sessionName) {
      const groups = [...new Set([...exercises.map(e => e.muscleGroup), exercise.muscleGroup])];
      setSessionName(groups.join(' / '));
    }
  }

  function handleUpdateExercise(index, updatedExercise) {
    setExercises(prev => prev.map((e, i) => i === index ? updatedExercise : e));
  }

  function handleRemoveExercise(index) {
    setExercises(prev => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    let details = {};

    if (workoutType === 'run') {
      const timeString = buildTimeString();
      details = {
        ...(workout?.details || {}),
        runType,
        runDescription: workout?.details?.runDescription || runType,
        phase: workout?.details?.phase || '',
        week: workout?.details?.week || 0,
        plannedDistance: workout?.details?.plannedDistance || parseFloat(distance) || 0,
        targetPace: workout?.details?.targetPace || '',
        actualDistance: parseFloat(distance) || null,
        actualTime: timeString,
        actualPace: livePace,
        rpe: runRpe ? parseInt(runRpe) : null,
        notes: runNotes || null,
      };
    }

    if (workoutType === 'lift') {
      const { totalVolume, totalSets } = calculateLiftVolume(exercises);
      const muscleGroups = [...new Set(exercises.map(e => e.muscleGroup).filter(Boolean))];
      details = {
        sessionName: sessionName || muscleGroups.join(' / ') || 'Workout',
        muscleGroups,
        exercises,
        totalVolume,
        totalSets,
        duration: null,
        notes: liftNotes || null,
      };
    }

    if (workoutType === 'cardio') {
      details = {
        activityType: cardioType,
        duration: cardioDuration ? parseInt(cardioDuration) : null,
        distance: null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        caloriesBurned: cardioCalories ? parseInt(cardioCalories) : null,
        rpe: cardioRpe ? parseInt(cardioRpe) : null,
        notes: cardioNotes || null,
      };
    }

    onSave({
      id: workout?.id || null,
      date,
      type: workoutType,
      status: 'completed',
      planId: workout?.planId || null,
      details,
    });
  }

  const TYPE_TABS = [
    { key: 'run',    label: '🏃 Run' },
    { key: 'lift',   label: '🏋️ Lift' },
    { key: 'cardio', label: '🚴 Cardio' },
  ];

  // ── RPE color helper ──
  function rpeActiveClass(n) {
    if (n <= 4) return 'bg-bc-green-light text-bc-green-dark';
    if (n <= 7) return 'bg-bc-orange-light text-bc-orange-dark';
    return 'bg-bc-red-light text-bc-red-dark';
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl
                   max-w-lg w-full animate-modal-in max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <h3 className="text-[17px] font-semibold text-primary">
            {isEditing ? 'Edit Workout' : isLogging ? 'Log Workout' : 'New Workout'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                       text-secondary hover:text-primary text-lg leading-none transition-colors">
            ×
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="overflow-auto flex-1 p-5 space-y-4">

          {/* ── Planned info banner ── */}
          {isLogging && workout && (
            <div className="bg-canvas rounded-[14px] p-3">
              <p className="bc-caption uppercase tracking-wider mb-1">Planned</p>
              {workout.type === 'run' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    {workout.details.runDescription || workout.details.runType}
                  </span>
                  <span className="bc-data text-sm text-secondary">
                    {workout.details.plannedDistance} mi @ {workout.details.targetPace}
                  </span>
                </div>
              )}
              {workout.type === 'lift' && (
                <span className="text-sm font-medium text-primary">
                  {workout.details.sessionName}
                </span>
              )}
            </div>
          )}

          {/* ── Type selector tabs ── */}
          <div className="bc-tab-bar">
            {TYPE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => !isLogging && setWorkoutType(tab.key)}
                disabled={isLogging}
                className={`bc-tab ${workoutType === tab.key ? 'bc-tab-active' : ''}
                            ${isLogging ? 'cursor-not-allowed opacity-60' : ''}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Date picker (new workouts only) ── */}
          {isNew && (
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bc-input"
              />
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ── RUN FIELDS ── */}
          {/* ══════════════════════════════════════════ */}
          {workoutType === 'run' && (
            <div className="space-y-4">
              {isNew && (
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Run Type</label>
                  <select
                    value={runType}
                    onChange={(e) => setRunType(e.target.value)}
                    className="bc-input cursor-pointer">
                    {RUN_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Distance */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">
                  Distance (miles)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder={workout?.details?.plannedDistance ? String(workout.details.plannedDistance) : '0.0'}
                  className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Time */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Time</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={timeMin}
                      onChange={(e) => setTimeMin(e.target.value)}
                      placeholder="0"
                      className="bc-input bc-data text-center pr-10
                                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">min</span>
                  </div>
                  <span className="text-xl text-tertiary font-bold">:</span>
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timeSec}
                      onChange={(e) => setTimeSec(e.target.value)}
                      placeholder="00"
                      className="bc-input bc-data text-center pr-10
                                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">sec</span>
                  </div>
                </div>
              </div>

              {/* Live pace preview */}
              <div className="bg-run-bg rounded-[14px] p-4 text-center">
                <p className="bc-caption uppercase tracking-wider mb-1">Pace</p>
                <p className={`bc-data text-3xl font-bold ${livePace ? 'text-run-accent' : 'text-tertiary'}`}>
                  {livePace || '--:--'}
                </p>
                <p className="bc-caption mt-1">/mile</p>
                {livePace && workout?.details?.targetPace && (() => {
                  const comparison = comparePaces(livePace, workout.details.targetPace);
                  if (!comparison) return null;
                  return (
                    <div className="mt-2">
                      <span className={`bc-pill text-sm ${comparison.color} bg-transparent`}>
                        {comparison.label} vs {workout.details.targetPace}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* RPE */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setRunRpe(n === runRpe ? '' : n)}
                      className={`flex-1 py-2 text-sm rounded-[10px] transition-colors bc-data
                        ${Number(runRpe) === n
                          ? rpeActiveClass(n)
                          : 'bg-canvas text-secondary hover:text-primary'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="How did it feel?"
                  rows={2}
                  className="bc-input resize-none placeholder:text-tertiary"
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ── LIFT FIELDS ── */}
          {/* ══════════════════════════════════════════ */}
          {workoutType === 'lift' && (
            <div className="space-y-4">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Push Day, Pull Day, Legs..."
                  className="bc-input placeholder:text-tertiary"
                />
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Add Exercise</label>
                <ExerciseSearch onSelect={handleAddExercise} placeholder="Search exercises..." />
              </div>

              {exercises.length > 0 && (
                <div className="space-y-3">
                  {exercises.map((exercise, i) => (
                    <div key={i} className="relative">
                      <button
                        onClick={() => handleRemoveExercise(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-surface border border-border
                                   rounded-full text-tertiary hover:text-bc-red hover:border-bc-red
                                   flex items-center justify-center text-xs transition-colors z-10">
                        ×
                      </button>
                      <SetLogger
                        exercise={exercise}
                        onChange={(updated) => handleUpdateExercise(i, updated)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {exercises.length === 0 && (
                <div className="bc-empty py-6">
                  <p className="bc-empty-title">No exercises added yet.</p>
                  <p className="bc-empty-text">
                    Search and add exercises above. Each gets its own set logger.
                  </p>
                </div>
              )}

              {exercises.length > 0 && (
                <div className="bg-lift-bg rounded-[14px] p-3 flex items-center justify-between">
                  <span className="bc-caption uppercase tracking-wider">Session Volume</span>
                  <span className="bc-data text-sm font-bold text-lift-accent">
                    {(() => {
                      const { totalVolume, totalSets } = calculateLiftVolume(exercises);
                      return `${totalSets} sets · ${totalVolume.toLocaleString()} lbs`;
                    })()}
                  </span>
                </div>
              )}

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea
                  value={liftNotes}
                  onChange={(e) => setLiftNotes(e.target.value)}
                  placeholder="Session notes..."
                  rows={2}
                  className="bc-input resize-none placeholder:text-tertiary"
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ── CARDIO FIELDS ── */}
          {/* ══════════════════════════════════════════ */}
          {workoutType === 'cardio' && (
            <div className="space-y-4">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Activity</label>
                <select
                  value={cardioType}
                  onChange={(e) => setCardioType(e.target.value)}
                  className="bc-input cursor-pointer">
                  {CARDIO_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={cardioDuration}
                  onChange={(e) => setCardioDuration(e.target.value)}
                  placeholder="30"
                  className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Avg Heart Rate</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="—"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Calories</label>
                  <input
                    type="number"
                    value={cardioCalories}
                    onChange={(e) => setCardioCalories(e.target.value)}
                    placeholder="—"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setCardioRpe(n === cardioRpe ? '' : n)}
                      className={`flex-1 py-2 text-sm rounded-[10px] transition-colors bc-data
                        ${Number(cardioRpe) === n
                          ? rpeActiveClass(n)
                          : 'bg-canvas text-secondary hover:text-primary'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea
                  value={cardioNotes}
                  onChange={(e) => setCardioNotes(e.target.value)}
                  placeholder="Session notes..."
                  rows={2}
                  className="bc-input resize-none placeholder:text-tertiary"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-3 border-t border-border flex gap-3">
          <button
            onClick={handleSave}
            className="bc-btn-primary flex-1 py-3 text-sm">
            {isEditing ? 'Save Changes' : 'Log Workout'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-canvas text-secondary text-sm font-medium
                       rounded-[10px] hover:text-primary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}