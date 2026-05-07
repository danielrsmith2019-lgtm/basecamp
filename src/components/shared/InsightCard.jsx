'use client';

import { formatDate, getDayOfWeek, getPhaseColors, getStatusInfo, comparePaces } from '@/utils/runUtils';
import { getMuscleGroupColors, formatVolume, summarizeExercises } from '@/utils/liftUtils';
import { RunTypeIcon, LiftSessionIcon, StatusIcon, ActivityIcon } from '@/utils/icons';
import { Moon } from 'lucide-react';

export default function DayTimeline({ date, workouts, onWorkoutClick }) {
  const dayName = getDayOfWeek(date);
  const isToday = date === new Date().toISOString().split('T')[0];
  const runs = workouts.filter(w => w.type === 'run');
  const lifts = workouts.filter(w => w.type === 'lift');
  const rests = workouts.filter(w => w.type === 'rest');
  const isEmpty = workouts.length === 0;

  return (
    <div className={`rounded-lg transition-all ${isToday ? 'ring-1 ring-accent/50 bg-accent/5' : ''}`}>
      <div className="flex items-center gap-3 mb-2 px-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-primary'}`}>
            {dayName.slice(0, 3)}
          </span>
          <span className="text-xs text-secondary">{formatDate(date)}</span>
        </div>
        {isToday && (
          <span className="stride-badge bg-accent/20 text-accent text-[10px]">Today</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {runs.map(w => <RunMiniCard key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {lifts.map(w => <LiftMiniCard key={w.id} workout={w} onClick={() => onWorkoutClick?.(w)} />)}
        {rests.map(w => <RestMarker key={w.id} workout={w} />)}
        {isEmpty && (
          <div className="bg-surface/50 rounded-lg px-3 py-2 text-center flex items-center justify-center gap-2">
            <Moon size={14} className="text-muted" />
            <span className="text-xs text-muted">Rest Day</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RunMiniCard({ workout, onClick }) {
  const { status, details } = workout;
  const { runType, runDescription, phase, plannedDistance, targetPace, actualDistance, actualPace, rpe } = details;
  const phaseColors = getPhaseColors(phase);
  const statusInfo = getStatusInfo(status);
  const paceComparison = status === 'completed' ? comparePaces(actualPace, targetPace) : null;
  const isRest = runType === 'REST' || runType === 'Rest' || runType === 'Rest/Lift';

  return (
    <button onClick={onClick} className={`stride-card stride-accent-left p-3 w-full text-left ${phaseColors.border} ${isRest ? 'opacity-60' : ''} ${status === 'skipped' ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <RunTypeIcon runType={runType} size={16} />
          <span className="text-sm font-semibold text-primary">{runType}</span>
        </div>
        <span className={`stride-badge text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={10} className="inline mr-0.5" /> {statusInfo.label}
        </span>
      </div>
      {!isRest && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="stride-data text-xs text-primary">
            {status === 'completed' && actualDistance != null ? actualDistance : plannedDistance} mi
          </span>
          {targetPace && <span className="stride-data text-xs text-secondary">{targetPace}</span>}
          {status === 'completed' && actualPace && (
            <>
              <span className="text-muted text-xs">→</span>
              <span className={`stride-data text-xs ${paceComparison?.color || 'text-primary'}`}>{actualPace}</span>
              {paceComparison && <span className={`text-[10px] ${paceComparison.color}`}>{paceComparison.label}</span>}
            </>
          )}
          {status === 'completed' && rpe != null && <span className="text-xs text-muted">RPE {rpe}</span>}
        </div>
      )}
      {runDescription && runDescription !== runType && !isRest && (
        <p className="text-[11px] text-secondary mt-1 truncate">{runDescription}</p>
      )}
      {status === 'skipped' && details.notes && (
        <p className="text-[11px] text-status-skipped mt-1 italic">{details.notes}</p>
      )}
      {phase && !isRest && (
        <div className="mt-1.5">
          <span className={`stride-badge text-[10px] ${phaseColors.bg} ${phaseColors.text}`}>
            {phase.replace(/Phase \d+: /, '')}
          </span>
        </div>
      )}
    </button>
  );
}

function LiftMiniCard({ workout, onClick }) {
  const { status, details } = workout;
  const { sessionName, muscleGroups = [], exercises = [], totalVolume, totalSets } = details;
  const statusMap = {
    completed: { label: 'Done', bg: 'bg-status-done/20', text: 'text-status-done' },
    planned: { label: 'Planned', bg: 'bg-status-planned/20', text: 'text-status-planned' },
    skipped: { label: 'Skipped', bg: 'bg-status-skipped/20', text: 'text-status-skipped' },
  };
  const statusInfo = statusMap[status] || statusMap.planned;

  return (
    <button onClick={onClick} className="stride-card stride-accent-left border-activity-lift p-3 w-full text-left">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <LiftSessionIcon sessionName={sessionName} size={16} />
          <span className="text-sm font-semibold text-primary">{sessionName || 'Workout'}</span>
        </div>
        <span className={`stride-badge text-[10px] ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon status={status} size={10} className="inline mr-0.5" /> {statusInfo.label}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="stride-data text-xs text-primary">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
        {totalSets != null && <span className="stride-data text-xs text-secondary">{totalSets} sets</span>}
        {totalVolume != null && <span className="stride-data text-xs text-activity-lift">{formatVolume(totalVolume)}</span>}
      </div>
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {muscleGroups.slice(0, 4).map(mg => {
          const colors = getMuscleGroupColors(mg);
          return <span key={mg} className={`stride-badge text-[10px] ${colors.bg} ${colors.text}`}>{mg}</span>;
        })}
      </div>
      <p className="text-[11px] text-secondary mt-1 truncate">{summarizeExercises(exercises, 2)}</p>
    </button>
  );
}

function RestMarker({ workout }) {
  return (
    <div className="stride-card stride-accent-left border-activity-rest p-3 opacity-60">
      <div className="flex items-center gap-2">
        <Moon size={16} className="text-activity-rest" />
        <span className="text-sm text-secondary">{workout.details?.restType || 'Rest Day'}</span>
      </div>
      {workout.details?.notes && (
        <p className="text-[11px] text-muted mt-1 italic">{workout.details.notes}</p>
      )}
    </div>
  );
}