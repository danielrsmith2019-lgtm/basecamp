'use client';

/**
 * LogForm — Unified workout logging modal.
 *
 * New in this version:
 *   - Timer button in header → full-screen WorkoutTimer
 *   - Timer stop auto-fills duration + calories
 *   - Duration field for lift sessions
 *   - Calories burned for all workout types
 *   - Icon tabs (no emojis), inline-style active state
 */

import { useState, useMemo } from 'react';
import ExerciseSearch from '@/components/lifting/ExerciseSearch';
import SetLogger from '@/components/lifting/SetLogger';
import WorkoutTimer, { formatTime, estimateCalories } from '@/components/shared/WorkoutTimer';
import { comparePaces } from '@/utils/runUtils';
import { calculateLiftVolume } from '@/data/types';
import { shouldShowPostWorkoutPrompt } from '@/utils/nutrition';
import PostWorkoutPrompt from '@/components/shared/PostWorkoutPrompt';
import { Footprints, Dumbbell, Bike, Timer } from 'lucide-react';

const RUN_TYPES = [
  'Easy Run', 'Tempo', 'Intervals', 'Long Run', 'Race',
  'Shakeout', 'Recovery', 'REST',
];

const CARDIO_TYPES = [
  'Cycling', 'Swimming', 'Rowing', 'Elliptical',
  'Stair Climber', 'Walking', 'Hiking', 'Jump Rope', 'Other',
];

const TYPE_TABS = [
  { key: 'run',    label: 'Run',    Icon: Footprints },
  { key: 'lift',   label: 'Lift',   Icon: Dumbbell   },
  { key: 'cardio', label: 'Cardio', Icon: Bike       },
];

const TAB_COLOR = { run: '#34C759', lift: '#007AFF', cardio: '#FF9500' };

export default function LogForm({ workout, onSave, onClose, userWeight = 170 }) {
  const initialType = workout?.type || 'run';
  const isEditing   = workout?.status === 'completed';
  const isLogging   = workout?.status === 'planned';
  const isNew       = !workout;

  const [workoutType, setWorkoutType]   = useState(initialType);
  const [savedWorkout, setSavedWorkout] = useState(null);
  const [showPostPrompt, setShowPostPrompt] = useState(false);

  // Timer state
  const [showTimer,    setShowTimer]    = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0); // elapsed when timer was stopped

  // ── Run state ──
  const [runType,     setRunType]     = useState(workout?.details?.runType       || 'Easy Run');
  const [distance,    setDistance]    = useState(
    isEditing ? (workout?.details?.actualDistance ?? '') : (workout?.details?.plannedDistance ?? '')
  );
  const [timeMin, setTimeMin] = useState(() => {
    const t = workout?.details?.actualTime;
    if (!t) return '';
    const parts = t.split(':');
    return parts.length === 3 ? String(parseInt(parts[0]) * 60 + parseInt(parts[1])) : parts[0];
  });
  const [timeSec,     setTimeSec]     = useState(() => {
    const t = workout?.details?.actualTime;
    if (!t) return '';
    const parts = t.split(':');
    return parts[parts.length - 1];
  });
  const [runRpe,      setRunRpe]      = useState(workout?.details?.rpe            ?? '');
  const [runNotes,    setRunNotes]    = useState(workout?.details?.notes          ?? '');
  const [runCalories, setRunCalories] = useState(workout?.details?.caloriesBurned ?? '');

  // ── Lift state ──
  const [sessionName,  setSessionName]  = useState(workout?.details?.sessionName   || '');
  const [exercises,    setExercises]    = useState(workout?.details?.exercises     || []);
  const [liftNotes,    setLiftNotes]    = useState(workout?.details?.notes         ?? '');
  const [liftDuration, setLiftDuration] = useState(
    workout?.details?.duration ? String(workout.details.duration) : ''
  );
  const [liftCalories, setLiftCalories] = useState(workout?.details?.caloriesBurned ?? '');

  // ── Cardio state ──
  const [cardioType,     setCardioType]     = useState(workout?.details?.activityType   || 'Cycling');
  const [cardioDuration, setCardioDuration] = useState(
    workout?.details?.duration ? String(workout.details.duration) : ''
  );
  const [heartRate,      setHeartRate]      = useState(workout?.details?.heartRate      ?? '');
  const [cardioCalories, setCardioCalories] = useState(workout?.details?.caloriesBurned ?? '');
  const [cardioRpe,      setCardioRpe]      = useState(workout?.details?.rpe            ?? '');
  const [cardioNotes,    setCardioNotes]    = useState(workout?.details?.notes          ?? '');

  // ── Shared state ──
  const [date, setDate] = useState(workout?.date || new Date().toLocaleDateString('en-CA'));

  // ── Live pace ──
  const livePace = useMemo(() => {
    const d = parseFloat(distance);
    const m = parseInt(timeMin) || 0;
    const s = parseInt(timeSec) || 0;
    if (!d || (m === 0 && s === 0)) return null;
    const pace    = (m + s / 60) / d;
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

  // ── Timer stop callback — auto-fill duration + calories ──
  function handleTimerStop(seconds, calories) {
    setTimerSeconds(seconds);
    setShowTimer(false);
    const mins = Math.round(seconds / 60);

    if (workoutType === 'run') {
      // Auto-fill time if not already entered
      if (!timeMin && !timeSec && seconds > 0) {
        setTimeMin(String(Math.floor(seconds / 60)));
        setTimeSec(String(seconds % 60));
      }
      if (!runCalories && calories > 0) setRunCalories(String(calories));
    }
    if (workoutType === 'lift') {
      if (!liftDuration && mins > 0) setLiftDuration(String(mins));
      if (!liftCalories && calories > 0) setLiftCalories(String(calories));
    }
    if (workoutType === 'cardio') {
      if (!cardioDuration && mins > 0) setCardioDuration(String(mins));
      if (!cardioCalories && calories > 0) setCardioCalories(String(calories));
    }
  }

  // ── Exercises ──
  function handleAddExercise(exercise) {
    const newEx = {
      name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment,
      sets: [
        { setNumber: 1, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 2, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 3, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
      ],
    };
    setExercises(prev => [...prev, newEx]);
    if (!sessionName) {
      const groups = [...new Set([...exercises.map(e => e.muscleGroup), exercise.muscleGroup])];
      setSessionName(groups.join(' / '));
    }
  }

  function handleUpdateExercise(index, updated) {
    setExercises(prev => prev.map((e, i) => i === index ? updated : e));
  }

  function handleRemoveExercise(index) {
    setExercises(prev => prev.filter((_, i) => i !== index));
  }

  // ── Save ──
  function handleSave() {
    let details = {};

    if (workoutType === 'run') {
      details = {
        ...(workout?.details || {}),
        runType,
        runDescription: workout?.details?.runDescription || runType,
        phase:           workout?.details?.phase         || '',
        week:            workout?.details?.week          || 0,
        plannedDistance: workout?.details?.plannedDistance || parseFloat(distance) || 0,
        targetPace:      workout?.details?.targetPace    || '',
        actualDistance:  parseFloat(distance)            || null,
        actualTime:      buildTimeString(),
        actualPace:      livePace,
        rpe:             runRpe      ? parseInt(runRpe)      : null,
        caloriesBurned:  runCalories ? parseInt(runCalories) : null,
        notes:           runNotes    || null,
      };
    }

    if (workoutType === 'lift') {
      const { totalVolume, totalSets } = calculateLiftVolume(exercises);
      const muscleGroups = [...new Set(exercises.map(e => e.muscleGroup).filter(Boolean))];
      details = {
        sessionName:    sessionName  || muscleGroups.join(' / ') || 'Workout',
        muscleGroups,   exercises,   totalVolume,   totalSets,
        duration:       liftDuration ? parseInt(liftDuration) : null,
        caloriesBurned: liftCalories ? parseInt(liftCalories) : null,
        notes:          liftNotes    || null,
      };
    }

    if (workoutType === 'cardio') {
      details = {
        activityType:   cardioType,
        duration:       cardioDuration ? parseInt(cardioDuration) : null,
        distance:       null,
        heartRate:      heartRate      ? parseInt(heartRate)      : null,
        caloriesBurned: cardioCalories ? parseInt(cardioCalories) : null,
        rpe:            cardioRpe      ? parseInt(cardioRpe)      : null,
        notes:          cardioNotes    || null,
      };
    }

    const saved = { id: workout?.id || null, date, type: workoutType, status: 'completed', planId: workout?.planId || null, details };
    onSave(saved);

    if (shouldShowPostWorkoutPrompt(saved)) {
      setSavedWorkout(saved);
      setShowPostPrompt(true);
    } else {
      onClose();
    }
  }

  function rpeColor(n) {
    if (n <= 4) return 'bg-bc-green-light text-bc-green-dark';
    if (n <= 7) return 'bg-bc-orange-light text-bc-orange-dark';
    return 'bg-bc-red-light text-bc-red-dark';
  }

  // Post-workout prompt replaces modal
  if (showPostPrompt && savedWorkout) {
    return (
      <PostWorkoutPrompt workout={savedWorkout} userWeight={userWeight}
        onDismiss={() => { setShowPostPrompt(false); onClose(); }} />
    );
  }

  const accentColor = TAB_COLOR[workoutType] || '#007AFF';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ paddingBottom: 0 }}
      onClick={onClose}>
      <div className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl max-w-lg w-full flex flex-col" style={{ maxHeight: 'calc(100dvh - 96px)', marginBottom: '80px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-[17px] font-semibold text-primary">
              {isEditing ? 'Edit Workout' : isLogging ? 'Log Workout' : 'New Workout'}
            </h3>
            {timerSeconds > 0 && (
              <p className="bc-caption mt-0.5" style={{ color: accentColor }}>
                Timer: {formatTime(timerSeconds)} recorded
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Timer toggle — shows/hides floating bar inside modal */}
            <button onClick={() => setShowTimer(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium transition-all min-h-[44px]"
              style={{
                background: showTimer ? accentColor : `${accentColor}14`,
                color: showTimer ? '#FFFFFF' : accentColor,
                border: `1px solid ${accentColor}30`,
              }}
              title="Toggle workout timer">
              <Timer size={13} strokeWidth={2} />
              <span>{timerSeconds > 0 ? formatTime(timerSeconds) : 'Timer'}</span>
            </button>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary text-xl leading-none transition-colors">
              ×
            </button>
          </div>
        </div>

        {/* ── Floating timer bar — visible while showTimer, stays above form ── */}
        {showTimer && (
          <div className="flex-shrink-0 border-b border-border"
            style={{ background: `${accentColor}08` }}>
            <WorkoutTimer
              compact
              workoutType={workoutType}
              userWeight={userWeight}
              onStop={handleTimerStop}
            />
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="overflow-auto flex-1 p-5 space-y-4">

          {/* Planned info banner */}
          {isLogging && workout && (
            <div className="bg-canvas rounded-[14px] p-3">
              <p className="bc-caption uppercase tracking-wider mb-1">Planned</p>
              {workout.type === 'run' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">{workout.details.runDescription || workout.details.runType}</span>
                  <span className="bc-data text-sm text-secondary">{workout.details.plannedDistance} mi @ {workout.details.targetPace}</span>
                </div>
              )}
              {workout.type === 'lift' && (
                <span className="text-sm font-medium text-primary">{workout.details.sessionName}</span>
              )}
            </div>
          )}

          {/* Type tabs — icon-only, inline active styles */}
          <div className="bc-tab-bar">
            {TYPE_TABS.map(({ key, label, Icon }) => {
              const isActive = workoutType === key;
              return (
                <button key={key}
                  onClick={() => !isLogging && setWorkoutType(key)}
                  disabled={isLogging}
                  className="bc-tab flex items-center gap-1.5"
                  style={{
                    background:   isActive ? TAB_COLOR[key]  : 'transparent',
                    color:        isActive ? '#FFFFFF'        : '#8E8E93',
                    fontWeight:   isActive ? 600              : 500,
                    borderRadius: '10px',
                    flex:         1,
                    opacity:      isLogging && key !== workoutType ? 0.4 : 1,
                    cursor:       isLogging ? 'not-allowed' : 'pointer',
                  }}>
                  <Icon size={13} strokeWidth={2} style={{ color: isActive ? '#FFFFFF' : '#AEAEB2' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Date (new workout only) */}
          {isNew && (
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bc-input" />
            </div>
          )}

          {/* ════════════ RUN FIELDS ════════════ */}
          {workoutType === 'run' && (
            <div className="space-y-4">
              {isNew && (
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Run Type</label>
                  <select value={runType} onChange={e => setRunType(e.target.value)} className="bc-input cursor-pointer">
                    {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Distance (miles)</label>
                <input type="number" step="0.1" value={distance}
                  onChange={e => setDistance(e.target.value)}
                  placeholder={workout?.details?.plannedDistance ? String(workout.details.plannedDistance) : '0.0'}
                  className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Time</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="number" value={timeMin} onChange={e => setTimeMin(e.target.value)} placeholder="0"
                      className="bc-input bc-data text-center pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">min</span>
                  </div>
                  <span className="text-xl text-tertiary font-bold">:</span>
                  <div className="flex-1 relative">
                    <input type="number" min="0" max="59" value={timeSec} onChange={e => setTimeSec(e.target.value)} placeholder="00"
                      className="bc-input bc-data text-center pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">sec</span>
                  </div>
                </div>
              </div>

              {/* Live pace */}
              <div className="bg-run-bg rounded-[14px] p-4 text-center">
                <p className="bc-caption uppercase tracking-wider mb-1">Pace</p>
                <p className={`bc-data text-3xl font-bold ${livePace ? 'text-run-accent' : 'text-tertiary'}`}>{livePace || '--:--'}</p>
                <p className="bc-caption mt-1">/mile</p>
                {livePace && workout?.details?.targetPace && (() => {
                  const c = comparePaces(livePace, workout.details.targetPace);
                  if (!c) return null;
                  return <div className="mt-2"><span className={`bc-pill text-sm ${c.color} bg-transparent`}>{c.label} vs {workout.details.targetPace}</span></div>;
                })()}
              </div>

              {/* Calories burned */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">
                  Calories Burned
                  {timerSeconds > 0 && <span className="ml-1 text-bc-green-dark">(auto from timer)</span>}
                </label>
                <input type="number" value={runCalories} onChange={e => setRunCalories(e.target.value)}
                  placeholder="Optional — syncs to nutrition"
                  className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              </div>

              {/* RPE */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setRunRpe(n === runRpe ? '' : n)}
                      className={`flex-1 py-2 text-sm rounded-[10px] transition-colors bc-data
                        ${Number(runRpe) === n ? rpeColor(n) : 'bg-canvas text-secondary hover:text-primary'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea value={runNotes} onChange={e => setRunNotes(e.target.value)}
                  placeholder="How did it feel?" rows={2} className="bc-input resize-none placeholder:text-tertiary" />
              </div>
            </div>
          )}

          {/* ════════════ LIFT FIELDS ════════════ */}
          {workoutType === 'lift' && (
            <div className="space-y-4">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Session Name</label>
                <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)}
                  placeholder="Push Day, Pull Day, Legs..." className="bc-input placeholder:text-tertiary" />
              </div>

              {/* Duration + Calories side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">
                    Duration (min)
                    {timerSeconds > 0 && <span className="ml-1 text-bc-green-dark">✓</span>}
                  </label>
                  <input type="number" value={liftDuration} onChange={e => setLiftDuration(e.target.value)}
                    placeholder="60"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">
                    Calories Burned
                    {timerSeconds > 0 && <span className="ml-1 text-bc-green-dark">✓</span>}
                  </label>
                  <input type="number" value={liftCalories} onChange={e => setLiftCalories(e.target.value)}
                    placeholder="Auto from timer"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Add Exercise</label>
                <ExerciseSearch onSelect={handleAddExercise} placeholder="Search exercises..." />
              </div>

              {exercises.length > 0 && (
                <div className="space-y-3">
                  {exercises.map((exercise, i) => (
                    <div key={i} className="relative">
                      <button onClick={() => handleRemoveExercise(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-surface border border-border rounded-full text-tertiary hover:text-bc-red hover:border-bc-red flex items-center justify-center text-xs transition-colors z-10">
                        ×
                      </button>
                      <SetLogger exercise={exercise} onChange={u => handleUpdateExercise(i, u)} />
                    </div>
                  ))}
                </div>
              )}

              {exercises.length === 0 && (
                <div className="bc-empty py-6">
                  <p className="bc-empty-title">No exercises added yet.</p>
                  <p className="bc-empty-text">Search and add exercises above.</p>
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
                <textarea value={liftNotes} onChange={e => setLiftNotes(e.target.value)}
                  placeholder="Session notes..." rows={2} className="bc-input resize-none placeholder:text-tertiary" />
              </div>
            </div>
          )}

          {/* ════════════ CARDIO FIELDS ════════════ */}
          {workoutType === 'cardio' && (
            <div className="space-y-4">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Activity</label>
                <select value={cardioType} onChange={e => setCardioType(e.target.value)} className="bc-input cursor-pointer">
                  {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">
                  Duration (minutes)
                  {timerSeconds > 0 && <span className="ml-1 text-bc-green-dark">(auto from timer)</span>}
                </label>
                <input type="number" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)}
                  placeholder="30"
                  className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Avg Heart Rate</label>
                  <input type="number" value={heartRate} onChange={e => setHeartRate(e.target.value)} placeholder="—"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">
                    Calories Burned
                    {timerSeconds > 0 && <span className="ml-1 text-bc-green-dark">✓</span>}
                  </label>
                  <input type="number" value={cardioCalories} onChange={e => setCardioCalories(e.target.value)} placeholder="Auto from timer"
                    className="bc-input bc-data [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setCardioRpe(n === cardioRpe ? '' : n)}
                      className={`flex-1 py-2 text-sm rounded-[10px] transition-colors bc-data
                        ${Number(cardioRpe) === n ? rpeColor(n) : 'bg-canvas text-secondary hover:text-primary'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea value={cardioNotes} onChange={e => setCardioNotes(e.target.value)}
                  placeholder="Session notes..." rows={2} className="bc-input resize-none placeholder:text-tertiary" />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-3 border-t border-border flex gap-3 flex-shrink-0" style={{ paddingBottom: 'max(20px, calc(12px + env(safe-area-inset-bottom)))' }}>
          <button onClick={handleSave} className="bc-btn-primary flex-1 py-3 text-sm">
            {isEditing ? 'Save Changes' : 'Log Workout'}
          </button>
          <button onClick={onClose}
            className="px-6 py-3 bg-canvas text-secondary text-sm font-medium rounded-[10px] hover:text-primary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}