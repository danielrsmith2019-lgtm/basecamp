'use client';

/**
 * KPIGrid — responsive dashboard card grid
 * Desktop: 4 columns | Tablet: 3 columns | Mobile: 2 columns
 * TMS widget always included as first card.
 */
export default function KPIGrid({ children, className = '' }) {
  return (
    <div className={`kpi-grid ${className}`}>
      {children}
    </div>
  );
}

/**
 * KPICard — single metric card with responsive sizing
 */
export function KPICard({
  label,
  value,
  unit = '',
  trend = null,
  trendDirection = 'up',
  icon = null,
  accent = false,
  className = '',
}) {
  const trendColor =
    trendDirection === 'up' ? 'text-green-400' : 'text-red-400';
  const trendArrow = trendDirection === 'up' ? '↑' : '↓';

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 transition-all ${className}`}
      style={{
        background: accent
          ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
          : 'rgba(255,255,255,0.03)',
        border: accent
          ? '1px solid rgba(34,197,94,0.2)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg opacity-70">{icon}</span>}
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl sm:text-3xl font-bold"
          style={{ color: accent ? '#22c55e' : '#ffffff' }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {unit}
          </span>
        )}
      </div>

      {trend !== null && (
        <div className={`mt-2 text-xs font-medium ${trendColor}`}>
          {trendArrow} {trend}
        </div>
      )}
    </div>
  );
}

/**
 * TMSCard — Total Multimodal Sessions widget (always included)
 */
export function TMSCard({ weeklyTMS = 0, target = 5, streak = 0 }) {
  const progress = Math.min((weeklyTMS / target) * 100, 100);

  return (
    <KPICard
      label="Weekly TMS"
      value={weeklyTMS}
      unit={`/ ${target}`}
      accent
      icon="⚡"
      className="col-span-2 sm:col-span-1"
    >
      <div className="mt-3">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #22c55e, #4ade80)',
            }}
          />
        </div>
        {streak > 0 && (
          <p
            className="text-xs mt-1.5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            🔥 {streak}-week streak
          </p>
        )}
      </div>
    </KPICard>
  );
}