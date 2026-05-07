'use client';

/**
 * TrainingLoadCard — Shows the composite training load score
 * with a 4-week sparkline and trend direction.
 */

import Sparkline from './Sparkline';

export default function TrainingLoadCard({ load }) {
  if (!load) return null;

  const trendConfig = {
    increasing: { icon: '↑', label: 'Increasing', color: 'text-phase-peak', sparkColor: '#FB923C' },
    decreasing: { icon: '↓', label: 'Decreasing', color: 'text-phase-build', sparkColor: '#60A5FA' },
    stable:     { icon: '→', label: 'Stable',     color: 'text-phase-base',  sparkColor: '#4ADE80' },
  };

  const trend = trendConfig[load.trend] || trendConfig.stable;

  return (
    <div className="glass-card p-4">
      <div className="relative z-10">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Training Load</p>

      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="stride-data text-2xl font-bold text-primary">{load.current}</span>
          <span className="text-xs text-muted">pts</span>
        </div>
        <Sparkline data={load.weeks} color={trend.sparkColor} width={70} height={24} />
      </div>

      <div className="flex items-center gap-2">
        <span className={`stride-data text-sm font-semibold ${trend.color}`}>
          {trend.icon} {load.changePercent > 0 ? '+' : ''}{load.changePercent}%
        </span>
        <span className="text-xs text-muted">vs last week</span>
      </div>

      <p className="text-[10px] text-muted mt-1">
        Run miles × 10 + lift volume / 100
      </p>
    </div> {/* close relative z-10 */}
    </div>
  );
}