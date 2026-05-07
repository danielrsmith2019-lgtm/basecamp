'use client';

import { useState, useMemo } from 'react';
import DayTimeline from '@/components/shared/DayTimeline';
import CalendarView from '@/components/shared/CalendarView';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import LogForm from '@/components/shared/LogForm';
import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';
import { createWorkout } from '@/data/types';

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState('list');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Workout state — starts from sample data, updates in memory on save
  const [workouts, setWorkouts] = useState(() => {
    return [...sampleRunData, ...sampleLiftData].filter(w => w != null);
  });

  // Apply type filter
  const filteredWorkouts = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    if (typeFilter === 'all') return sorted;
    return sorted.filter(w => w.type === typeFilter);
  }, [workouts, typeFilter]);

  // Group by date for list view
  const groupedByDate = useMemo(() => {
    const map = {};
    filteredWorkouts.forEach(w => {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredWorkouts]);

  // Stats
  const stats = useMemo(() => ({
    total: workouts.length,
    runs:  workouts.filter(w => w.type === 'run').length,
    lifts: workouts.filter(w => w.type === 'lift').length,
    rest:  workouts.filter(w => w.type === 'rest').length,
  }), [workouts]);

  // Handle save from LogForm (via detail modal or new workout)
  function handleSave(data) {
    setWorkouts(prev => {
      // If updating an existing workout
      if (data.id) {
        return prev.map(w => {
          if (w.id !== data.id) return w;
          return {
            ...w,
            ...data,
            status: data.status || 'completed',
            updatedAt: new Date().toISOString(),
          };
        });
      }

      // New workout
      const newWorkout = createWorkout({
        date: data.date,
        type: data.type,
        status: 'completed',
        details: data.details,
      });
      return [...prev, newWorkout];
    });

    setSelectedWorkout(null);
    setShowNewForm(false);
  }

  const FILTERS = [
    { key: 'all',  label: 'All',   count: stats.total },
    { key: 'run',  label: 'Runs',  count: stats.runs },
    { key: 'lift', label: 'Lifts', count: stats.lifts },
    { key: 'rest', label: 'Rest',  count: stats.rest },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="stride-section-label mb-0">Training Schedule</h2>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 bg-accent text-white text-xs font-medium
                     rounded-lg hover:brightness-110 transition-all"
        >
          + Log Workout
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
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
              <span className={`ml-1.5 stride-data ${typeFilter === f.key ? 'text-white/70' : 'text-muted'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex bg-surface rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${viewMode === 'calendar' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-5">
          {groupedByDate.length > 0 ? (
            groupedByDate.map(([date, dayWorkouts]) => (
              <DayTimeline
                key={date}
                date={date}
                workouts={dayWorkouts}
                onWorkoutClick={setSelectedWorkout}
              />
            ))
          ) : (
            <div className="stride-card p-8 text-center">
              <p className="text-secondary">No workouts match your filter.</p>
              <button onClick={() => setTypeFilter('all')} className="text-accent text-sm mt-2 hover:underline">
                Show all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarView workouts={filteredWorkouts} onWorkoutClick={setSelectedWorkout} />
      )}

      {/* Detail Modal (with LogForm integration) */}
      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onSave={handleSave}
      />

      {/* New Workout Form */}
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