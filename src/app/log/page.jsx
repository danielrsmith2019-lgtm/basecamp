'use client';

/**
 * Training Log — Unified table of ALL workouts across types.
 * Weekly summary rows break up the timeline with aggregated stats.
 */

import { useState, useMemo } from 'react';
import { formatDate, comparePaces, getRunTypeEmoji } from '@/utils/runUtils';
import { getSessionEmoji, formatVolume, summarizeExercises } from '@/utils/liftUtils';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import LogForm from '@/components/shared/LogForm';
import { createWorkout } from '@/data/types';

import { Footprints, Dumbbell, Bike, Moon, Activity } from 'lucide-react';

const TYPE_CONFIG = {
  run:    { Icon: Footprints, label: 'Run',    color: 'text-activity-run',    bg: 'bg-activity-run/15' },
  lift:   { Icon: Dumbbell,   label: 'Lift',   color: 'text-activity-lift',   bg: 'bg-activity-lift/15' },
  cardio: { Icon: Bike,       label: 'Cardio', color: 'text-activity-cardio', bg: 'bg-activity-cardio/15' },
  rest:   { Icon: Moon,       label: 'Rest',   color: 'text-activity-rest',   bg: 'bg-activity-rest/15' },
  other:  { Icon: Activity,   label: 'Other',  color: 'text-secondary',       bg: 'bg-secondary/15' },
};

const STATUS_DOT = {
  completed: 'bg-status-done',
  planned:   'bg-status-planned',
  skipped:   'bg-status-skipped',
};

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'run',    label: 'Runs' },
  { key: 'lift',   label: 'Lifts' },
  { key: 'rest',   label: 'Rest' },
];

import { useWorkouts } from '@/lib/WorkoutContext';

// Inside the component, replace the useState with:
export default function TrainingLog() {
  const { workouts, saveWorkout, isLoaded } = useWorkouts();
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');

  // ── Filter + sort workouts ──
  const filtered = useMemo(() => {
    return workouts
      .filter(w => {
        if (typeFilter !== 'all' && w.type !== typeFilter) return false;
        if (dateFrom && w.date < dateFrom) return false;
        if (dateTo && w.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => sortOrder === 'desc'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
      );
  }, [workouts, typeFilter, dateFrom, dateTo, sortOrder]);

  // ── Build rows with weekly summary inserts ──
  const tableRows = useMemo(() => {
    return buildTableRows(filtered, sortOrder);
  }, [filtered, sortOrder]);

  // ── Aggregate stats for the filter bar ──
  const stats = useMemo(() => {
    const f = filtered.filter(w => w.status === 'completed');
    const runs = f.filter(w => w.type === 'run');
    const lifts = f.filter(w => w.type === 'lift');
    const totalMiles = runs.reduce((s, w) => s + (w.details.actualDistance || 0), 0);
    const totalVolume = lifts.reduce((s, w) => s + (w.details.totalVolume || 0), 0);

    return {
      total: filtered.length,
      completed: f.length,
      totalMiles: totalMiles.toFixed(1),
      totalVolume,
    };
  }, [filtered]);

  function handleSave(data) {
    saveWorkout(data);
    setSelectedWorkout(null);
    setShowNewForm(false);
  }

  function clearFilters() {
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  const hasActiveFilters = typeFilter !== 'all' || dateFrom || dateTo;

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted text-sm">Loading...</p></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="stride-section-label mb-0">Training Log</h2>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 bg-accent text-white text-xs font-medium
                     rounded-lg hover:brightness-110 transition-all"
        >
          + Log Workout
        </button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* FILTER BAR */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="stride-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filters */}
          <div className="flex gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${typeFilter === f.key
                    ? 'bg-accent text-white'
                    : 'bg-surface text-secondary hover:text-primary'
                  }
                `}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-surface border border-border text-primary text-xs rounded-lg
                         px-2 py-1.5 focus:outline-none focus:border-accent w-32"
              placeholder="From"
            />
            <span className="text-muted text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-surface border border-border text-primary text-xs rounded-lg
                         px-2 py-1.5 focus:outline-none focus:border-accent w-32"
            />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="px-2 py-1.5 text-xs text-secondary hover:text-primary bg-surface rounded-lg transition-colors"
            title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          >
            {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>

        {/* Active filter summary */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted">
            <span><span className="stride-data text-primary">{stats.total}</span> entries</span>
            <span><span className="stride-data text-primary">{stats.completed}</span> completed</span>
            {stats.totalMiles !== '0.0' && (
              <span><span className="stride-data text-activity-run">{stats.totalMiles}</span> mi</span>
            )}
            {stats.totalVolume > 0 && (
              <span><span className="stride-data text-activity-lift">{formatVolume(stats.totalVolume)}</span></span>
            )}
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-accent hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* TABLE */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="stride-card overflow-hidden">
        {/* Desktop table (hidden on small screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] uppercase tracking-wider text-muted font-semibold px-4 py-3">Date</th>
                <th className="text-center text-[10px] uppercase tracking-wider text-muted font-semibold px-3 py-3 w-16">Type</th>
                <th className="text-center text-[10px] uppercase tracking-wider text-muted font-semibold px-3 py-3 w-12"></th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted font-semibold px-4 py-3">Details</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-muted font-semibold px-4 py-3">Key Metric</th>
                <th className="text-center text-[10px] uppercase tracking-wider text-muted font-semibold px-3 py-3 w-14">RPE</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted font-semibold px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                if (row.isSummary) {
                  return <WeeklySummaryRow key={`summary-${i}`} summary={row} />;
                }
                return (
                  <WorkoutRow
                    key={row.workout.id}
                    workout={row.workout}
                    onClick={() => setSelectedWorkout(row.workout)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list (shown on small screens) */}
        <div className="md:hidden">
          {tableRows.map((row, i) => {
            if (row.isSummary) {
              return <MobileSummaryCard key={`summary-${i}`} summary={row} />;
            }
            return (
              <MobileWorkoutCard
                key={row.workout.id}
                workout={row.workout}
                onClick={() => setSelectedWorkout(row.workout)}
              />
            );
          })}
        </div>

        {/* Empty state */}
        {tableRows.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-secondary">No workouts match your filters.</p>
            <button onClick={clearFilters} className="text-accent text-sm mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════ */}
      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onSave={handleSave}
      />

      {showNewForm && (
        <LogForm
          workout={null}
          onSave={handleSave}
          onClose={() => setShowNewForm(false)}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// DESKTOP TABLE ROW
// ═══════════════════════════════════════════════════════

function WorkoutRow({ workout, onClick }) {
  const { date, type, status, details } = workout;
  const typeInfo = TYPE_CONFIG[type] || TYPE_CONFIG.other;

  // Build detail text
  let detailText = '';
  let keyMetric = '';
  let keyMetricColor = 'text-primary';
  let rpe = details.rpe;

  if (type === 'run') {
    detailText = details.runType || '';
    if (details.runDescription && details.runDescription !== details.runType) {
      detailText = details.runDescription;
    }

    if (status === 'completed' && details.actualPace) {
      keyMetric = `${details.actualDistance || ''} mi @ ${details.actualPace}`;
      const comparison = comparePaces(details.actualPace, details.targetPace);
      if (comparison) keyMetricColor = comparison.color;
    } else {
      keyMetric = `${details.plannedDistance || ''} mi @ ${details.targetPace || ''}`;
      keyMetricColor = 'text-secondary';
    }
  }

  if (type === 'lift') {
    detailText = details.sessionName || summarizeExercises(details.exercises || [], 2);
    keyMetric = details.totalVolume ? formatVolume(details.totalVolume) : '—';
    keyMetricColor = 'text-activity-lift';
    // Average RPE across all sets
    if (!rpe && details.exercises) {
      const allRpe = details.exercises.flatMap(e =>
        (e.sets || []).filter(s => s.rpe != null).map(s => s.rpe)
      );
      if (allRpe.length > 0) {
        rpe = Math.round(allRpe.reduce((a, b) => a + b, 0) / allRpe.length);
      }
    }
  }

  if (type === 'cardio') {
    detailText = details.activityType || 'Cardio';
    keyMetric = details.duration ? `${details.duration} min` : '—';
    rpe = details.rpe;
  }

  if (type === 'rest') {
    detailText = details.restType || 'Rest Day';
    keyMetric = '—';
  }

  return (
    <tr
      onClick={onClick}
      className={`
        border-b border-border/50 transition-colors cursor-pointer
        hover:bg-surface/50
        ${status === 'skipped' ? 'opacity-50' : ''}
      `}
    >
      {/* Date */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || STATUS_DOT.planned}`} />
          <span className="text-sm text-primary">{formatDate(date)}</span>
        </div>
      </td>

      {/* Type emoji */}
      <td className="px-3 py-3 text-center">
        <div className={`stride-badge ${typeInfo.bg} ${typeInfo.color} inline-flex`}>
          <typeInfo.Icon size={14} strokeWidth={2} />
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3 text-center">
        {status === 'completed' && <span className="text-status-done text-xs">✓</span>}
        {status === 'skipped' && <span className="text-status-skipped text-xs">✗</span>}
        {status === 'planned' && <span className="text-muted text-xs">—</span>}
      </td>

      {/* Details */}
      <td className="px-4 py-3">
        <span className="text-sm text-primary">{detailText}</span>
        {type === 'lift' && details.muscleGroups && (
          <div className="flex gap-1 mt-1">
            {details.muscleGroups.slice(0, 3).map(mg => (
              <span key={mg} className="text-[10px] text-muted">{mg}</span>
            ))}
          </div>
        )}
        {type === 'run' && details.phase && (
          <span className="text-[10px] text-muted ml-2">
            {details.phase.replace(/Phase \d+: /, '')}
          </span>
        )}
      </td>

      {/* Key Metric */}
      <td className={`px-4 py-3 text-right stride-data text-sm ${keyMetricColor}`}>
        {keyMetric}
      </td>

      {/* RPE */}
      <td className="px-3 py-3 text-center">
        {rpe != null ? (
          <span className={`
            stride-data text-xs
            ${rpe <= 4 ? 'text-phase-base' : rpe <= 7 ? 'text-phase-peak' : 'text-status-skipped'}
          `}>
            {rpe}
          </span>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <span className="text-xs text-secondary truncate block max-w-[160px]">
          {details.notes || '—'}
        </span>
      </td>
    </tr>
  );
}


// ═══════════════════════════════════════════════════════
// WEEKLY SUMMARY ROW (desktop)
// ═══════════════════════════════════════════════════════

function WeeklySummaryRow({ summary }) {
  return (
    <tr className="bg-surface/30 border-b border-border">
      <td colSpan={2} className="px-4 py-2.5">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          {summary.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="stride-data text-xs text-primary">{summary.workoutCount}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-3 text-xs">
          {summary.runCount > 0 && (
            <span className="text-activity-run">
              {summary.runCount} run{summary.runCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.liftCount > 0 && (
            <span className="text-activity-lift">
              {summary.liftCount} lift{summary.liftCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.skippedCount > 0 && (
            <span className="text-status-skipped">
              {summary.skippedCount} skipped
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex flex-col items-end gap-0.5">
          {summary.totalMiles > 0 && (
            <span className="stride-data text-xs text-activity-run">{summary.totalMiles.toFixed(1)} mi</span>
          )}
          {summary.totalVolume > 0 && (
            <span className="stride-data text-xs text-activity-lift">{formatVolume(summary.totalVolume)}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        {summary.avgRpe != null && (
          <span className="stride-data text-xs text-secondary">{summary.avgRpe}</span>
        )}
      </td>
      <td className="px-4 py-2.5"></td>
    </tr>
  );
}


// ═══════════════════════════════════════════════════════
// MOBILE CARD VIEWS
// ═══════════════════════════════════════════════════════

function MobileWorkoutCard({ workout, onClick }) {
  const { date, type, status, details } = workout;
  const typeInfo = TYPE_CONFIG[type] || TYPE_CONFIG.other;

  let title = '';
  let metric = '';
  let metricColor = 'text-primary';

  if (type === 'run') {
    title = details.runType || 'Run';
    if (status === 'completed' && details.actualPace) {
      metric = `${details.actualDistance} mi @ ${details.actualPace}`;
      const comparison = comparePaces(details.actualPace, details.targetPace);
      if (comparison) metricColor = comparison.color;
    } else {
      metric = `${details.plannedDistance} mi`;
      metricColor = 'text-secondary';
    }
  } else if (type === 'lift') {
    title = details.sessionName || 'Lift';
    metric = details.totalVolume ? formatVolume(details.totalVolume) : `${(details.exercises || []).length} exercises`;
    metricColor = 'text-activity-lift';
  } else if (type === 'rest') {
    title = details.restType || 'Rest Day';
    metric = '';
  } else {
    title = details.activityType || 'Workout';
    metric = details.duration ? `${details.duration} min` : '';
  }

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left flex items-center justify-between p-4
        border-b border-border/50 transition-colors
        hover:bg-surface/50
        ${status === 'skipped' ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center w-8">
          <span className={`w-1.5 h-1.5 rounded-full mb-1 ${STATUS_DOT[status] || STATUS_DOT.planned}`} />
          <span className="text-lg">{typeInfo.emoji}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="text-xs text-secondary">{formatDate(date)}</p>
          {details.notes && (
            <p className="text-[11px] text-muted mt-0.5 truncate max-w-[180px]">{details.notes}</p>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-3">
        {metric && (
          <p className={`stride-data text-sm ${metricColor}`}>{metric}</p>
        )}
        {details.rpe != null && (
          <p className="text-[10px] text-muted mt-0.5">RPE {details.rpe}</p>
        )}
      </div>
    </button>
  );
}

function MobileSummaryCard({ summary }) {
  return (
    <div className="bg-surface/30 px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          {summary.label}
        </span>
        <div className="flex gap-3 text-xs">
          {summary.totalMiles > 0 && (
            <span className="stride-data text-activity-run">{summary.totalMiles.toFixed(1)} mi</span>
          )}
          {summary.totalVolume > 0 && (
            <span className="stride-data text-activity-lift">{formatVolume(summary.totalVolume)}</span>
          )}
          <span className="text-muted">{summary.workoutCount} sessions</span>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// BUILD TABLE ROWS WITH WEEKLY SUMMARIES
// ═══════════════════════════════════════════════════════

function buildTableRows(workouts, sortOrder) {
  if (workouts.length === 0) return [];

  // Group by ISO week
  const weeks = {};
  workouts.forEach(w => {
    const weekKey = getISOWeek(w.date);
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(w);
  });

  const rows = [];
  const weekKeys = Object.keys(weeks).sort((a, b) =>
    sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
  );

  weekKeys.forEach(weekKey => {
    const weekWorkouts = weeks[weekKey];

    // Compute weekly summary
    const completed = weekWorkouts.filter(w => w.status === 'completed');
    const runs = completed.filter(w => w.type === 'run');
    const lifts = completed.filter(w => w.type === 'lift');
    const skipped = weekWorkouts.filter(w => w.status === 'skipped');

    const totalMiles = runs.reduce((s, w) => s + (w.details.actualDistance || 0), 0);
    const totalVolume = lifts.reduce((s, w) => s + (w.details.totalVolume || 0), 0);

    const allRpe = completed
      .map(w => w.details.rpe)
      .filter(r => r != null);
    const avgRpe = allRpe.length > 0
      ? Math.round(allRpe.reduce((a, b) => a + b, 0) / allRpe.length * 10) / 10
      : null;

    // Week label from date range
    const dates = weekWorkouts.map(w => w.date).sort();
    const startDate = formatDate(dates[0]);
    const endDate = formatDate(dates[dates.length - 1]);

    // Add summary row first (or last, depending on sort)
    const summaryRow = {
      isSummary: true,
      label: `Week of ${startDate}`,
      workoutCount: weekWorkouts.length,
      runCount: runs.length,
      liftCount: lifts.length,
      skippedCount: skipped.length,
      totalMiles,
      totalVolume,
      avgRpe,
    };

    // Add summary before workout rows
    rows.push(summaryRow);

    // Sort workouts within the week
    const sorted = [...weekWorkouts].sort((a, b) =>
      sortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );

    sorted.forEach(w => {
      rows.push({ isSummary: false, workout: w });
    });
  });

  return rows;
}

/**
 * Returns an ISO week string for grouping: "2026-W19"
 */
function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}