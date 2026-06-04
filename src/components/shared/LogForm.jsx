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
import WorkoutTemplates from '@/components/shared/WorkoutTemplates';
import { comparePaces } from '@/utils/runUtils';
import { calculateLiftVolume } from '@/data/types';
import { shouldShowPostWorkoutPrompt } from '@/utils/nutrition';
import PostWorkoutPrompt from '@/components/shared/PostWorkoutPrompt';
import { useWorkouts } from '@/lib/WorkoutContext';
import { useAuth } from '@/lib/auth';
import { saveWorkoutTemplate } from '@/lib/database';
import {
  Footprints, Dumbbell, Bike, Play, ChevronRight,
  Check, RotateCcw, X, Plus, Minus, ChevronDown, ChevronUp,
  Timer, Flame, Layers,
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
  const { user } = useAuth();

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

  // ── Template state ──
  const [showTemplates,    setShowTemplates]    = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName,     setTemplateName]     = useState('');

  // ── Active lift state ──
  const [activeExIdx,      setActiveExIdx]      = useState(0);
  const [restTimer,        setRestTimer]        = useState(null);
  const [restPreset,       setRestPreset]       = useState(90);
  const [showAddExercise,  setShowAddExercise]  = useState(false);
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
    setSavedWorkout(saved);
    if (workoutType === 'lift' && exercises.length > 0 && !isEditing) {
      setTemplateName(sessionName || 'My Workout');
      setShowSaveTemplate(true);
    } else if (shouldShowPostWorkoutPrompt(saved)) {
      setShowPostPrompt(true);
    } else {
      onClose();
    }
  }

  async function handleSaveTemplateAndContinue(shouldSave) {
    if (shouldSave && user) {
      const template = {
        id:        `tpl-${Date.now()}`,
        name:      templateName.trim() || sessionName || 'My Workout',
        exercises: exercises.map(ex => ({
          name:        ex.name,
          muscleGroup: ex.muscleGroup || '',
          equipment:   ex.equipment   || '',
          defaultSets: Array.isArray(ex.sets) ? ex.sets.length : 3,
          defaultReps: '8-10',
        })),
        createdAt: new Date().toISOString(),
        lastUsed:  null,
        useCount:  0,
      };
      await saveWorkoutTemplate(user.id, template);
    }
    setShowSaveTemplate(false);
    if (savedWorkout && shouldShowPostWorkoutPrompt(savedWorkout)) {
      setShowPostPrompt(true);
    } else {
      onClose();
    }
  }

  function handleLoadTemplate(exercises, name) {
    if (exercises.length > 0) {
      const loaded = exercises.map(ex => {
        const lastData = getLastExerciseData(allWorkouts, ex.name);
        return {
          name:        ex.name,
          muscleGroup: ex.muscleGroup || '',
          equipment:   ex.equipment   || '',
          sets:        buildInitialSets(ex.defaultSets || 3, lastData),
          lastData,
        };
      });
      setExercises(loaded);
      if (name) {
        setSessionName(name);
      } else if (!sessionName) {
        const groups = [...new Set(loaded.map(e => e.muscleGroup).filter(Boolean))];
        setSessionName(groups.join(' / '));
      }
    }
    setShowTemplates(false);
  }

  // ══════════════════════════════════════════════
  // POST WORKOUT PROMPT
  // ══════════════════════════════════════════════
  if (showPostPrompt && savedWorkout) {
    return <PostWorkoutPrompt workout={savedWorkout} userWeight={userWeight} onDismiss={() => { setShowPostPrompt(false); onClose(); }} />;
  }

  // ══════════════════════════════════════════════
  // SAVE AS TEMPLATE PROMPT (post-lift)
  // ══════════════════════════════════════════════
  if (showSaveTemplate) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
        onClick={() => handleSaveTemplateAndContinue(false)}>
        <div className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl max-w-lg w-full p-5 flex flex-col gap-4"
          style={{ marginBottom: '80px' }}
          onClick={e => e.stopPropagation()}>
          <div>
            <h3 className="text-[17px] font-semibold text-primary">Save as template?</h3>
            <p className="text-sm text-secondary mt-1">Load this workout plan in one tap next time.</p>
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Template name</label>
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
              className="bc-input" style={{ fontSize: '16px' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSaveTemplateAndContinue(true)} className="bc-btn-primary flex-1 py-3 text-sm">
              Save template
            </button>
            <button onClick={() => handleSaveTemplateAndContinue(false)}
              className="px-6 py-3 bg-canvas text-secondary text-sm font-medium rounded-[12px] hover:text-primary transition-colors">
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // TEMPLATE BROWSER
  // ══════════════════════════════════════════════
  if (showTemplates) {
    return (
      <WorkoutTemplates
        userId={user?.id}
        onLoad={handleLoadTemplate}
        onClose={() => setShowTemplates(false)}
      />
    );
  }

  // ══════════════════════════════════════════════
  // FULL-SCREEN TIMER
  // ══════════════════════════════════════════════
  if (showTimer) {
    return <WorkoutTimer workoutType={workoutType} userWeight={userWeight} onStop={handleTimerStop} />;
  }

  // ══════════════════════════════════════════════
  // ACTIVE LIFT MODE — scrollable stacked exercise cards
  // All exercises visible at once, no dots/pagination.
  // User scrolls through the full workout like the KPI card stack.
  // Each exercise card shows: name, prev best, compact set table.
  // ══════════════════════════════════════════════
  if (mode === 'active' && workoutType === 'lift') {
    const restRemaining = restTimer ? restTimer.total - restTimer.elapsed : 0;
    const totalSetsCompleted = exercises.reduce((s, ex) =>
      s + (Array.isArray(ex.sets) ? ex.sets : []).filter(s => s.completed).length, 0);
    const totalSetsAll = exercises.reduce((s, ex) =>
      s + (Array.isArray(ex.sets) ? ex.sets : []).length, 0);
    const allDone = totalSetsAll > 0 && totalSetsCompleted === totalSetsAll;

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* ── Sticky top bar: session name + elapsed timer ── */}
        <div className="flex items-center justify-between px-4 border-b border-border flex-shrink-0"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 12 }}>
          <button onClick={() => setMode('setup')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary active:text-primary">
            <X size={20} />
          </button>
          <div className="text-center flex-1 min-w-0 px-2">
            <p className="text-sm font-bold text-primary truncate">{sessionName || 'Workout'}</p>
            <p className="text-[10px] text-tertiary">
              {totalSetsCompleted}/{totalSetsAll} sets · {exercises.length} exercises
            </p>
          </div>
          <button onClick={() => setShowTimer(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-lift-bg rounded-[10px]">
              <Timer size={12} className="text-lift-accent" />
              <span className="text-[11px] font-bold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {timerSeconds > 0 ? formatTime(timerSeconds) : '--:--'}
              </span>
            </div>
          </button>
        </div>

        {/* ── Rest preset selector — always visible below header ── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-canvas/60 flex-shrink-0">
          <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider flex-shrink-0 w-7">Rest</span>
          {[60, 90, 120, 180].map(s => (
            <button key={s} onClick={() => setRestPreset(s)}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-colors"
              style={{
                background: restPreset === s ? '#007AFF' : '#F2F2F7',
                color:      restPreset === s ? '#fff' : '#3C3C43',
              }}>
              {s}s
            </button>
          ))}
        </div>

        {/* ── Rest timer countdown — appears when rest is active ── */}
        {restTimer && restRemaining > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-bc-blue/20 bg-lift-bg/70 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-lift-accent" />
              <span className="text-sm font-semibold text-lift-accent">Rest</span>
            </div>
            <span className="text-xl font-bold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(restRemaining)}
            </span>
            <button onClick={() => { clearInterval(restIntervalRef.current); setRestTimer(null); }}
              className="text-xs text-tertiary px-3 py-1.5 rounded-[8px] bg-white/60 min-h-[32px]">
              Skip
            </button>
          </div>
        )}

        {/* ── Scrollable exercise cards ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {exercises.map((ex, exIdx) => {
            const exSets    = Array.isArray(ex.sets) ? ex.sets : [];
            const hist      = exerciseHistory[ex.name];
            const doneCount = exSets.filter(s => s.completed).length;
            const allExDone = exSets.length > 0 && doneCount === exSets.length;
            const nextSetIdx = exSets.findIndex(s => !s.completed);

            return (
              <ExerciseCard
                key={exIdx}
                ex={ex}
                exIdx={exIdx}
                exSets={exSets}
                hist={hist}
                doneCount={doneCount}
                allExDone={allExDone}
                nextSetIdx={nextSetIdx}
                onUpdateSet={updateSet}
                onCompleteSet={(si) => { completeSet(exIdx, si); }}
                onAddSet={() => addSet(exIdx)}
                onRemoveSet={() => removeSet(exIdx)}
                restPreset={restPreset}
                setRestPreset={setRestPreset}
              />
            );
          })}

          {/* ── Load template shortcut when workout is empty ── */}
          {exercises.length === 0 && !showAddExercise && (
            <button onClick={() => setShowTemplates(true)}
              className="w-full py-3 border border-dashed border-bc-blue/40 rounded-[14px] text-sm text-bc-blue flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <Layers size={14} /> Load template
            </button>
          )}

          {/* ── Add exercise during active session ── */}
          {showAddExercise ? (
            <div className="bc-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-primary">Add Exercise</p>
                <button onClick={() => setShowAddExercise(false)}
                  className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary">
                  <X size={13}/>
                </button>
              </div>
              <ExerciseSearch
                onSelect={ex => { handleAddExercise(ex); setShowAddExercise(false); }}
                placeholder="Search exercises…"
                workoutHistory={allWorkouts}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAddExercise(true)}
              className="w-full py-3 border border-dashed border-border rounded-[14px] text-sm text-tertiary
                         hover:text-secondary hover:border-secondary transition-colors active:scale-95 flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add exercise
            </button>
          )}
        </div>

        {/* ── Sticky bottom bar: volume + Finish ── */}
        <div className="border-t border-border px-4 pt-3 flex items-center gap-3 flex-shrink-0"
          style={{ paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom)))' }}>
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-lift-bg rounded-[12px]">
            <Flame size={14} className="text-lift-accent flex-shrink-0" />
            <span className="text-xs font-bold text-lift-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {(() => {
                const completedVol = liveVolume.total;
                const volLabel = liveVolume.sets > 0
                  ? `${liveVolume.sets} done · ${completedVol.toLocaleString()} lbs`
                  : totalSetsAll > 0 ? `${totalSetsAll} sets planned` : '0 sets';
                return volLabel;
              })()}
            </span>
          </div>
          {/* Finish — secondary style, requires explicit intent */}
          <button onClick={handleSave}
            className="px-4 py-2.5 rounded-[12px] text-sm font-semibold border transition-colors active:scale-95"
            style={{
              background: 'transparent',
              borderColor: allDone ? '#34C759' : '#C7C7CC',
              color: allDone ? '#34C759' : '#8E8E93',
            }}>
            {allDone ? '✓ Finish' : 'End workout'}
          </button>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="bc-caption uppercase tracking-wider">Add Exercise</label>
                  <button onClick={() => setShowTemplates(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-bc-blue min-h-[32px] px-1">
                    <Layers size={12} /> Templates
                  </button>
                </div>
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

// ══════════════════════════════════════════════════════════════
// ExerciseCard — one card per exercise in active workout mode.
//
// Layout matches KPI card stack pattern:
//   ┌─────────────────────────────────────────┐
//   │ Exercise name          Done 2/3  ▼/▲   │
//   │ Last: 185 × 5  →  try 190 lbs          │
//   ├─────────────────────────────────────────┤
//   │ SET  PREV        LBS          REPS   ✓  │
//   │  1   185×5    [ 190  ]    [  5  ]   ✓  │
//   │  2   185×5    [ 190  ]    [  5  ]   ·  │
//   │  3   185×5    [     ]    [     ]   ·  │
//   ├──────────────────┬──────────────────────┤
//   │  + Add Set       │  − Remove            │
//   └──────────────────┴──────────────────────┘
// ══════════════════════════════════════════════════════════════
function ExerciseCard({
  ex, exIdx, exSets, hist, doneCount, allExDone, nextSetIdx,
  onUpdateSet, onCompleteSet, onAddSet, onRemoveSet,
  restPreset, setRestPreset,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const borderColor = allExDone ? '#34C759' : doneCount > 0 ? '#007AFF' : '#E5E5EA';
  const headerBg    = allExDone ? '#F0FFF4' : 'white';

  return (
    <div className="rounded-[16px] border-2 overflow-hidden bg-white shadow-sm"
      style={{ borderColor }}>

      {/* ── Card header ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: headerBg }}
        onClick={() => setCollapsed(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-primary truncate">{ex.name}</p>
            {allExDone && (
              <span className="text-[10px] font-bold text-bc-green-dark px-1.5 py-0.5 bg-bc-green-light rounded-full flex-shrink-0">
                ✓ Done
              </span>
            )}
            {!allExDone && doneCount > 0 && (
              <span className="text-[10px] text-bc-blue font-semibold flex-shrink-0">
                {doneCount}/{exSets.length}
              </span>
            )}
          </div>
          {/* Previous best + suggestion */}
          {hist && (
            <p className="text-[10px] text-tertiary mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Last: {hist.weight} lbs × {hist.reps}
              {hist.suggestedWeight > hist.weight && (
                <span className="text-bc-green-dark font-semibold ml-1">→ try {hist.suggestedWeight} lbs</span>
              )}
            </p>
          )}
        </div>
        <div className="ml-2 flex-shrink-0 text-tertiary">
          {collapsed
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
          }
        </div>
      </button>

      {!collapsed && (
        <>
          {/* ── Column headers ── */}
          <div className="flex items-center px-4 py-1.5 bg-canvas/60 border-t border-border/40">
            <div className="w-7 flex-shrink-0"/>
            <div className="w-[80px] flex-shrink-0 text-center">
              <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider">Prev</span>
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider">Lbs</span>
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider">Reps</span>
            </div>
            <div className="w-11 flex-shrink-0"/>
          </div>

          {/* ── Set rows ── */}
          <div className="divide-y divide-border/30">
            {exSets.map((set, si) => {
              const isNext = si === nextSetIdx;
              const prevSets = hist?.completedSets || [];
              const prevLabel = prevSets[si]
                ? `${prevSets[si].weight}×${prevSets[si].reps}`
                : (hist?.weight && hist?.reps ? `${hist.weight}×${hist.reps}` : '—');

              return (
                <div key={si}
                  className={`flex items-center px-4 py-2.5 transition-colors ${
                    set.completed ? 'bg-bc-green-light/30' :
                    isNext ? 'bg-bc-blue-light/20' : 'bg-white'
                  }`}>

                  {/* Set number */}
                  <div className="w-7 flex-shrink-0">
                    <span className={`text-sm font-bold ${
                      set.completed ? 'text-bc-green-dark' :
                      isNext ? 'text-bc-blue' : 'text-tertiary'
                    }`}>{si + 1}</span>
                  </div>

                  {/* Prev */}
                  <div className="w-[80px] flex-shrink-0 text-center">
                    <span className="text-[11px] text-tertiary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {prevLabel}
                    </span>
                  </div>

                  {/* Weight input — full width, tap to type */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="number" inputMode="decimal"
                      value={set.weight ?? ''}
                      onChange={e => onUpdateSet(exIdx, si, 'weight', e.target.value)}
                      placeholder={set.targetWeight ? String(set.targetWeight) : '0'}
                      className={`w-full text-center font-bold bg-transparent outline-none py-1 ${
                        set.completed ? 'text-bc-green-dark' : 'text-primary'
                      }`}
                      style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
                    />
                  </div>

                  {/* Reps input — full width, tap to type */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="number" inputMode="numeric"
                      value={set.reps ?? ''}
                      onChange={e => onUpdateSet(exIdx, si, 'reps', e.target.value)}
                      placeholder={set.targetReps ? String(set.targetReps) : '0'}
                      className={`w-full text-center font-bold bg-transparent outline-none py-1 ${
                        set.completed ? 'text-bc-green-dark' : 'text-primary'
                      }`}
                      style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
                    />
                  </div>

                  {/* Complete checkmark */}
                  <div className="w-11 flex-shrink-0 flex justify-end">
                    <button
                      onClick={() => onCompleteSet(si)}
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center active:scale-90 transition-transform"
                      style={{ background: set.completed ? '#34C759' : '#F2F2F7' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke={set.completed ? '#fff' : '#AEAEB2'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Add / Remove set + Rest preset ── */}
          <div className="px-4 py-3 border-t border-border/40 bg-canvas/40 space-y-2.5">
            <div className="flex gap-2">
              <button onClick={onAddSet}
                className="flex-1 py-2 text-xs font-semibold text-secondary rounded-[10px] border border-border bg-white active:bg-canvas flex items-center justify-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add set
              </button>
              {exSets.length > 1 && (
                <button onClick={onRemoveSet}
                  className="px-4 py-2 text-xs font-semibold text-tertiary rounded-[10px] border border-border bg-white active:text-bc-red flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Remove
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}