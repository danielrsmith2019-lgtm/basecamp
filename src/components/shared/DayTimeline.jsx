'use client';

import { formatDate, getDayOfWeek, getPhaseColors, getStatusInfo, comparePaces } from '@/utils/runUtils';
import { getMuscleGroupColors, formatVolume, summarizeExercises } from '@/utils/liftUtils';
import { RunTypeIcon, LiftSessionIcon, StatusIcon, ActivityIcon } from '@/utils/icons';
import { Moon, Coffee, Footprints, Dumbbell } from 'lucide-react';

const REST_CONFIG = {
  full_rest: {
    label: 'Full Rest',
    sublabel: 'No training — complete recovery',
    icon: Moon,
    color: 'text-rest-accent',
    border: 'border-rest-accent/30',
    bg: 'bg-rest-bg',
  },
  off_running: {
    label: 'Off Running',
    sublabel: 'No running — lifting or mobility okay',
    icon: Footprints,
    color: 'text-run-mid',
    border: 'border-run-accent/30',
    bg: 'bg-run-bg',
  },
  off_lifting: {
    label: 'Off Lifting',
    sublabel: 'No lifting — easy run or cardio okay',
    icon: Dumbbell,
    color: 'text-lift-mid',
    border: 'border-lift-accent/30',
    bg: 'bg-lift-bg',
  },
  active_recovery: {
    label: 'Active Recovery',
    sublabel: 'Light movement only — walk, stretch, foam roll',
    icon: Coffee,
    color: 'text-cardio-accent',
    border: 'border-cardio-accent/30',
    bg: 'bg-cardio-bg',
  },
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
  const dayName = getDayOfWeek(date);
  const isToday = isTodayProp ?? (date === new Date().toISOString().split('T')[0]);
  const runs  = workouts.filter(w => w.type === 'run');
  const lifts = workouts.filter(w => w.type === 'lift');
  const rests = workouts.filter(w => w.type === 'rest');
  const isEmpty = workouts.length === 0;
  
  return (
    <div className={`rounded-[14px] transition-all ${isToday ? 'ring-1 ring-bc-blue/40 bg-bc-blue-light/20' : ''}`}>
      {/* ── Day header ── */}
<div className="flex items-center gap-3 mb-2 px-1">
  <div className="flex items-baseline gap-2">
    <span className={`text-sm font-semibold ${isToday ? 'text-bc-blue' : 'text-primary'}`}>
      {dayName.slice(0, 3)}
    </span>
    <span className="text-xs text-secondary">{formatDate(date)}</span>
  </div>
  {isToday && (
    <span className="bc-pill bg-bc-blue-light text-bc-blue-dark text-[10px]">Today</span>
  )}
  {workouts[0]?.details?.phase && (
    <span className="bc-pill bg-canvas text-tertiary text-[10px] border border-border">
      {workouts[0].details.phase}
    </span>
  )}
  {/* ── Done indicator ── */}
{workouts.some(w => w.status === 'completed') && (
  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium"
        style={{ color: '#34C759' }}>
    <span className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ backgroundColor: '#34C759' }} />
    Done
  </span>
)}
</div>

      {/* ── Workout cards ── */}
      <div className="flex flex-col gap-2">
        {runs.map(w  => <RunMiniCard  key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {lifts.map(w => <LiftMiniCard key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {rests.map(w => <RestMarker   key={w.id} workout={w} />)}
        {isEmpty && (
          <div className="bg-canvas rounded-[14px] px-3 py-3 flex items-center justify-center gap-2">
            <Moon size={14} className="text-tertiary" />
            <span className="text-xs text-tertiary">No sessions scheduled</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Run Card ────────────────────────────────────────────

function RunMiniCard({ workout, onClick }) {
  const { status, details } = workout;
  const { runType, runDescription, phase, plannedDistance,
          targetPace, actualDistance, actualPace, rpe, weekNumber } = details;
  const statusInfo = STATUS_BADGE[status] || STATUS_BADGE.planned;
  const paceComparison = status === 'completed' ? comparePaces(actualPace, targetPace) : null;
  const isRest = runType === 'REST' || runType === 'Rest' || runType === 'Rest/Lift';
  const displayType = RUN_LABELS[runType] || runType;

  return (
    <button
      onClick={onClick}
      className={`bc-workout-run border-l-4 border-run-accent w-full text-left
                  hover:brightness-[0.97] transition-all active:scale-[0.99]
                  ${isRest || status === 'skipped' ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <RunTypeIcon runType={runType} size={16} />
          <span className="text-sm font-semibold text-run-accent">{displayType}</span>
          {weekNumber && <span className="bc-caption">Wk {weekNumber}</span>}
        </div>
        <span className={`bc-pill text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={10} className="inline mr-0.5" />
          {statusInfo.label}
        </span>
      </div>

      {!isRest && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bc-data text-xs text-primary">
            {status === 'completed' && actualDistance != null ? actualDistance : plannedDistance} mi
          </span>
          {targetPace && (
            <span className="bc-data text-xs text-secondary">@ {targetPace}</span>
          )}
          {status === 'completed' && actualPace && (
            <>
              <span className="text-tertiary text-xs">→</span>
              <span className={`bc-data text-xs ${paceComparison?.color || 'text-primary'}`}>
                {actualPace}
              </span>
              {paceComparison && (
                <span className={`text-[10px] ${paceComparison.color}`}>{paceComparison.label}</span>
              )}
            </>
          )}
          {status === 'completed' && rpe != null && (
            <span className="text-xs text-tertiary">RPE {rpe}</span>
          )}
        </div>
      )}

      {runDescription && runDescription !== runType && runDescription !== displayType && !isRest && (
        <p className="text-[11px] text-secondary mt-1 truncate">{runDescription}</p>
      )}

      {status === 'skipped' && details.notes && (
        <p className="text-[11px] text-bc-red-dark mt-1 italic">{details.notes}</p>
      )}

      {phase && !isRest && (
        <div className="mt-1.5">
          <span className="bc-pill bg-canvas text-tertiary text-[10px] border border-border">
            {phase.replace(/Phase \d+: /, '')}
          </span>
        </div>
      )}
    </button>
  );
}


// ── Lift Card ───────────────────────────────────────────

function LiftMiniCard({ workout, onClick }) {
  const { status, details } = workout;
  const { sessionName, muscleGroups = [], exercises = [],
          totalVolume, totalSets, weekNumber } = details;
  const statusInfo = STATUS_BADGE[status] || STATUS_BADGE.planned;

  return (
    <button
      onClick={onClick}
      className="bc-workout-lift border-l-4 border-lift-accent w-full text-left
                 hover:brightness-[0.97] transition-all active:scale-[0.99]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <LiftSessionIcon sessionName={sessionName} size={16} />
          <span className="text-sm font-semibold text-lift-accent">{sessionName || 'Workout'}</span>
          {weekNumber && <span className="bc-caption">Wk {weekNumber}</span>}
        </div>
        <span className={`bc-pill text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={10} className="inline mr-0.5" />
          {statusInfo.label}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="bc-data text-xs text-primary">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
        </span>
        {totalSets != null && (
          <span className="bc-data text-xs text-secondary">{totalSets} sets</span>
        )}
        {totalVolume != null && (
          <span className="bc-data text-xs text-lift-accent">{formatVolume(totalVolume)}</span>
        )}
      </div>

      <div className="flex gap-1 mt-1.5 flex-wrap">
        {muscleGroups.slice(0, 4).map(mg => (
          <span key={mg} className="bc-pill bg-lift-bg text-lift-accent text-[10px]">{mg}</span>
        ))}
      </div>

      <p className="text-[11px] text-secondary mt-1 truncate">
        {summarizeExercises(exercises, 2)}
      </p>
    </button>
  );
}


// ── Rest Marker ─────────────────────────────────────────

function RestMarker({ workout }) {
  const restType = workout.details?.restType || 'full_rest';
  const config = REST_CONFIG[restType] || REST_CONFIG.full_rest;
  const Icon = config.icon;

  return (
    <div className={`rounded-[14px] border-l-4 p-3 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={config.color} />
        <div>
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          <p className="bc-caption mt-0.5">{config.sublabel}</p>
        </div>
      </div>
      {workout.details?.notes && workout.details.notes !== config.sublabel && (
        <p className="text-[11px] text-tertiary mt-1 italic ml-6">{workout.details.notes}</p>
      )}
    </div>
  );
}