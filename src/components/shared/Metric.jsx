'use client';

/**
 * Metric — Standardized numeric display component.
 *
 * Uses bc-data (DM Sans, tabular-nums, 600 weight) — clean and minimal.
 * Use bc-data-mono explicitly only for pace/time values like 9:23/mi.
 *
 * Sizes:
 *   'hero'  — 32pt, dashboard hero tiles
 *   'lg'    — 22pt, KPI cards
 *   'md'    — 18pt, inline stats (default)
 *   'sm'    — 14pt, table cells / compact views
 */

const SIZE_MAP = {
  hero: { value: 'text-[32px]', unit: 'text-base',   label: 'text-xs' },
  lg:   { value: 'text-[22px]', unit: 'text-sm',     label: 'text-[10px]' },
  md:   { value: 'text-lg',     unit: 'text-xs',     label: 'text-[10px]' },
  sm:   { value: 'text-sm',     unit: 'text-[10px]', label: 'text-[9px]' },
};

export default function Metric({
  value,
  unit,
  label,
  size = 'md',
  color = 'text-primary',
  mono = false,        // set true only for pace/time e.g. "9:23/mi"
  trend,               // 'up' | 'down' | 'flat' | null
  trendValue,
  className = '',
}) {
  const s = SIZE_MAP[size] || SIZE_MAP.md;

  const dataClass = mono ? 'bc-data-mono' : 'bc-data';

  const trendConfig = {
    up:   { icon: '↑', color: 'text-bc-green-dark' },
    down: { icon: '↓', color: 'text-bc-red' },
    flat: { icon: '→', color: 'text-secondary' },
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className={`bc-caption uppercase tracking-wider mb-1 ${s.label}`}>
          {label}
        </span>
      )}

      <div className="flex items-baseline gap-1">
        <span className={`${dataClass} font-bold ${s.value} ${color}`}>
          {value}
        </span>
        {unit && (
          <span className={`bc-caption ${s.unit}`}>
            {unit}
          </span>
        )}
      </div>

      {trend && trendValue && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`bc-data text-xs font-semibold ${trendConfig[trend]?.color || 'text-secondary'}`}>
            {trendConfig[trend]?.icon} {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}


/**
 * MetricRow — Horizontal label + value for modals and tables.
 */
export function MetricRow({ label, value, unit, color = 'text-primary', mono = false }) {
  const dataClass = mono ? 'bc-data-mono' : 'bc-data';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-secondary">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`${dataClass} text-sm font-bold ${color}`}>{value}</span>
        {unit && <span className="bc-caption text-[10px]">{unit}</span>}
      </div>
    </div>
  );
}