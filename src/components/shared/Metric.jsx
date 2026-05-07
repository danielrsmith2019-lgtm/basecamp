'use client';

/**
 * Metric — Standardized numeric display component.
 * 
 * From the Style Manifest: "The unit is automatically 50% smaller and opacity-60."
 * All values render in tabular-nums monospace. Hierarchy via weight.
 * 
 * Sizes:
 *   'hero'  — 36pt, for dashboard hero tiles
 *   'lg'    — 24pt, for KPI cards
 *   'md'    — 18pt, for inline stats (default)
 *   'sm'    — 14pt, for table cells and compact views
 */

const SIZE_MAP = {
  hero: { value: 'text-4xl',  unit: 'text-lg',  label: 'text-xs' },
  lg:   { value: 'text-2xl',  unit: 'text-sm',  label: 'text-[10px]' },
  md:   { value: 'text-lg',   unit: 'text-xs',  label: 'text-[10px]' },
  sm:   { value: 'text-sm',   unit: 'text-[10px]', label: 'text-[9px]' },
};

export default function Metric({
  value,
  unit,
  label,
  size = 'md',
  color = 'text-primary',
  trend,         // 'up' | 'down' | 'flat' | null
  trendValue,    // "+12%" or "-0:05"
  className = '',
}) {
  const s = SIZE_MAP[size] || SIZE_MAP.md;

  const trendConfig = {
    up:   { icon: '↑', color: 'text-phase-base' },
    down: { icon: '↓', color: 'text-phase-peak' },
    flat: { icon: '→', color: 'text-secondary' },
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Label (above the value) */}
      {label && (
        <span className={`perf-header mb-1 ${s.label}`}>
          {label}
        </span>
      )}

      {/* Value + Unit */}
      <div className="flex items-baseline gap-1">
        <span className={`stride-data font-bold ${s.value} ${color}`}>
          {value}
        </span>
        {unit && (
          <span className={`stride-data ${s.unit} text-muted`}>
            {unit}
          </span>
        )}
      </div>

      {/* Trend indicator */}
      {trend && trendValue && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`stride-data text-xs font-semibold ${trendConfig[trend]?.color || 'text-muted'}`}>
            {trendConfig[trend]?.icon} {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}


/**
 * MetricRow — Horizontal layout of a label and metric value.
 * For use in detail modals and tables where space is constrained.
 */
export function MetricRow({ label, value, unit, color = 'text-primary' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`stride-data text-sm font-bold ${color}`}>{value}</span>
        {unit && <span className="stride-data text-[10px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}