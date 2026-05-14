'use client';

/**
 * CalendarView — Monthly grid showing workout tags per day.
 * Extended from STRIDE's calendar to include lift sessions.
 */

import { useState, useMemo } from 'react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ workouts, onWorkoutClick }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const dates = workouts.map(w => w.date).sort();
    if (dates.length > 0) {
      const d = new Date(dates[0] + 'T00:00:00');
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr });
    }
    return days;
  }, [currentMonth]);

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
      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 text-secondary hover:text-primary hover:bg-canvas
                     rounded-[10px] transition-colors text-sm">
          ← Prev
        </button>
        <h3 className="text-base font-semibold text-primary">{monthLabel}</h3>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 text-secondary hover:text-primary hover:bg-canvas
                     rounded-[10px] transition-colors text-sm">
          Next →
        </button>
      </div>

      {/* ── Day name headers ── */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(day => (
          <div key={day} className="text-center text-[10px] uppercase tracking-wider text-tertiary py-1">
            {day}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          if (!day.date) {
            return <div key={`pad-${i}`} className="min-h-[5rem]" />;
          }

          const dayWorkouts = workoutsByDate[day.date] || [];
          const isToday = day.date === today;
          const dayNum = new Date(day.date + 'T00:00:00').getDate();
          const hasCompleted = dayWorkouts.some(w => w.status === 'completed');

          return (
            <div
              key={day.date}
              className={`min-h-[5rem] rounded-[14px] p-1.5 border transition-colors
                ${isToday
                  ? 'border-bc-blue/50 bg-bc-blue-light/30'
                  : 'border-border bg-surface'}
                ${dayWorkouts.length > 0 ? 'hover:border-border-strong cursor-pointer' : ''}`}>

              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold
                  ${isToday ? 'text-bc-blue' : 'text-secondary'}`}>
                  {dayNum}
                </span>
                {hasCompleted && (
                  <span className="w-1.5 h-1.5 rounded-full bg-bc-green" />
                )}
              </div>

              {/* Workout tags */}
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
          <div className="w-2.5 h-2.5 rounded-sm bg-run-accent" />
          <span className="text-xs text-tertiary">Run</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-lift-accent" />
          <span className="text-xs text-tertiary">Lift</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rest-accent" />
          <span className="text-xs text-tertiary">Rest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-bc-green" />
          <span className="text-xs text-tertiary">Done</span>
        </div>
      </div>
    </div>
  );
}


// ── Workout tag (compact label inside calendar cell) ──

function WorkoutTag({ workout, onClick }) {
  const { type, status, details } = workout;

  let label = '';
  let bg = '';
  let color = '';

  if (type === 'run') {
    const dist = details.plannedDistance || '';
    const rt = details.runType === 'REST' ? 'Rest' : (details.runType || '').slice(0, 4);
    label = `${dist}mi ${rt}`.trim();

    if (status === 'completed') { bg = '#E8F5E9'; color = '#2E7D32'; }
    else if (status === 'skipped') { bg = '#FFEBEE'; color = '#C62828'; }
    else { bg = '#F2F2F7'; color = '#8E8E93'; }

  } else if (type === 'lift') {
    label = details.sessionName || 'Lift';

    if (status === 'completed') { bg = '#E3F2FD'; color = '#1565C0'; }
    else if (status === 'skipped') { bg = '#FFEBEE'; color = '#C62828'; }
    else { bg = '#F2F2F7'; color = '#8E8E93'; }

  } else if (type === 'rest') {
    label = 'Rest';
    bg = '#F3E5F5'; color = '#7B1FA2';
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`w-full text-left px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium
                  truncate transition-all hover:opacity-80
                  ${status === 'skipped' ? 'line-through opacity-60' : ''}`}
      style={{ backgroundColor: bg, color }}>
      {label}
    </button>
  );
}