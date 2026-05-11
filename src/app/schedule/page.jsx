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

  const today = new Date().toISOString().split('T')[0];

  const filteredWorkouts = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    if (typeFilter === 'all') return sorted;
    return sorted.filter(w => w.type === typeFilter);
  }, [workouts, typeFilter]);

  // Split into past and upcoming (today + future)
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
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted text-sm">Loading...</p></div>;
  }

  const FILTERS = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'run', label: 'Runs', count: stats.runs },
    { key: 'lift', label: 'Lifts', count: stats.lifts },
    { key: 'rest', label: 'Rest', count: stats.rest },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="stride-section-label mb-0">Training Schedule</h2>
        <button onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:brightness-110 transition-all">
          + Log Workout
        </button>
      </div>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${typeFilter === f.key ? 'bg-accent text-white' : 'bg-surface text-secondary hover:text-primary'}`}>
              {f.label} <span className={`ml-1.5 stride-data ${typeFilter === f.key ? 'text-white/70' : 'text-muted'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex bg-surface rounded-lg p-0.5">
          <button onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
            List
          </button>
          <button onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
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
                className="flex items-center gap-2 text-xs text-muted hover:text-secondary transition-colors mb-3"
              >
                {showPast ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showPast ? 'Hide' : 'Show'} past workouts
                <span className="stride-data text-[10px]">({pastDates.length} day{pastDates.length !== 1 ? 's' : ''})</span>
              </button>

              {showPast && (
                <div className="space-y-5 mb-6 pb-6 border-b border-gray-800">
                  {pastDates.map(([date, dayWorkouts]) => (
                    <DayTimeline key={date} date={date} workouts={dayWorkouts || []} onWorkoutClick={setSelectedWorkout} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Today & Upcoming ── */}
          <div className="space-y-5">
            {upcomingDates.length > 0 ? upcomingDates.map(([date, dayWorkouts]) => (
              <DayTimeline
                key={date}
                date={date}
                workouts={dayWorkouts || []}
                onWorkoutClick={setSelectedWorkout}
                isToday={date === today}
              />
            )) : (
              <div className="stride-card p-8 text-center">
                <p className="text-secondary">No upcoming workouts.</p>
                <p className="text-muted text-xs mt-1">Generate a plan or log a workout to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && <CalendarView workouts={filteredWorkouts} onWorkoutClick={setSelectedWorkout} />}

      <WorkoutDetailModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} onSave={handleSave} />
      {showNewForm && <LogForm workout={null} onSave={handleSave} onClose={() => setShowNewForm(false)} />}
    </div>
  );
}
