'use client';

import { useState, useMemo } from 'react';
import { useWorkouts } from '@/lib/WorkoutContext';
import { calculateTrainingLoad } from '@/utils/insights';
import {
  Sparkles, Footprints, Dumbbell, Bike, Activity, Zap,
  RefreshCw, Play, Clock, ChevronDown, ChevronUp, X,
  ClipboardList, Loader2,
} from 'lucide-react';

// ── Type options ─────────────────────────────────────────────
const WORKOUT_TYPES = [
  { id: 'run',        label: 'Run',        Icon: Footprints, accent: 'text-run-accent',    bg: 'bg-run-bg',          border: 'border-run-accent'    },
  { id: 'legs',       label: 'Legs',       Icon: Dumbbell,   accent: 'text-lift-accent',   bg: 'bg-lift-bg',         border: 'border-lift-accent'   },
  { id: 'upper_push', label: 'Upper Push', Icon: Activity,   accent: 'text-lift-accent',   bg: 'bg-lift-bg',         border: 'border-lift-accent'   },
  { id: 'upper_pull', label: 'Upper Pull', Icon: Activity,   accent: 'text-lift-accent',   bg: 'bg-lift-bg',         border: 'border-lift-accent'   },
  { id: 'full_body',  label: 'Full Body',  Icon: Dumbbell,   accent: 'text-lift-accent',   bg: 'bg-lift-bg',         border: 'border-lift-accent'   },
  { id: 'cardio',     label: 'Cardio',     Icon: Bike,       accent: 'text-cardio-accent', bg: 'bg-cardio-bg',       border: 'border-cardio-accent' },
  { id: 'surprise',   label: 'Surprise',   Icon: Zap,        accent: 'text-bc-indigo',     bg: 'bg-bc-indigo-light', border: 'border-bc-indigo'     },
];

const DURATIONS      = [20, 30, 45, 60, 75, 90];
const EQUIP_OPTIONS  = ['Full gym', 'Dumbbells', 'Barbell', 'Cables', 'Bodyweight'];
const LIFT_SUBTYPES  = new Set(['legs', 'upper_push', 'upper_pull', 'full_body']);
const SS_COLOR       = '#8B5CF6';

// ── Helpers ──────────────────────────────────────────────────
function daysAgoLabel(dateStr) {
  const n = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n}d ago`;
}

function typeIconConfig(workoutType) {
  if (workoutType === 'run')   return { Icon: Footprints, bg: 'bg-run-bg',    text: 'text-run-accent'    };
  if (workoutType === 'cardio') return { Icon: Bike,       bg: 'bg-cardio-bg', text: 'text-cardio-accent' };
  return                               { Icon: Dumbbell,   bg: 'bg-lift-bg',   text: 'text-lift-accent'   };
}

// ── Main component ───────────────────────────────────────────
export default function WorkoutGenerator({ onStartWorkout, onClose }) {
  const { workouts: allWorkouts } = useWorkouts();

  // ── Form state ──
  const [selType,      setSelType]      = useState(null);
  const [duration,     setDuration]     = useState(45);
  const [equipment,    setEquipment]    = useState(['Full gym']);
  const [intensity,    setIntensity]    = useState('Moderate');
  const [focusNote,    setFocusNote]    = useState('');

  // ── Generator state ──
  const [view,         setView]         = useState('input');   // 'input' | 'result'
  const [generating,   setGenerating]   = useState(false);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);

  // ── Result collapse state ──
  const [warmupOpen,   setWarmupOpen]   = useState(true);
  const [finisherOpen, setFinisherOpen] = useState(true);

  const isLiftType = selType !== null && LIFT_SUBTYPES.has(selType);

  // Recent AI-generated workouts (last 3)
  const recentGenerated = useMemo(() =>
    allWorkouts
      .filter(w => w.status === 'completed' && w.details?.isAIGenerated)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
  [allWorkouts]);

  // Context strings for the prompt
  const recentSummary = useMemo(() =>
    allWorkouts
      .filter(w => w.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(w => `${w.details?.sessionName || w.type} ${daysAgoLabel(w.date)}`)
      .join(', '),
  [allWorkouts]);

  const loadLevel = useMemo(() => {
    try {
      const load = calculateTrainingLoad(allWorkouts);
      return load.current > load.previous * 1.2 ? 'High'
           : load.current > load.previous * 0.8 ? 'Moderate'
           : 'Low';
    } catch { return 'Moderate'; }
  }, [allWorkouts]);

  // ── Equipment toggle ──────────────────────────────────────
  function toggleEquipment(eq) {
    if (eq === 'Full gym') { setEquipment(['Full gym']); return; }
    setEquipment(prev => {
      const cleaned = prev.filter(e => e !== 'Full gym' && e !== eq);
      return prev.includes(eq)
        ? (cleaned.length ? cleaned : ['Full gym'])
        : [...cleaned, eq];
    });
  }

  // ── Generate ─────────────────────────────────────────────
  async function handleGenerate() {
    if (!selType) return;
    setGenerating(true);
    setError(null);
    try {
      const apiType =
        selType === 'run'     ? 'run'     :
        selType === 'cardio'  ? 'cardio'  :
        selType === 'surprise'? 'surprise':
        'lift';

      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutType: apiType,
          subtype:     isLiftType ? selType : null,
          duration,
          equipment:   equipment.includes('Full gym') ? ['Full gym'] : equipment,
          intensity,
          focusNote:   focusNote.trim(),
          recentSummary,
          loadLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      setResult(data);
      setView('result');
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ── Convert API result → LogForm workout ─────────────────
  function buildWorkout(forceType) {
    if (!result) return null;
    const wt = forceType || result.workoutType;

    if (wt === 'run') {
      return {
        id: null, date: new Date().toLocaleDateString('en-CA'),
        type: 'run', status: 'planned',
        details: {
          runType:          result.runType || 'Easy Run',
          plannedDistance:  result.estimatedDistance || null,
          isAIGenerated:    true,
        },
      };
    }
    if (wt === 'cardio') {
      return {
        id: null, date: new Date().toLocaleDateString('en-CA'),
        type: 'cardio', status: 'planned',
        details: {
          activityType:  result.activityType || 'Cycling',
          duration:      result.estimatedDuration || null,
          isAIGenerated: true,
        },
      };
    }
    // Lift — flatten sections → exercises array
    const exercises = (result.sections || []).flatMap(section =>
      (section.exercises || []).map(ex => {
        const setCount   = typeof ex.sets === 'number' ? ex.sets : parseInt(ex.sets) || 3;
        const targetReps = parseInt(String(ex.reps || '')) || null;
        return {
          name:          ex.name,
          muscleGroup:   ex.muscleGroup || '',
          equipment:     ex.equipment   || '',
          coachingNote:  ex.note        || null,
          supersetWith:  ex.supersetWith || null,
          sets: Array.from({ length: setCount }, (_, i) => ({
            setNumber: i + 1, weight: null,
            reps: targetReps, targetReps,
            targetWeight: null, rpe: null, completed: false,
          })),
        };
      })
    );
    return {
      id: null, date: new Date().toLocaleDateString('en-CA'),
      type: 'lift', status: 'planned',
      details: {
        sessionName:   result.sessionName || 'AI Workout',
        muscleGroups:  result.muscleGroups || [],
        exercises,
        isAIGenerated: true,
      },
    };
  }

  function handleStartWorkout()   { const w = buildWorkout(); if (w) onStartWorkout(w); }

  function handleLoadAgain(workout) {
    onStartWorkout({
      ...workout,
      id: null,
      date: new Date().toLocaleDateString('en-CA'),
      status: 'planned',
    });
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl max-w-lg w-full flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 80px)', marginBottom: '80px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-bc-indigo" />
            <h3 className="text-[17px] font-semibold text-primary">Generate Workout</h3>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary">
            <X size={16} />
          </button>
        </div>

        {/* ════════════════════════════════════════
            INPUT VIEW
        ════════════════════════════════════════ */}
        {view === 'input' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Workout type grid */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-2">Workout Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKOUT_TYPES.map(opt => {
                    const active = selType === opt.id;
                    return (
                      <button key={opt.id} onClick={() => setSelType(opt.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-[14px] border-2 text-left transition-all active:scale-95 min-h-[56px]
                          ${active ? `${opt.bg} ${opt.border}` : 'border-border bg-canvas hover:border-border-strong'}`}>
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${active ? 'bg-white/50' : opt.bg}`}>
                          <opt.Icon size={18} className={active ? opt.accent : 'text-tertiary'} strokeWidth={2} />
                        </div>
                        <span className={`text-sm font-semibold ${active ? opt.accent : 'text-secondary'}`}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />Duration
                  </span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all min-h-[36px]
                        ${duration === d ? 'bg-bc-blue text-white border-bc-blue' : 'bg-canvas border-border text-secondary hover:border-border-strong'}`}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment — lift types only */}
              {isLiftType && (
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-2">Equipment</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EQUIP_OPTIONS.map(eq => {
                      const active = equipment.includes(eq);
                      return (
                        <button key={eq} onClick={() => toggleEquipment(eq)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all min-h-[36px]
                            ${active ? 'bg-lift-accent text-white border-lift-accent' : 'bg-canvas border-border text-secondary hover:border-border-strong'}`}>
                          {eq}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Intensity */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-2">Intensity</label>
                <div className="bc-tab-bar">
                  {['Light', 'Moderate', 'Heavy'].map(level => (
                    <button key={level} onClick={() => setIntensity(level)}
                      className="bc-tab flex-1"
                      style={{
                        background: intensity === level ? '#007AFF' : 'transparent',
                        color:      intensity === level ? '#fff' : '#8E8E93',
                        fontWeight: intensity === level ? 600 : 500,
                        borderRadius: '10px',
                      }}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus note */}
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Focus Note</label>
                <textarea
                  value={focusNote}
                  onChange={e => setFocusNote(e.target.value)}
                  rows={2}
                  className="bc-input resize-none"
                  placeholder="Anything to focus on or avoid? (e.g. skip squats, focus on glutes)"
                />
              </div>

              {/* Recent generates */}
              {recentGenerated.length > 0 && (
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-2">Recent</label>
                  <div className="bc-card-flush overflow-hidden">
                    {recentGenerated.map(workout => {
                      const cfg = typeIconConfig(workout.type);
                      const dur = workout.details?.duration ? `${workout.details.duration} min` : '';
                      return (
                        <div key={workout.id}
                          className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                          <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                            <cfg.Icon size={13} className={cfg.text} strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary truncate">
                              {workout.details?.sessionName || workout.type}
                            </p>
                            <p className="bc-caption">
                              {[dur, daysAgoLabel(workout.date)].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <button onClick={() => handleLoadAgain(workout)}
                            className="text-xs text-bc-blue font-semibold flex-shrink-0 min-h-[44px] px-2">
                            Load →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-bc-red-light border border-bc-red/20 rounded-[12px]">
                  <p className="text-xs font-medium text-bc-red-dark">{error}</p>
                </div>
              )}
            </div>

            {/* Input footer — generate button */}
            <div className="px-5 py-4 border-t border-border flex-shrink-0"
              style={{ paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom)))' }}>
              <button onClick={handleGenerate}
                disabled={!selType || generating}
                className="bc-btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-sm font-semibold min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed">
                {generating
                  ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
                  : <><Sparkles size={16} /> Generate</>}
              </button>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            RESULT VIEW
        ════════════════════════════════════════ */}
        {view === 'result' && result && (
          <>
            <div className="flex-1 overflow-y-auto">

              {/* Session heading */}
              <div className="px-5 py-4 border-b border-border/50">
                <p className="text-[17px] font-bold text-primary leading-tight">{result.sessionName}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {result.estimatedDuration && (
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-tertiary" />
                      <span className="bc-caption">{result.estimatedDuration} min</span>
                    </div>
                  )}
                  {result.estimatedDistance && (
                    <span className="bc-caption">· {result.estimatedDistance} mi</span>
                  )}
                  {(result.muscleGroups || []).length > 0 && (
                    <span className="bc-caption">· {result.muscleGroups.slice(0, 3).join(', ')}</span>
                  )}
                </div>
              </div>

              {/* Sections */}
              {(result.sections || []).map((section, si) => {
                const label      = section.label || '';
                const isMain     = label === 'Main Work' || label === 'Main Effort';
                const isWarmup   = label === 'Warm-up';
                const isFinisher = label === 'Finisher' || label === 'Cool-down';
                const canCollapse = !isMain;
                const isOpen     = isMain
                  || (isWarmup   && warmupOpen)
                  || (isFinisher && finisherOpen)
                  || (!isWarmup && !isFinisher && !isMain);

                return (
                  <div key={si} className="border-b border-border/40 last:border-0">
                    {/* Section header */}
                    <button
                      disabled={!canCollapse}
                      onClick={() => {
                        if (isWarmup)   setWarmupOpen(v => !v);
                        if (isFinisher) setFinisherOpen(v => !v);
                      }}
                      className={`w-full flex items-center justify-between px-5 py-3 min-h-[44px]
                        ${canCollapse ? 'hover:bg-canvas transition-colors cursor-pointer' : 'cursor-default'}`}>
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">{label}</p>
                      {canCollapse && (
                        isOpen
                          ? <ChevronUp size={14} className="text-tertiary" />
                          : <ChevronDown size={14} className="text-tertiary" />
                      )}
                    </button>

                    {isOpen && (
                      <div>
                        {/* ── Lift exercises ── */}
                        {(section.exercises || []).map((ex, ei) => {
                          const exList   = section.exercises;
                          const inSS     = !!ex.supersetWith;
                          const prevInSS = ei > 0 && !!exList[ei - 1].supersetWith;
                          const nextInSS = ei < exList.length - 1 && !!exList[ei + 1].supersetWith;
                          return (
                            <div key={ei} className="relative border-b border-border/30 last:border-0">
                              {/* Superset vertical connector */}
                              {inSS && (
                                <div className="absolute left-[14px]"
                                  style={{
                                    width: 2,
                                    background: `${SS_COLOR}55`,
                                    top:    prevInSS ? 0 : '50%',
                                    bottom: nextInSS ? 0 : '50%',
                                    zIndex: 1,
                                  }} />
                              )}
                              <div className={`flex items-start gap-2 py-2.5 pr-5 ${inSS ? 'pl-9' : 'pl-5'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-primary leading-snug">{ex.name}</p>
                                    <span className="bc-pill bg-lift-bg text-lift-accent text-[10px] flex-shrink-0 mt-0.5">
                                      {ex.sets}×{ex.reps}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {ex.rest && <span className="bc-caption">{ex.rest} rest</span>}
                                    {inSS && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                        style={{ background: `${SS_COLOR}18`, color: SS_COLOR }}>
                                        Superset
                                      </span>
                                    )}
                                  </div>
                                  {ex.note && (
                                    <p className="text-[10px] text-tertiary italic mt-0.5 leading-snug">{ex.note}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* ── Text content (run/cardio sections) ── */}
                        {section.content && (
                          <p className="px-5 pb-3.5 text-sm text-secondary leading-relaxed">{section.content}</p>
                        )}

                        {/* ── Interval cards ── */}
                        {(section.intervals || []).map((interval, ii) => (
                          <div key={ii} className="mx-5 mb-3 p-3 bg-run-bg rounded-[12px] border border-run-accent/20">
                            <p className="text-sm font-semibold text-run-accent">
                              {interval.reps} × {interval.distance}
                            </p>
                            <p className="bc-caption mt-0.5">
                              {interval.effort}{interval.recovery ? ` · ${interval.recovery} recovery` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Result footer */}
            <div className="px-5 py-4 border-t border-border flex-shrink-0"
              style={{ paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom)))' }}>
              <div className="flex items-center gap-2">
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-[12px] border border-border bg-canvas text-secondary text-sm font-medium hover:text-primary transition-colors min-h-[44px] disabled:opacity-40 flex-shrink-0">
                  {generating
                    ? <Loader2 size={13} className="animate-spin" />
                    : <RefreshCw size={13} />}
                  <span>{generating ? 'Generating…' : 'Regen'}</span>
                </button>
                <button onClick={handleStartWorkout} disabled={generating}
                  className="flex-1 bc-btn-primary py-3 flex items-center justify-center gap-1.5 text-sm min-h-[44px] disabled:opacity-40">
                  <Play size={14} fill="currentColor" /> Start Workout
                </button>
              </div>
              <button onClick={handleStartWorkout} disabled={generating}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-secondary font-medium hover:text-primary transition-colors min-h-[44px] disabled:opacity-40">
                <ClipboardList size={12} /> Log Anyway
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
