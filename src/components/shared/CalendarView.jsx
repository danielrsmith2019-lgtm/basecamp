'use client';

/**
 * CalendarView — Monthly grid showing workout tags per day.
 * Extended from STRIDE's calendar to include lift sessions.
 * Run tags = green/phase-colored. Lift tags = blue.
 */

import { useState, useMemo } from 'react';
import { getPhaseColors, getRunTypeEmoji } from '@/utils/runUtils';
import { getSessionEmoji } from '@/utils/liftUtils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ workouts, onWorkoutClick }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Start on a month that has data
    const dates = workouts.map(w => w.date).sort();
    if (dates.length > 0) {
      const d = new Date(dates[0] + 'T00:00:00');
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Build the calendar grid
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun

    const days = [];

    // Padding days from previous month
    for (let i = 0; i < startPad; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }

    // Days of the current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, isCurrentMonth: true });
    }

    return days;
  }, [currentMonth]);

  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    const map = {};
    workouts.forEach(w => {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    });
    return map;
  }, [workouts]);

  const monthLabel = new Date(currentMonth.year, currentMonth.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date().toISOString().split('T')[0];

  function prevMonth() {
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function nextMonth() {
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div>
      {/* ── Month Navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 text-secondary hover:text-primary hover:bg-surface
                     rounded-lg transition-colors text-sm"
        >
          ← Prev
        </button>
        <h3 className="text-base font-semibold text-primary">{monthLabel}</h3>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 text-secondary hover:text-primary hover:bg-surface
                     rounded-lg transition-colors text-sm"
        >
          Next →
        </button>
      </div>

      {/* ── Day Name Headers ── */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(day => (
          <div key={day} className="text-center text-[10px] uppercase tracking-wider text-muted py-1">
            {day}
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          if (!day.date) {
            return <div key={`pad-${i}`} className="min-h-[5rem]" />;
          }

          const dayWorkouts = workoutsByDate[day.date] || [];
          const isToday = day.date === today;
          const dayNum = new Date(day.date + 'T00:00:00').getDate();

          return (
            <div
              key={day.date}
              className={`
                min-h-[5rem] bg-card border rounded-lg p-1.5
                transition-colors
                ${isToday ? 'border-accent bg-accent/5' : 'border-border'}
                ${dayWorkouts.length > 0 ? 'hover:border-secondary cursor-pointer' : ''}
              `}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`
                  text-xs font-medium
                  ${isToday ? 'text-accent' : 'text-secondary'}
                `}>
                  {dayNum}
                </span>
                {/* Completion indicator */}
                {dayWorkouts.some(w => w.status === 'completed') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-status-done" />
                )}
              </div>

              {/* Workout Tags */}
              <div className="flex flex-col gap-0.5">
                {dayWorkouts.map(w => (
                  <WorkoutTag
                    key={w.id}
                    workout={w}
                    onClick={() => onWorkoutClick?.(w)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-activity-run" />
          <span className="text-xs text-muted">Run</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-activity-lift" />
          <span className="text-xs text-muted">Lift</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-activity-rest" />
          <span className="text-xs text-muted">Rest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-status-done" />
          <span className="text-xs text-muted">Done</span>
        </div>
      </div>
    </div>
  );
}


// ─── Workout Tag (compact label inside calendar cell) ──

function WorkoutTag({ workout, onClick }) {
  const { type, status, details } = workout;

  let label = '';
  let colorClasses = '';

  if (type === 'run') {
    const phaseColors = getPhaseColors(details.phase);
    label = `${details.plannedDistance || ''}mi ${details.runType === 'REST' ? 'Rest' : (details.runType || '').slice(0, 4)}`;
    colorClasses = status === 'completed'
      ? `${phaseColors.bg} ${phaseColors.text}`
      : status === 'skipped'
        ? 'bg-status-skipped/15 text-status-skipped'
        : 'bg-surface text-secondary';
  } else if (type === 'lift') {
    label = details.sessionName || 'Lift';
    colorClasses = status === 'completed'
      ? 'bg-activity-lift/20 text-activity-lift'
      : status === 'skipped'
        ? 'bg-status-skipped/15 text-status-skipped'
        : 'bg-surface text-secondary';
  } else if (type === 'rest') {
    label = 'Rest';
    colorClasses = 'bg-activity-rest/15 text-activity-rest';
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`
        w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium
        truncate transition-all hover:brightness-125
        ${colorClasses}
        ${status === 'completed' ? 'opacity-100' : ''}
        ${status === 'skipped' ? 'line-through opacity-60' : ''}
      `}
    >
      {label}
    </button>
  );
}