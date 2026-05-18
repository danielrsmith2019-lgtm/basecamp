'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * ScheduleView — calendar grid on desktop, list view on mobile
 */
export default function ScheduleView({ days = [], onDayClick }) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState(isMobile ? 'list' : 'calendar');

  // Sync view mode when breakpoint changes
  // (kept simple: user can toggle, but default follows breakpoint)

  return (
    <div>
      {/* View toggle — visible on all screens */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background:
              viewMode === 'list'
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(255,255,255,0.04)',
            color: viewMode === 'list' ? '#22c55e' : 'rgba(255,255,255,0.5)',
            border:
              viewMode === 'list'
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid rgba(255,255,255,0.06)',
            minHeight: '44px',
          }}
        >
          List
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background:
              viewMode === 'calendar'
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(255,255,255,0.04)',
            color:
              viewMode === 'calendar' ? '#22c55e' : 'rgba(255,255,255,0.5)',
            border:
              viewMode === 'calendar'
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid rgba(255,255,255,0.06)',
            minHeight: '44px',
          }}
        >
          Calendar
        </button>
      </div>

      {viewMode === 'list' ? (
        <ScheduleList days={days} onDayClick={onDayClick} />
      ) : (
        <ScheduleCalendar days={days} onDayClick={onDayClick} />
      )}
    </div>
  );
}

function ScheduleList({ days, onDayClick }) {
  return (
    <div className="flex flex-col">
      {days.map((day, i) => (
        <button
          key={day.date || i}
          className="schedule-list-item text-left"
          onClick={() => onDayClick?.(day)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            minHeight: '44px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'transparent',
            border: 'none',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderBottomColor: 'rgba(255,255,255,0.06)',
            width: '100%',
            cursor: 'pointer',
          }}
        >
          {/* Day indicator */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{
              background: day.isToday
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(255,255,255,0.04)',
              color: day.isToday ? '#22c55e' : 'rgba(255,255,255,0.7)',
            }}
          >
            {day.shortLabel || day.dayNum}
          </div>

          {/* Workout info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {day.workout || 'Rest Day'}
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {day.details || 'No workout scheduled'}
            </p>
          </div>

          {/* Type badge */}
          {day.type && (
            <span
              className="flex-shrink-0 text-xs px-2 py-1 rounded-md font-medium"
              style={{
                background: getTypeBg(day.type),
                color: getTypeColor(day.type),
              }}
            >
              {day.type}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ScheduleCalendar({ days, onDayClick }) {
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="schedule-calendar">
      {/* Day headers — hidden on mobile via CSS */}
      {dayHeaders.map((d) => (
        <div
          key={d}
          className="day-header text-center text-xs font-medium py-2"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {d}
        </div>
      ))}

      {/* Day cells */}
      {days.map((day, i) => (
        <button
          key={day.date || i}
          onClick={() => onDayClick?.(day)}
          className="rounded-xl p-3 text-left transition-colors"
          style={{
            background: day.isToday
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(255,255,255,0.02)',
            border: day.isToday
              ? '1px solid rgba(34,197,94,0.2)'
              : '1px solid rgba(255,255,255,0.04)',
            minHeight: '80px',
            cursor: 'pointer',
          }}
        >
          <span
            className="text-xs font-medium"
            style={{
              color: day.isToday ? '#22c55e' : 'rgba(255,255,255,0.5)',
            }}
          >
            {day.dayNum}
          </span>
          {day.workout && (
            <p className="text-xs mt-1 text-white truncate">{day.workout}</p>
          )}
        </button>
      ))}
    </div>
  );
}

/* Helpers */
function getTypeBg(type) {
  const map = {
    run: 'rgba(59,130,246,0.12)',
    lift: 'rgba(249,115,22,0.12)',
    cardio: 'rgba(168,85,247,0.12)',
    rest: 'rgba(255,255,255,0.04)',
  };
  return map[type?.toLowerCase()] || 'rgba(255,255,255,0.04)';
}

function getTypeColor(type) {
  const map = {
    run: '#60a5fa',
    lift: '#fb923c',
    cardio: '#c084fc',
    rest: 'rgba(255,255,255,0.4)',
  };
  return map[type?.toLowerCase()] || 'rgba(255,255,255,0.5)';
}