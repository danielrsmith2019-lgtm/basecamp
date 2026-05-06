'use client';

/**
 * RunSchedule — Displays a filterable list of run workout cards.
 * Ported from STRIDE's Schedule.jsx (list view only).
 * Calendar view will be added in a later iteration.
 */

import { useState, useMemo } from 'react';
import RunCard from './RunCard';

export default function RunSchedule({ workouts, onRunClick }) {
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Extract only run workouts
  const runWorkouts = useMemo(() => {
    return workouts.filter(w => w.type === 'run');
  }, [workouts]);

  // Get unique phases for the filter dropdown
  const phases = useMemo(() => {
    const unique = [...new Set(
      runWorkouts.map(w => w.details.phase).filter(Boolean)
    )];
    return unique.sort();
  }, [runWorkouts]);

  // Apply filters
  const filteredRuns = useMemo(() => {
    return runWorkouts.filter(w => {
      if (phaseFilter !== 'all' && w.details.phase !== phaseFilter) return false;
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      return true;
    });
  }, [runWorkouts, phaseFilter, statusFilter]);

  // Stats for the filter bar
  const stats = useMemo(() => {
    const completed = runWorkouts.filter(w => w.status === 'completed');
    const totalDistance = completed.reduce((sum, w) => sum + (w.details.actualDistance || 0), 0);
    return {
      total:     runWorkouts.length,
      completed: completed.length,
      distance:  totalDistance.toFixed(1),
    };
  }, [runWorkouts]);

  return (
    <div>
      {/* ── Quick Stats Bar ── */}
      <div className="flex items-center gap-6 mb-6">
        <div className="stride-stat">
          <span className="stride-stat-value text-lg">{stats.completed}/{stats.total}</span>
          <span className="stride-stat-label">Runs</span>
        </div>
        <div className="h-8 w-px bg-border" /> {/* Vertical divider */}
        <div className="stride-stat">
          <span className="stride-stat-value text-lg">{stats.distance}</span>
          <span className="stride-stat-label">Miles</span>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Phase filter */}
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="bg-card border border-border text-primary text-sm rounded-lg
                     px-3 py-2 focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="all">All Phases</option>
          {phases.map(phase => (
            <option key={phase} value={phase}>
              {phase.replace(/Phase \d+: /, '')}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-border text-primary text-sm rounded-lg
                     px-3 py-2 focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="planned">Planned</option>
          <option value="skipped">Skipped</option>
        </select>

        {/* Result count */}
        <span className="text-sm text-muted ml-auto">
          {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Run Cards List ── */}
      <div className="flex flex-col gap-3">
        {filteredRuns.length > 0 ? (
          filteredRuns.map(workout => (
            <RunCard
              key={workout.id}
              workout={workout}
              onClick={onRunClick}
            />
          ))
        ) : (
          <div className="stride-card p-8 text-center">
            <p className="text-secondary">No runs match your filters.</p>
            <button
              onClick={() => { setPhaseFilter('all'); setStatusFilter('all'); }}
              className="text-accent text-sm mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}