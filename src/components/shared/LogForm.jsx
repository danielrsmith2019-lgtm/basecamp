'use client';

/**
 * LogForm v2 — Active workout logger.
 *
 * Two modes:
 *   SETUP mode  — before workout starts: pick type, add exercises, review plan
 *   ACTIVE mode — during workout: set-by-set flow, rest timer, prefilled weights
 *
 * Key features:
 *   - Timer survives tab switches (wall-clock based)
 *   - Prefilled weights/reps from last workout history
 *   - Progressive overload suggestions (+2.5% shown as ghost text)
 *   - Rest timer auto-starts between sets
 *   - One-tap set completion on mobile
 *   - Live volume total updates as sets complete
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ExerciseSearch from '@/components/lifting/ExerciseSearch';
import WorkoutTimer, { formatTime, estimateCalories } from '@/components/shared/WorkoutTimer';
import { comparePaces } from '@/utils/runUtils';
import { calculateLiftVolume } from '@/data/types';
import { shouldShowPostWorkoutPrompt } from '@/utils/nutrition';
import PostWorkoutPrompt from '@/components/shared/PostWorkoutPrompt';
import { useWorkouts } from '@/lib/WorkoutContext';
import {
  Footprints, Dumbbell, Bike, Play, ChevronRight,
  Check, RotateCcw, X, Plus, Minus, ChevronDown, ChevronUp,
  Timer, Flame,
} from 'lucide-react';

// ── Constants ──
const RUN_TYPES   = ['Easy Run','Tempo','Intervals','Long Run','Race','Shakeout','Recovery','REST'];
const CARDIO_TYPES = ['Cycling','Swimming','Rowing','Elliptical','Stair Climber','Walking','Hiking','Jump Rope','Other'];
const TYPE_TABS   = [{ key: 'run', label: 'Run', Icon: Footprints }, { key: 'lift', label: 'Lift', Icon: Dumbbell }, { key: 'cardio', label: 'Cardio', Icon: Bike }];
const TAB_COLOR   = { run: '#34C759', lift: '#007AFF', cardio: '#FF9500' };
const REST_PRESETS = [60, 90, 120, 180]; // seconds

// ── Helpers ──
function paceFromDistTime(distMi, mins, secs) {
  const d = parseFloat(distMi);
  const m = parseInt(mins) || 0;
  const s = parseInt(secs) || 0;
  if (!d || (m === 0 && s === 0)) return null;
  const pace    = (m + s / 60) / d;
  const paceMin = Math.floor(pace);
  const paceSec = Math.round((pace - paceMin) * 60);
  return `${paceMin}:${paceSec.toString().padStart(2,'0')}`;
}

function rpeColor(n) {
  if (n <= 4) return { bg: '#E8F5E9', text: '#2E7D32' };
  if (n <= 7) return { bg: '#FFF3E0', text: '#E65100' };
  return { bg: '#FFEBEE', text: '#C62828' };
}

// Look up last session for this exercise name from workout history
function getLastExerciseData(workouts, exerciseName) {
  const name = exerciseName?.toLowerCase().trim();
  if (!name) return null;

  for (const w of [...workouts].sort((a, b) => b.date.localeCompare(a.date))) {
    if (w.type !== 'lift' || w.status !== 'completed') continue;
    const ex = (w.details?.exercises || []).find(e => e.name?.toLowerCase().trim() === name);
    if (!ex) continue;

    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const completedSets = sets.filter(s => s.completed && s.weight && s.reps);
    if (completedSets.length === 0) continue;

    const avgWeight = completedSets.reduce((s, set) => s + Number(set.weight), 0) / completedSets.length;
    const avgReps   = completedSets.reduce((s, set) => s + Number(set.reps),   0) / completedSets.length;

    return {
      date:         w.date,
      weight:       Math.round(avgWeight),
      reps:         Math.round(avgReps),
      sets:         completedSets.length,
      completedSets, // per-set history for PREV column
      // Progressive overload: +2.5% rounded to nearest 2.5
      suggestedWeight: Math.round((avgWeight * 1.025) / 2.5) * 2.5,
    };
  }
  return null;
}

// Build initial sets for an exercise, prefilled from history
function buildInitialSets(count, lastData) {
  return Array.from({ length: count }, (_, i) => ({
    setNumber:    i + 1,
    weight:       lastData?.weight     || null,
    reps:         lastData?.reps       || null,
    targetWeight: lastData?.suggestedWeight || null,
    targetReps:   lastData?.reps       || null,
    rpe:          null,
    completed:    false,
  }));
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function LogForm({ workout, onSave, onClose, userWeight = 170 }) {
  const { workouts: allWorkouts } = useWorkouts();

  const initialType = workout?.type || 'run';
  const isEditing   = workout?.status === 'completed';
  const isLogging   = workout?.status === 'planned';
  const isNew       = !workout;

  // ── Mode: 'setup' | 'active' ──
  const [mode, setMode] = useState('setup');

  // ── Type ──
  const [workoutType, setWorkoutType] = useState(initialType);
  const accentColor = TAB_COLOR[workoutType] || '#007AFF';

  // ── Timer ──
  const [showTimer,    setShowTimer]    = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // ── Post-workout ──
  const [savedWorkout,   setSavedWorkout]   = useState(null);
  const [showPostPrompt, setShowPostPrompt] = useState(false);

  // ── Run state ──
  const [runType,     setRunType]     = useState(workout?.details?.runType || 'Easy Run');
  const [distance,    setDistance]    = useState(isEditing ? (workout?.details?.actualDistance ?? '') : (workout?.details?.plannedDistance ?? ''));
  const [timeMin,     setTimeMin]     = useState(() => {
    const t = workout?.details?.actualTime;
    if (!t) return '';
    const p = t.split(':');
    return p.length === 3 ? String(parseInt(p[0]) * 60 + parseInt(p[1])) : p[0];
  });
  const [timeSec,     setTimeSec]     = useState(() => {
    const t = workout?.details?.actualTime;
    if (!t) return '';
    const p = t.split(':');
    return p[p.length - 1];
  });
  const [runRpe,      setRunRpe]      = useState(workout?.details?.rpe            ?? '');
  const [runNotes,    setRunNotes]    = useState(workout?.details?.notes          ?? '');
  const [runCalories, setRunCalories] = useState(workout?.details?.caloriesBurned ?? '');

  // ── Lift state ──
  const [sessionName,  setSessionName]  = useState(workout?.details?.sessionName || '');
  const [exercises,    setExercises]    = useState(() => {
    // Normalize plan-format exercises to set-array format immediately
    // Plan format: { name, sets: 3, reps: "5" }
    // Active format: { name, sets: [{weight, reps, completed}] }
    const existing = workout?.details?.exercises || [];
    return existing.map(ex => {
      // Already in set-array format
      if (Array.isArray(ex.sets)) return ex;
      // Convert plan format — no history at init time, weight/reps filled by useEffect below
      const setCount = parseInt(ex.sets) || 3;
      const targetReps = ex.reps || null;
      return {
        ...ex,
        sets: Array.from({ length: setCount }, (_, i) => ({
          setNumber: i + 1,
          weight: null,
          reps: typeof targetReps === 'string' ? parseInt(targetReps) || null : targetReps,
          targetWeight: null,
          targetReps: typeof targetReps === 'string' ? parseInt(targetReps) || null : targetReps,
          rpe: null,
          completed: false,
        })),
        _needsHistoryPrefill: true,  // flag for useEffect below
      };
    });
  });
  const [liftNotes,    setLiftNotes]    = useState(workout?.details?.notes         ?? '');
  const [liftDuration, setLiftDuration] = useState(workout?.details?.duration ? String(workout.details.duration) : '');
  const [liftCalories, setLiftCalories] = useState(workout?.details?.caloriesBurned ?? '');

  // ── Active lift state ──
  const [activeExIdx,   setActiveExIdx]   = useState(0);  // which exercise is focused
  const [restTimer,     setRestTimer]     = useState(null); // null | { seconds, elapsed }
  const [restPreset,    setRestPreset]    = useState(90);
  const restIntervalRef = useRef(null);

  // ── Cardio state ──
  const [cardioType,     setCardioType]     = useState(workout?.details?.activityType || 'Cycling');
  const [cardioDuration, setCardioDuration] = useState(workout?.details?.duration ? String(workout.details.duration) : '');
  const [heartRate,      setHeartRate]      = useState(workout?.details?.heartRate      ?? '');
  const [cardioCalories, setCardioCalories] = useState(workout?.details?.caloriesBurned ?? '');
  const [cardioRpe,      setCardioRpe]      = useState(workout?.details?.rpe            ?? '');
  const [cardioNotes,    setCardioNotes]    = useState(workout?.details?.notes          ?? '');

  // ── Shared ──
  const [date, setDate] = useState(workout?.date || new Date().toLocaleDateString('en-CA'));

  // ── Computed ──
  const livePace = useMemo(() => paceFromDistTime(distance, timeMin, timeSec), [distance, timeMin, timeSec]);

  const liveVolume = useMemo(() => {
    let total = 0, sets = 0;
    exercises.forEach(ex => {
      (Array.isArray(ex.sets) ? ex.sets : []).forEach(s => {
        if (s.completed && s.weight && s.reps) {
          total += Number(s.weight) * Number(s.reps);
          sets++;
        }
      });
    });
    return { total, sets };
  }, [exercises]);

  // ── History lookup per exercise ──
  const exerciseHistory = useMemo(() => {
    const map = {};
    exercises.forEach(ex => {
      map[ex.name] = getLastExerciseData(allWorkouts, ex.name);
    });
    return map;
  }, [exercises, allWorkouts]);

  // ── Prefill history weights once allWorkouts loads ──
  // Exercises converted from plan format start with null weights.
  // Once the workout history is available, fill in previous weight/reps
  // and the progressive overload suggestion.
  useEffect(() => {
    if (!allWorkouts?.length) return;
    setExercises(prev => prev.map(ex => {
      if (!ex._needsHistoryPrefill) return ex;
      const hist = getLastExerciseData(allWorkouts, ex.name);
      return {
        ...ex,
        _needsHistoryPrefill: false,
        lastData: hist,
        sets: (Array.isArray(ex.sets) ? ex.sets : []).map(s => ({
          ...s,
          weight:       hist?.weight       ?? s.weight,
          targetWeight: hist?.suggestedWeight ?? s.targetWeight,
          reps:         s.reps ?? hist?.reps ?? null,
          targetReps:   s.targetReps ?? hist?.reps ?? null,
        })),
      };
    }));
  }, [allWorkouts]);

  // ── Rest timer ──
  function startRestTimer(seconds) {
    clearInterval(restIntervalRef.current);
    setRestTimer({ total: seconds, elapsed: 0 });
    restIntervalRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        if (prev.elapsed >= prev.total) {
          clearInterval(restIntervalRef.current);
          return null; // done
        }
        return { ...prev, elapsed: prev.elapsed + 1 };
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(restIntervalRef.current), []);

  // ── Exercise management ──
  function handleAddExercise(exercise) {
    const lastData = getLastExerciseData(allWorkouts, exercise.name);
    const newEx = {
      name:        exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment:   exercise.equipment,
      sets:        buildInitialSets(3, lastData),
      lastData,
    };
    setExercises(prev => {
      const next = [...prev, newEx];
      if (!sessionName) {
        const groups = [...new Set(next.map(e => e.muscleGroup).filter(Boolean))];
        setSessionName(groups.join(' / '));
      }
      return next;
    });
  }

  function handleRemoveExercise(i) {
    setExercises(prev => prev.filter((_, idx) => idx !== i));
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      const last = sets[sets.length - 1];
      return {
        ...ex,
        sets: [...sets, {
          setNumber:    sets.length + 1,
          weight:       last?.weight       || null,
          reps:         last?.reps         || null,
          targetWeight: last?.targetWeight || null,
          targetReps:   last?.targetReps   || null,
          rpe:          null,
          completed:    false,
        }],
      };
    }));
  }

  function removeSet(exIdx) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      if (sets.length <= 1) return ex;
      return { ...ex, sets: sets.slice(0, -1) };
    }));
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = [...(Array.isArray(ex.sets) ? ex.sets : [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...ex, sets };
    }));
  }

  function completeSet(exIdx, setIdx) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = [...(Array.isArray(ex.sets) ? ex.sets : [])];
      const s = sets[setIdx];
      const isCompleting = !s.completed;
      sets[setIdx] = { ...s, completed: isCompleting };
      return { ...ex, sets };
    }));
    // Auto-start rest timer when completing a set
    startRestTimer(restPreset);
  }

  // ── Timer callbacks ──
  function handleTimerStop(seconds, calories) {
    setTimerSeconds(seconds);
    setShowTimer(false);
    const mins = Math.round(seconds / 60);
    if (workoutType === 'run' && !timeMin && !timeSec && seconds > 0) {
      setTimeMin(String(Math.floor(seconds / 60)));
      setTimeSec(String(seconds % 60));
    }
    if (!runCalories && calories > 0 && workoutType === 'run')    setRunCalories(String(calories));
    if (!liftCalories && calories > 0 && workoutType === 'lift')  setLiftCalories(String(calories));
    if (!cardioCalories && calories > 0 && workoutType === 'cardio') setCardioCalories(String(calories));
    if (workoutType === 'lift' && !liftDuration && mins > 0) setLiftDuration(String(mins));
    if (workoutType === 'cardio' && !cardioDuration && mins > 0) setCardioDuration(String(mins));
  }

  // ── Save ──
  function handleSave() {
    let details = {};
    if (workoutType === 'run') {
      details = {
        ...(workout?.details || {}),
        runType,
        actualDistance:  parseFloat(distance) || null,
        actualTime:      timeMin || timeSec ? `${parseInt(timeMin)||0}:${(parseInt(timeSec)||0).toString().padStart(2,'0')}` : null,
        actualPace:      livePace,
        rpe:             runRpe ? parseInt(runRpe) : null,
        caloriesBurned:  runCalories ? parseInt(runCalories) : null,
        notes:           runNotes || null,
      };
    }
    if (workoutType === 'lift') {
      const { totalVolume, totalSets } = calculateLiftVolume(exercises);
      const muscleGroups = [...new Set(exercises.map(e => e.muscleGroup).filter(Boolean))];
      details = {
        sessionName:    sessionName || muscleGroups.join(' / ') || 'Workout',
        muscleGroups, exercises, totalVolume, totalSets,
        duration:       liftDuration ? parseInt(liftDuration) : null,
        caloriesBurned: liftCalories ? parseInt(liftCalories) : null,
        notes:          liftNotes || null,
      };
    }
    if (workoutType === 'cardio') {
      details = {
        activityType: cardioType,
        duration:     cardioDuration ? parseInt(cardioDuration) : null,
        heartRate:    heartRate ? parseInt(heartRate) : null,
        caloriesBurned: cardioCalories ? parseInt(cardioCalories) : null,
        rpe:          cardioRpe ? parseInt(cardioRpe) : null,
        notes:        cardioNotes || null,
      };
    }
    const saved = { id: workout?.id || null, date, type: workoutType, status: 'completed', planId: workout?.planId || null, details };
    onSave(saved);
    if (shouldShowPostWorkoutPrompt(saved)) {
      setSavedWorkout(saved); setShowPostPrompt(true);
    } else {
      onClose();
    }
  }

  // ══════════════════════════════════════════════
  // POST WORKOUT PROMPT
  // ══════════════════════════════════════════════
  if (showPostPrompt && savedWorkout) {
    return <PostWorkoutPrompt workout={savedWorkout} userWeight={userWeight} onDismiss={() => { setShowPostPrompt(false); onClose(); }} />;
  }

  // ══════════════════════════════════════════════
  // FULL-SCREEN TIMER
  // ══════════════════════════════════════════════
  if (showTimer) {
    return <WorkoutTimer workoutType={workoutType} userWeight={userWeight} onStop={handleTimerStop} />;
  }

  // ══════════════════════════════════════════════
  // ACTIVE LIFT MODE — full-screen set-by-set
  // ══════════════════════════════════════════════
  if (mode === 'active' && workoutType === 'lift') {
    const ex = exercises[activeExIdx];
    const sets = Array.isArray(ex?.sets) ? ex.sets : [];
    const completedSetsCount = sets.filter(s => s.completed).length;
    const totalExercises = exercises.length;
    const allSetsThisEx = completedSetsCount === sets.length;
    const restRemaining = restTimer ? restTimer.total - restTimer.elapsed : 0;
    const history = exerciseHistory[ex?.name];

    return (
      <div className="fixed inset-0 bg-surface z-50 flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <button onClick={() => setMode('setup')} className="flex items-center gap-1 text-tertiary text-sm min-h-[44px] min-w-[44px]">
            <X size={18} />
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold text-primary">{sessionName || 'Lifting'}</p>
            <p className="bc-caption">{activeExIdx + 1} of {totalExercises} exercises</p>
          </div>
          <button onClick={() => setShowTimer(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <div className="flex items-center gap-1 px-2 py-1 bg-lift-bg rounded-[8px]">
              <Timer size={12} className="text-lift-accent" />
              <span className="text-[11px] font-semibold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {timerSeconds > 0 ? formatTime(timerSeconds) : '--:--'}
              </span>
            </div>
          </button>
        </div>

        {/* ── Exercise progress dots ── */}
        <div className="flex items-center gap-1 px-4 py-1.5 flex-shrink-0">
          {exercises.map((e, i) => {
            const exSets = Array.isArray(e.sets) ? e.sets : [];
            const done = exSets.filter(s => s.completed).length;
            const total = exSets.length;
            return (
              <button key={i} onClick={() => setActiveExIdx(i)}
                className="flex-1 h-1 rounded-full transition-all min-h-[20px]"
                style={{ background: i === activeExIdx ? '#007AFF' : done === total && total > 0 ? '#34C759' : '#E5E5EA' }} />
            );
          })}
        </div>

        {/* ── Exercise name + history ── */}
        <div className="px-4 pt-1 pb-2 flex-shrink-0">
          <h2 className="text-lg font-bold text-primary leading-tight">{ex?.name}</h2>
          {history && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-tertiary">
                Last: <span className="font-semibold text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {history.weight} lbs × {history.reps}
                </span>
              </span>
              {history.suggestedWeight > history.weight && (
                <span className="text-[10px] px-2 py-0.5 bg-bc-green-light text-bc-green-dark rounded-full font-semibold">
                  Goal: {history.suggestedWeight} lbs ↑
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Rest timer banner ── */}
        {restTimer && restRemaining > 0 && (
          <div className="mx-4 mb-2 px-4 py-2 rounded-[12px] flex items-center justify-between flex-shrink-0"
            style={{ background: '#007AFF15', border: '1px solid #007AFF30' }}>
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-lift-accent" />
              <span className="text-sm font-semibold text-lift-accent">Rest</span>
            </div>
            <span className="text-lg font-bold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(restRemaining)}
            </span>
            <button onClick={() => { clearInterval(restIntervalRef.current); setRestTimer(null); }}
              className="text-[11px] text-tertiary hover:text-secondary">Skip</button>
          </div>
        )}

        {/* ── Sets ── */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2.5 pb-4">

          {/* Column headers — matches reference app layout */}
          <div className="flex items-center gap-2 px-1 mb-1">
            <div className="w-6 flex-shrink-0"/>
            <div className="w-20 flex-shrink-0 text-center">
              <span className="text-[9px] font-semibold text-tertiary uppercase tracking-wider">Prev</span>
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-semibold text-tertiary uppercase tracking-wider">Lbs</span>
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-semibold text-tertiary uppercase tracking-wider">Reps</span>
            </div>
            <div className="w-12 flex-shrink-0"/>
          </div>

          {sets.map((set, si) => {
            const isNext = !set.completed && si === sets.findIndex(s => !s.completed);
            // Prev: what was done in the last session for this set position
            const prevSets = history?.completedSets || [];
            const prevSet  = prevSets[si] || null;
            const prevLabel = prevSet
              ? `${prevSet.weight} × ${prevSet.reps}`
              : (history?.weight && history?.reps)
                ? `${history.weight} × ${history.reps}`
                : '—';

            return (
              <div key={si}
                className={`rounded-[14px] border transition-all ${
                  set.completed ? 'bg-bc-green-light/40 border-bc-green/30' :
                  isNext        ? 'bg-white border-bc-blue/40 shadow-sm' :
                                  'bg-canvas border-border/50'
                }`}>
                <div className="flex items-center gap-2 px-3 py-3">

                  {/* Set number */}
                  <div className="w-6 flex-shrink-0 text-center">
                    <span className={`text-sm font-bold ${
                      set.completed ? 'text-bc-green-dark' :
                      isNext ? 'text-bc-blue' : 'text-tertiary'
                    }`}>{si + 1}</span>
                  </div>

                  {/* Prev — grey, shows last session */}
                  <div className="w-20 flex-shrink-0 text-center">
                    <span className="text-[11px] text-tertiary" style={{fontVariantNumeric:'tabular-nums'}}>
                      {prevLabel}
                    </span>
                  </div>

                  {/* Weight */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={e => { e.preventDefault(); updateSet(activeExIdx, si, 'weight', Math.max(0, (Number(set.weight) || 0) - 2.5)); }}
                        className="w-8 h-8 rounded-[8px] bg-surface border border-border flex items-center justify-center flex-shrink-0 active:scale-90">
                        <Minus size={11} className="text-secondary" />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={set.weight ?? ''}
                        onChange={e => updateSet(activeExIdx, si, 'weight', e.target.value)}
                        placeholder={set.targetWeight ? String(set.targetWeight) : '0'}
                        className={`flex-1 text-center font-bold bg-transparent outline-none min-w-0 py-1 ${
                          set.completed ? 'text-bc-green-dark' : isNext ? 'text-primary' : 'text-secondary'
                        }`}
                        style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums' }}
                      />
                      <button
                        onPointerDown={e => { e.preventDefault(); updateSet(activeExIdx, si, 'weight', (Number(set.weight) || 0) + 2.5); }}
                        className="w-8 h-8 rounded-[8px] bg-surface border border-border flex items-center justify-center flex-shrink-0 active:scale-90">
                        <Plus size={11} className="text-secondary" />
                      </button>
                    </div>
                  </div>

                  {/* Reps */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={e => { e.preventDefault(); updateSet(activeExIdx, si, 'reps', Math.max(0, (Number(set.reps) || 0) - 1)); }}
                        className="w-8 h-8 rounded-[8px] bg-surface border border-border flex items-center justify-center flex-shrink-0 active:scale-90">
                        <Minus size={11} className="text-secondary" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps ?? ''}
                        onChange={e => updateSet(activeExIdx, si, 'reps', e.target.value)}
                        placeholder={set.targetReps ? String(set.targetReps) : '0'}
                        className={`flex-1 text-center font-bold bg-transparent outline-none min-w-0 py-1 ${
                          set.completed ? 'text-bc-green-dark' : isNext ? 'text-primary' : 'text-secondary'
                        }`}
                        style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums' }}
                      />
                      <button
                        onPointerDown={e => { e.preventDefault(); updateSet(activeExIdx, si, 'reps', (Number(set.reps) || 0) + 1); }}
                        className="w-8 h-8 rounded-[8px] bg-surface border border-border flex items-center justify-center flex-shrink-0 active:scale-90">
                        <Plus size={11} className="text-secondary" />
                      </button>
                    </div>
                  </div>

                  {/* Check — large tap target */}
                  <button
                    onClick={() => completeSet(activeExIdx, si)}
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                    style={{ background: set.completed ? '#34C759' : '#E5E5EA' }}>
                    <Check size={20} color={set.completed ? '#fff' : '#AEAEB2'} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add / remove set */}
          <div className="flex gap-2 pt-1">
            <button onClick={() => addSet(activeExIdx)}
              className="flex-1 py-2.5 border border-border rounded-[10px] text-xs font-semibold text-secondary active:bg-canvas flex items-center justify-center gap-1">
              <Plus size={12} /> Add Set
            </button>
            {sets.length > 1 && (
              <button onClick={() => removeSet(activeExIdx)}
                className="px-4 py-2.5 border border-border rounded-[10px] text-xs font-semibold text-tertiary active:text-bc-red flex items-center justify-center gap-1">
                <Minus size={12} /> Remove
              </button>
            )}
          </div>

          {/* Rest preset selector */}
          <div className="pt-1 pb-2">
            <p className="bc-caption uppercase tracking-wider mb-1.5">Rest timer</p>
            <div className="flex gap-2">
              {REST_PRESETS.map(s => (
                <button key={s} onClick={() => setRestPreset(s)}
                  className="flex-1 py-2 text-xs font-semibold rounded-[10px] transition-colors"
                  style={{ background: restPreset === s ? '#007AFF' : '#F2F2F7', color: restPreset === s ? '#fff' : '#3C3C43' }}>
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-border px-4 pt-3 flex gap-3 flex-shrink-0"
          style={{ paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom)))' }}>
          {/* Prev / Next exercise */}
          <button disabled={activeExIdx === 0}
            onClick={() => setActiveExIdx(i => i - 1)}
            className="w-11 h-11 rounded-[10px] bg-canvas border border-border flex items-center justify-center disabled:opacity-30">
            <ChevronDown size={18} className="text-secondary" />
          </button>

          {/* Live volume */}
          <div className="flex-1 flex items-center justify-center bg-lift-bg rounded-[10px] px-3">
            <Flame size={12} className="text-lift-accent mr-1" />
            <span className="text-xs font-semibold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {liveVolume.sets} sets · {liveVolume.total > 0 ? `${liveVolume.total.toLocaleString()} lbs` : '0 lbs'}
            </span>
          </div>

          {activeExIdx < totalExercises - 1 ? (
            <button onClick={() => setActiveExIdx(i => i + 1)}
              className="flex items-center gap-1.5 px-3 h-11 rounded-[10px] bg-canvas border border-border">
              <span className="text-xs font-semibold text-secondary truncate max-w-[80px]">
                {exercises[activeExIdx + 1]?.name?.split(' ')[0] || 'Next'}
              </span>
              <ChevronUp size={14} className="text-tertiary flex-shrink-0" />
            </button>
          ) : (
            <button onClick={handleSave}
              className="px-4 h-11 rounded-[10px] text-xs font-bold text-white flex items-center gap-1.5 active:scale-95"
              style={{ background: '#34C759' }}>
              <Check size={14} /> Finish
            </button>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // SETUP MODE (and non-lift active mode)
  // ══════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl max-w-lg w-full flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 80px)', marginBottom: '80px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-[17px] font-semibold text-primary">
              {isEditing ? 'Edit Workout' : isLogging ? 'Log Workout' : 'New Workout'}
            </h3>
            {timerSeconds > 0 && (
              <p className="bc-caption mt-0.5" style={{ color: accentColor }}>
                {formatTime(timerSeconds)} recorded
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTimer(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold min-h-[44px]"
              style={{ background: `${accentColor}15`, color: accentColor }}>
              <Timer size={14} />
              {timerSeconds > 0 ? formatTime(timerSeconds) : 'Timer'}
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Type tabs (only when new/editing) ── */}
        {(isNew || isEditing) && (
          <div className="flex border-b border-border flex-shrink-0">
            {TYPE_TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setWorkoutType(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors"
                style={{
                  color:       workoutType === key ? accentColor : '#8E8E93',
                  borderBottom: workoutType === key ? `2px solid ${accentColor}` : '2px solid transparent',
                }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Date ── */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bc-input text-sm w-full" />
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">

          {/* ════ RUN ════ */}
          {workoutType === 'run' && (
            <>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Run Type</label>
                <select value={runType} onChange={e => setRunType(e.target.value)} className="bc-input cursor-pointer">
                  {RUN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Distance (miles)</label>
                <input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)}
                  placeholder={workout?.details?.plannedDistance ? String(workout.details.plannedDistance) : '0.0'}
                  className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Time</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="number" value={timeMin} onChange={e => setTimeMin(e.target.value)} placeholder="0"
                      className="bc-input text-center pr-10" style={{ fontVariantNumeric: 'tabular-nums' }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">min</span>
                  </div>
                  <span className="text-xl text-tertiary font-bold">:</span>
                  <div className="flex-1 relative">
                    <input type="number" min="0" max="59" value={timeSec} onChange={e => setTimeSec(e.target.value)} placeholder="00"
                      className="bc-input text-center pr-10" style={{ fontVariantNumeric: 'tabular-nums' }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bc-caption">sec</span>
                  </div>
                </div>
              </div>
              {/* Live pace */}
              <div className="bg-run-bg rounded-[14px] p-4 text-center">
                <p className="bc-caption uppercase tracking-wider mb-1">Pace</p>
                <p className={`text-3xl font-bold ${livePace ? 'text-run-accent' : 'text-tertiary'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{livePace || '--:--'}</p>
                <p className="bc-caption mt-1">/mile</p>
                {livePace && workout?.details?.targetPace && (() => {
                  const c = comparePaces(livePace, workout.details.targetPace);
                  if (!c) return null;
                  return <div className="mt-2"><span className={`bc-pill text-sm ${c.color}`}>{c.label} vs target {workout.details.targetPace}</span></div>;
                })()}
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const c = rpeColor(n);
                    return (
                      <button key={n} onClick={() => setRunRpe(n === runRpe ? '' : n)}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-[10px] transition-colors"
                        style={{ background: Number(runRpe) === n ? c.bg : '#F2F2F7', color: Number(runRpe) === n ? c.text : '#8E8E93' }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea value={runNotes} onChange={e => setRunNotes(e.target.value)}
                  placeholder="How did it feel?" rows={2} className="bc-input resize-none" />
              </div>
            </>
          )}

          {/* ════ LIFT — SETUP MODE ════ */}
          {workoutType === 'lift' && (
            <>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Session Name</label>
                <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)}
                  placeholder="Push Day, Pull Day, Legs..." className="bc-input" />
              </div>

              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Add Exercise</label>
                <ExerciseSearch onSelect={handleAddExercise} placeholder="Search exercises..." workoutHistory={allWorkouts} />
              </div>

              {exercises.length > 0 && (
                <div className="space-y-2">
                  {exercises.map((ex, i) => {
                    const hist = exerciseHistory[ex.name];
                    const sets = Array.isArray(ex.sets) ? ex.sets : [];
                    return (
                      <div key={i} className="bg-canvas rounded-[14px] p-3 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-primary truncate">{ex.name}</p>
                            {hist && (
                              <p className="text-[10px] text-tertiary">
                                Last: {hist.weight} lbs × {hist.reps}
                                {hist.suggestedWeight > hist.weight && (
                                  <span className="text-bc-green-dark ml-1">→ try {hist.suggestedWeight} lbs</span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <button onClick={() => removeSet(i)} className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-tertiary">
                                <Minus size={10} />
                              </button>
                              <span className="text-xs font-semibold text-primary w-4 text-center">{sets.length}</span>
                              <button onClick={() => addSet(i)} className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-tertiary">
                                <Plus size={10} />
                              </button>
                              <span className="text-[10px] text-tertiary ml-1">sets</span>
                            </div>
                            <button onClick={() => handleRemoveExercise(i)}
                              className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-tertiary hover:text-bc-red">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        {/* Sets preview */}
                        <div className="flex gap-1 mt-1.5">
                          {sets.slice(0, 4).map((s, si) => (
                            <div key={si} className="flex-1 text-center py-1 bg-lift-bg rounded-[8px]">
                              <p className="text-[9px] text-lift-accent font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {s.weight || s.targetWeight || '—'} × {s.reps || s.targetReps || '—'}
                              </p>
                            </div>
                          ))}
                          {sets.length > 4 && <div className="flex-1 text-center py-1 bc-caption">+{sets.length-4}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {exercises.length === 0 && (
                <div className="bc-empty py-6">
                  <p className="bc-empty-title">No exercises yet</p>
                  <p className="bc-empty-text">Search and add exercises above</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Duration (min)</label>
                  <input type="number" value={liftDuration} onChange={e => setLiftDuration(e.target.value)}
                    placeholder="60" className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Calories</label>
                  <input type="number" value={liftCalories} onChange={e => setLiftCalories(e.target.value)}
                    placeholder="Auto from timer" className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea value={liftNotes} onChange={e => setLiftNotes(e.target.value)}
                  placeholder="Session notes..." rows={2} className="bc-input resize-none" />
              </div>
            </>
          )}

          {/* ════ CARDIO ════ */}
          {workoutType === 'cardio' && (
            <>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Activity</label>
                <select value={cardioType} onChange={e => setCardioType(e.target.value)} className="bc-input cursor-pointer">
                  {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Duration (minutes)</label>
                <input type="number" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)}
                  placeholder="30" className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Avg Heart Rate</label>
                  <input type="number" value={heartRate} onChange={e => setHeartRate(e.target.value)}
                    placeholder="—" className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Calories</label>
                  <input type="number" value={cardioCalories} onChange={e => setCardioCalories(e.target.value)}
                    placeholder="Auto from timer" className="bc-input" style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">RPE (1–10)</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const c = rpeColor(n);
                    return (
                      <button key={n} onClick={() => setCardioRpe(n === cardioRpe ? '' : n)}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-[10px] transition-colors"
                        style={{ background: Number(cardioRpe) === n ? c.bg : '#F2F2F7', color: Number(cardioRpe) === n ? c.text : '#8E8E93' }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea value={cardioNotes} onChange={e => setCardioNotes(e.target.value)}
                  placeholder="Session notes..." rows={2} className="bc-input resize-none" />
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-3 border-t border-border flex gap-3 flex-shrink-0"
          style={{ paddingBottom: 'max(20px, calc(12px + env(safe-area-inset-bottom)))' }}>

          {/* For lift in setup mode, show "Start Workout" if exercises exist */}
          {workoutType === 'lift' && exercises.length > 0 && !isEditing ? (
            <>
              <button onClick={() => setMode('active')}
                className="flex-1 py-3 text-sm font-semibold text-white rounded-[12px] flex items-center justify-center gap-2 active:scale-95 transition-all"
                style={{ background: accentColor }}>
                <Play size={16} fill="#fff" /> Start Workout
              </button>
              <button onClick={handleSave}
                className="px-5 py-3 bg-canvas text-secondary text-sm font-medium rounded-[12px] hover:text-primary transition-colors">
                Log Anyway
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSave} className="bc-btn-primary flex-1 py-3 text-sm">
                {isEditing ? 'Save Changes' : 'Log Workout'}
              </button>
              <button onClick={onClose}
                className="px-6 py-3 bg-canvas text-secondary text-sm font-medium rounded-[12px] hover:text-primary transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}