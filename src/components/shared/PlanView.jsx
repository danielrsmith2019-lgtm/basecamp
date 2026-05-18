'use client';

import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * PlanWeekGrid — 7-col on desktop, single-col on mobile
 */
export function PlanWeekGrid({ days = [], onDayClick }) {
  const isMobile = useIsMobile();

  return (
    <div className="plan-week-grid">
      {days.map((day, i) => (
        <button
          key={day.date || i}
          onClick={() => onDayClick?.(day)}
          className="text-left rounded-xl p-3 sm:p-4 transition-all"
          style={{
            background: day.isToday
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(255,255,255,0.02)',
            border: day.isToday
              ? '1px solid rgba(34,197,94,0.2)'
              : '1px solid rgba(255,255,255,0.04)',
            minHeight: isMobile ? '56px' : '100px',
            cursor: 'pointer',
            display: isMobile ? 'flex' : 'block',
            alignItems: isMobile ? 'center' : undefined,
            gap: isMobile ? '12px' : undefined,
          }}
        >
          <div
            className="text-xs font-medium flex-shrink-0"
            style={{
              color: day.isToday ? '#22c55e' : 'rgba(255,255,255,0.4)',
              minWidth: isMobile ? '40px' : undefined,
            }}
          >
            {day.dayName || day.shortLabel}
          </div>

          <div className={isMobile ? 'flex-1 min-w-0' : 'mt-2'}>
            {day.workout ? (
              <>
                <p className="text-sm font-medium text-white truncate">
                  {day.workout}
                </p>
                {day.details && (
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {day.details}
                  </p>
                )}
              </>
            ) : (
              <p
                className="text-xs"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Rest
              </p>
            )}
          </div>

          {day.type && isMobile && (
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

/**
 * InsightCardsGrid — 3-col desktop, 2-col tablet, 1-col mobile
 */
export function InsightCardsGrid({ children, className = '' }) {
  return (
    <div className={`insight-cards-grid ${className}`}>
      {children}
    </div>
  );
}

export function InsightCard({ title, body, icon, type = 'info' }) {
  const colors = {
    info: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', accent: '#60a5fa' },
    warning: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)', accent: '#fbbf24' },
    success: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)', accent: '#22c55e' },
    danger: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', accent: '#ef4444' },
  };

  const c = colors[type] || colors.info;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h4
            className="text-sm font-semibold mb-1"
            style={{ color: c.accent }}
          >
            {title}
          </h4>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            {body}
          </p>
        </div>
      </div>
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