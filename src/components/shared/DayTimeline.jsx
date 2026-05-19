'use client';

import { formatDate, getDayOfWeek, comparePaces } from '@/utils/runUtils';
import { formatVolume } from '@/utils/liftUtils';
import { RunTypeIcon, LiftSessionIcon, StatusIcon } from '@/utils/icons';
import { Moon, Coffee, Footprints, Dumbbell } from 'lucide-react';

const REST_CONFIG = {
  full_rest:       { label: 'Full Rest',        sublabel: 'No training — complete recovery',               icon: Moon,      color: 'text-rest-accent',   border: 'border-rest-accent/30',  bg: 'bg-rest-bg'    },
  off_running:     { label: 'Off Running',      sublabel: 'No running — lifting or mobility okay',         icon: Footprints, color: 'text-run-mid',       border: 'border-run-accent/30',   bg: 'bg-run-bg'     },
  off_lifting:     { label: 'Off Lifting',      sublabel: 'No lifting — easy run or cardio okay',          icon: Dumbbell,  color: 'text-lift-mid',       border: 'border-lift-accent/30',  bg: 'bg-lift-bg'    },
  active_recovery: { label: 'Active Recovery',  sublabel: 'Light movement only — walk, stretch, foam roll', icon: Coffee,   color: 'text-cardio-accent',  border: 'border-cardio-accent/30', bg: 'bg-cardio-bg'  },
};

const STATUS_BADGE = {
  completed: { label: 'Done',    bg: 'bg-bc-green-light', text: 'text-bc-green-dark' },
  planned:   { label: 'Planned', bg: 'bg-bc-blue-light',  text: 'text-bc-blue-dark'  },
  skipped:   { label: 'Skipped', bg: 'bg-bc-red-light',   text: 'text-bc-red-dark'   },
};

const RUN_LABELS = {
  easy:     'Easy Run',
  tempo:    'Tempo',
  interval: 'Intervals',
  long_run: 'Long Run',
  recovery: 'Recovery Run',
  fartlek:  'Fartlek',
};

export default function DayTimeline({ date, workouts: rawWorkouts = [], onWorkoutClick, isToday: isTodayProp }) {
  if (!date) return null;
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];
  const dayName  = getDayOfWeek(date);
  const isToday  = isTodayProp ?? (date === new Date().toLocaleDateString('en-CA'));
  const runs     = workouts.filter(w => w.type === 'run');
  const lifts    = workouts.filter(w => w.type === 'lift');
  const rests    = workouts.filter(w => w.type === 'rest');
  const allDone  = workouts.length > 0 && workouts.every(w => w.status === 'completed');

  return (
    <div className={`rounded-[16px] transition-all ${isToday ? 'ring-1 ring-bc-blue/30' : ''}`}>

      {/* ── Day header ── */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`text-sm font-bold ${isToday ? 'text-bc-blue' : 'text-primary'}`}>
          {dayName.slice(0, 3)}
        </span>
        <span className="text-xs text-secondary">{formatDate(date)}</span>
        {isToday && (
          <span className="bc-pill bg-bc-blue-light text-bc-blue-dark text-[10px]">Today</span>
        )}
        {workouts[0]?.details?.phase && (
          <span className="bc-pill bg-canvas text-tertiary text-[10px] border border-border">
            {workouts[0].details.phase}
          </span>
        )}
        {allDone && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-bc-green-dark">
            <span className="w-1.5 h-1.5 rounded-full bg-bc-green inline-block" />
            Done
          </span>
        )}
      </div>

      {/* ── Session rows ── */}
      <div className="flex flex-col gap-2">
        {runs.map(w   => <RunRow    key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {lifts.map(w  => <LiftRow   key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {rests.map(w  => <RestRow   key={w.id} workout={w} />)}
        {workouts.length === 0 && (
          <div className="bg-canvas rounded-[12px] px-3 py-3 flex items-center justify-center gap-2">
            <Moon size={14} className="text-tertiary" />
            <span className="text-xs text-tertiary">No sessions scheduled</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Run Row ─────────────────────────────────────────────
// Matches plan page: distance hero, pace pill, duration pill

function RunRow({ workout, onClick }) {
  const { status, details } = workout;
  const {
    runType, runDescription, phase,
    plannedDistance, targetPace,
    actualDistance, actualPace,
    duration, rpe, weekNumber,
  } = details;

  const statusInfo     = STATUS_BADGE[status] || STATUS_BADGE.planned;
  const paceComparison = status === 'completed' ? comparePaces(actualPace, targetPace) : null;
  const isSkipped      = status === 'skipped';
  const displayType    = RUN_LABELS[runType] || (runType ? runType.replace(/_/g, ' ') : 'Run');
  const displayDist    = status === 'completed' && actualDistance != null ? actualDistance : plannedDistance;
  const displayPace    = status === 'completed' && actualPace ? actualPace : targetPace;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 bg-run-bg rounded-[12px] border border-run-accent/20
                  hover:brightness-[0.97] active:scale-[0.99] transition-all
                  ${isSkipped ? 'opacity-50' : ''}`}>

      {/* Header row: type + week tag + status badge */}
      <div className="flex items-center gap-2 mb-2">
        <RunTypeIcon runType={runType} size={14} />
        <span className="text-[11px] font-semibold text-run-accent uppercase tracking-wide">
          {displayType}
        </span>
        {weekNumber && <span className="bc-caption">Wk {weekNumber}</span>}
        <span className={`bc-pill text-[10px] ml-auto ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={9} className="inline mr-0.5" />
          {statusInfo.label}
        </span>
      </div>

      {/* Metrics row: distance hero + pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Distance — largest element */}
        <span className="text-base font-bold text-primary leading-none"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {displayDist}
          <span className="text-xs font-medium text-secondary ml-0.5">mi</span>
        </span>

        {/* Pace pill — planned or actual */}
        {displayPace && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border
            ${status === 'completed' && actualPace
              ? paceComparison?.color === 'text-bc-green-dark'
                ? 'bg-bc-green-light border-bc-green/30'
                : paceComparison?.color === 'text-bc-red'
                ? 'bg-bc-red-light border-bc-red/30'
                : 'bg-white/70 border-run-accent/20'
              : 'bg-white/70 border-run-accent/20'}`}>
            {status === 'completed' && actualPace
              ? <><span className="text-[9px] text-tertiary">actual</span></>
              : <><span className="text-[9px] text-tertiary">@</span></>}
            <span className="text-[11px] font-semibold text-primary"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {displayPace}
            </span>
            <span className="text-[9px] text-tertiary">/mi</span>
            {paceComparison?.label && (
              <span className={`text-[9px] font-semibold ${paceComparison.color}`}>
                {paceComparison.label}
              </span>
            )}
          </span>
        )}

        {/* Duration pill */}
        {duration && (
          <span className="flex items-center gap-0.5 px-2 py-0.5 bg-white/70 rounded-full border border-run-accent/20">
            <span className="text-[11px] font-semibold text-primary">{duration}</span>
            <span className="text-[9px] text-tertiary">min</span>
          </span>
        )}

        {/* RPE pill (completed only) */}
        {status === 'completed' && rpe != null && (
          <span className="flex items-center gap-0.5 px-2 py-0.5 bg-white/70 rounded-full border border-run-accent/20">
            <span className="text-[9px] text-tertiary">RPE</span>
            <span className="text-[11px] font-semibold text-primary">{rpe}</span>
          </span>
        )}
      </div>

      {/* Notes / description */}
      {runDescription && runDescription !== runType && runDescription !== displayType && (
        <p className="text-[10px] text-secondary mt-1.5 italic truncate">{runDescription}</p>
      )}
      {isSkipped && details.notes && (
        <p className="text-[10px] text-bc-red-dark mt-1 italic">{details.notes}</p>
      )}
    </button>
  );
}


// ── Lift Row ────────────────────────────────────────────
// Matches plan page: session header + exercise badge grid

function LiftRow({ workout, onClick }) {
  const { status, details } = workout;
  const {
    sessionName, muscleGroups = [], exercises = [],
    totalVolume, duration, weekNumber,
  } = details;

  const statusInfo = STATUS_BADGE[status] || STATUS_BADGE.planned;
  const isSkipped  = status === 'skipped';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 bg-lift-bg rounded-[12px] border border-lift-accent/20
                  hover:brightness-[0.97] active:scale-[0.99] transition-all
                  ${isSkipped ? 'opacity-50' : ''}`}>

      {/* Header: session name + duration + status */}
      <div className="flex items-center gap-2 mb-2">
        <LiftSessionIcon sessionName={sessionName} size={14} />
        <span className="text-[11px] font-semibold text-lift-accent uppercase tracking-wide truncate flex-1">
          {sessionName || 'Strength'}
        </span>
        {weekNumber && <span className="bc-caption flex-shrink-0">Wk {weekNumber}</span>}
        {duration && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/60 rounded-full border border-lift-accent/20 flex-shrink-0">
            <span className="text-[10px] font-semibold text-primary">{duration}</span>
            <span className="text-[9px] text-tertiary">min</span>
          </span>
        )}
        <span className={`bc-pill text-[10px] flex-shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={9} className="inline mr-0.5" />
          {statusInfo.label}
        </span>
      </div>

      {/* Muscle group pills */}
      {muscleGroups.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {muscleGroups.slice(0, 3).map(mg => (
            <span key={mg} className="px-2 py-0.5 bg-white/60 rounded-full border border-lift-accent/20 text-[10px] text-lift-accent font-medium">
              {mg}
            </span>
          ))}
          {muscleGroups.length > 3 && (
            <span className="px-2 py-0.5 bg-white/60 rounded-full border border-lift-accent/20 text-[10px] text-tertiary">
              +{muscleGroups.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Exercise badge grid — matches plan page */}
      {exercises.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {exercises.slice(0, 6).map((ex, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white/50 rounded-[8px]">
              <span className="text-[11px] text-primary truncate flex-1">{ex.name}</span>
              {(ex.sets && ex.reps) && (
                <span className="flex-shrink-0 px-1.5 py-0.5 bg-lift-bg rounded-full border border-lift-accent/20">
                  <span className="text-[11px] font-bold text-lift-accent"
                    style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                    {ex.sets}×{ex.reps}
                  </span>
                </span>
              )}
            </div>
          ))}
          {exercises.length > 6 && (
            <div className="flex items-center justify-center px-2 py-1.5">
              <span className="text-[10px] text-tertiary">+{exercises.length - 6} more</span>
            </div>
          )}
        </div>
      )}

      {/* Completed: volume summary */}
      {status === 'completed' && totalVolume != null && (
        <p className="text-[10px] text-lift-accent font-medium mt-1.5">
          {formatVolume(totalVolume)} total volume
        </p>
      )}
    </button>
  );
}


// ── Rest Row ────────────────────────────────────────────

function RestRow({ workout }) {
  const restType = workout.details?.restType || 'full_rest';
  const config   = REST_CONFIG[restType] || REST_CONFIG.full_rest;
  const Icon     = config.icon;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-[12px] border-l-4 ${config.bg} ${config.border}`}>
      <Icon size={15} className={`${config.color} flex-shrink-0`} />
      <div className="min-w-0">
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        <p className="bc-caption truncate">{config.sublabel}</p>
        {workout.details?.notes && workout.details.notes !== config.sublabel && (
          <p className="text-[10px] text-tertiary mt-0.5 italic">{workout.details.notes}</p>
        )}
      </div>
    </div>
  );
}