'use client';

/**
 * Header — BASECAMP wordmark + combined training stats.
 */

import LogoutButton from '@/components/shared/LogoutButton';
import { useMemo } from 'react';

export default function Header({ workouts = [] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().split('T')[0];

    const completedRuns  = workouts.filter(w => w.type === 'run'  && w.status === 'completed');
    const completedLifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
    const liftsThisWeek  = completedLifts.filter(w => w.date >= weekAgoISO);

    const totalMiles = completedRuns.reduce(
      (sum, w) => sum + (w.details.actualDistance || 0), 0
    );

    let avgPace = '--:--';
    const runsWithPace = completedRuns.filter(w => w.details.actualPace);
    if (runsWithPace.length > 0) {
      const totalPaceMinutes = runsWithPace.reduce((sum, w) => {
        const parts = w.details.actualPace.split(':');
        return sum + parseInt(parts[0]) + parseInt(parts[1]) / 60;
      }, 0);
      const avg  = totalPaceMinutes / runsWithPace.length;
      const mins = Math.floor(avg);
      const secs = Math.round((avg - mins) * 60);
      avgPace = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    const totalVolume = completedLifts.reduce(
      (sum, w) => sum + (w.details.totalVolume || 0), 0
    );

    return {
      totalMiles:    totalMiles.toFixed(1),
      avgPace,
      liftsThisWeek: liftsThisWeek.length,
      totalVolume:   totalVolume.toLocaleString(),
    };
  }, [workouts]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-14
                 flex items-center justify-between
                 px-4 md:px-6 border-b border-border"
      style={{
        background:           'rgba(255, 255, 255, 0.88)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>

      {/* ── Wordmark ── */}
      <span className="bc-wordmark flex items-baseline gap-0 flex-shrink-0">
        <span style={{ color: '#007AFF', fontWeight: 800, letterSpacing: '-0.03em' }}>Base</span>
        <span style={{ color: '#1C1C1E', fontWeight: 700, letterSpacing: '-0.02em' }}>Camp</span>
      </span>

      {/* ── Stats Bar (hidden on mobile) ── */}
      <div className="hidden sm:flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="bc-data text-sm font-bold text-run-accent">{stats.totalMiles}</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary">mi</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="bc-data text-sm font-bold text-primary">{stats.avgPace}</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary">avg</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="bc-data text-sm font-bold text-lift-accent">{stats.liftsThisWeek}</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary">lifts/wk</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="bc-data text-sm font-bold text-lift-accent">{stats.totalVolume}</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary">lbs</span>
        </div>
      </div>

      <LogoutButton />
    </header>
  );
}