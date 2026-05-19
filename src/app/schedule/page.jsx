'use client';

import { useState, useMemo } from 'react';
import DayTimeline from '@/components/shared/DayTimeline';
import CalendarView from '@/components/shared/CalendarView';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import LogForm from '@/components/shared/LogForm';
import { useWorkouts } from '@/lib/WorkoutContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SchedulePage() {
  const { workouts, saveWorkout, isLoaded } = useWorkouts();
  const [viewMode, setViewMode] = useState('list');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toLocaleDateString('en-CA');

  const filteredWorkouts = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    if (typeFilter === 'all') return sorted;
    return sorted.filter(w => w.type === typeFilter);
  }, [workouts, typeFilter]);

  const { pastDates, upcomingDates } = useMemo(() => {
    const map = {};
    filteredWorkouts.forEach(w => {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    });

    const allDates = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    const past = allDates.filter(([date]) => date < today);
    const upcoming = allDates.filter(([date]) => date >= today);

    return { pastDates: past, upcomingDates: upcoming };
  }, [filteredWorkouts, today]);

  const stats = useMemo(() => ({
    total: workouts.length,
    runs: workouts.filter(w => w.type === 'run').length,
    lifts: workouts.filter(w => w.type === 'lift').length,
    rest: workouts.filter(w => w.type === 'rest').length,
  }), [workouts]);

  function handleSave(data) {
    saveWorkout(data);
    setSelectedWorkout(null);
    setShowNewForm(false);
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  const FILTERS = [
    { key: 'all',  label: 'All',   count: stats.total },
    { key: 'run',  label: 'Runs',  count: stats.runs  },
    { key: 'lift', label: 'Lifts', count: stats.lifts },
    { key: 'rest', label: 'Rest',  count: stats.rest  },
  ];

  return (
    <div>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="bc-caption uppercase tracking-wider mb-0">Training Schedule</h2>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 bg-bc-blue text-primary text-xs font-semibold rounded-[10px]
                     hover:opacity-90 active:scale-95 transition-all">
          + Log Workout
        </button>
      </div>

      {/* ── Filters + view toggle ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">

        {/* Type filter tabs */}
        <div className="bc-tab-bar w-auto gap-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`bc-tab flex items-center gap-1.5 ${typeFilter === f.key ? 'bc-tab-active' : ''}`}>
              {f.label}
              <span
  className="bc-data text-[10px]"
  style={{ color: typeFilter === f.key ? 'rgba(255,255,255,0.75)' : '#AEAEB2' }}>
  {f.count}
</span>
            </button>
          ))}
        </div>

        {/* List / Calendar toggle */}
        <div className="bc-tab-bar w-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`bc-tab ${viewMode === 'list' ? 'bc-tab-active' : ''}`}>
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`bc-tab ${viewMode === 'calendar' ? 'bc-tab-active' : ''}`}>
            Calendar
          </button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div>
          {/* ── Past workouts (collapsed by default) ── */}
          {pastDates.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-xs text-tertiary hover:text-secondary transition-colors mb-3">
                {showPast ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showPast ? 'Hide' : 'Show'} past workouts
                <span className="bc-data text-[10px]">
                  ({pastDates.length} day{pastDates.length !== 1 ? 's' : ''})
                </span>
              </button>

              {showPast && (
                <div className="space-y-5 mb-6 pb-6 border-b border-border">
                  {pastDates.map(([date, dayWorkouts]) => (
                    <DayTimeline
                      key={date}
                      date={date}
                      workouts={dayWorkouts || []}
                      onWorkoutClick={setSelectedWorkout}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Today & Upcoming ── */}
          <div className="space-y-5">
            {upcomingDates.length > 0 ? (
              upcomingDates.map(([date, dayWorkouts]) => (
                <DayTimeline
                  key={date}
                  date={date}
                  workouts={dayWorkouts || []}
                  onWorkoutClick={setSelectedWorkout}
                  isToday={date === today}
                />
              ))
            ) : (
              <div className="bc-card bc-empty">
                <p className="bc-empty-title">No upcoming workouts.</p>
                <p className="bc-empty-text">Generate a plan or log a workout to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <CalendarView workouts={filteredWorkouts} onWorkoutClick={setSelectedWorkout} />
      )}

      <WorkoutDetailModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} onSave={handleSave} />
      {showNewForm && <LogForm workout={null} onSave={handleSave} onClose={() => setShowNewForm(false)} />}
    </div>
  );
}