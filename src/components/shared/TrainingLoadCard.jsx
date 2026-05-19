'use client';

/**
 * TrainingLoadCard — Composite training load score
 * with 4-week sparkline and trend direction.
 */

import Sparkline from './Sparkline';

export default function TrainingLoadCard({ load }) {
  if (!load) return null;

  const trendConfig = {
    increasing: { icon: '↑', label: 'Increasing', color: '#FF9500', sparkColor: '#FF9500' },
    decreasing: { icon: '↓', label: 'Decreasing', color: '#007AFF', sparkColor: '#007AFF' },
    stable:     { icon: '→', label: 'Stable',     color: '#34C759', sparkColor: '#34C759' },
  };

  const trend = trendConfig[load.trend] || trendConfig.stable;

  return (
    <div className="bc-card p-4">
      <p className="bc-caption uppercase tracking-wider mb-2">Training Load</p>

      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-primary"
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {load.current}
          </span>
          <span className="text-xs text-tertiary">pts</span>
        </div>
        <Sparkline data={load.weeks} color={trend.sparkColor} width={70} height={24} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold"
          style={{ color: trend.color, fontVariantNumeric: 'tabular-nums' }}>
          {trend.icon} {load.changePercent > 0 ? '+' : ''}{load.changePercent}%
        </span>
        <span className="text-xs text-tertiary">vs last week</span>
      </div>

      <p className="bc-caption mt-1">
        Run miles × 10 + lift volume / 100
      </p>
    </div>
  );
}