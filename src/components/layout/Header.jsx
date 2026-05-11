'use client';

/**
 * Header — BASECAMP wordmark + combined training stats.
 * Stats use the STRIDE pattern: font-mono numbers, uppercase labels.
 */
import LogoutButton from '@/components/shared/LogoutButton';
import { useMemo } from 'react';

export default function Header({ workouts = [] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().split('T')[0];

    const completedRuns = workouts.filter(w => w.type === 'run' && w.status === 'completed');
    const completedLifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');
    const liftsThisWeek = completedLifts.filter(w => w.date >= weekAgoISO);

    // Total miles
    const totalMiles = completedRuns.reduce(
      (sum, w) => sum + (w.details.actualDistance || 0), 0
    );

    // Average pace
    let avgPace = '--:--';
    const runsWithPace = completedRuns.filter(w => w.details.actualPace);
    if (runsWithPace.length > 0) {
      const totalPaceMinutes = runsWithPace.reduce((sum, w) => {
        const parts = w.details.actualPace.split(':');
        return sum + parseInt(parts[0]) + parseInt(parts[1]) / 60;
      }, 0);
      const avg = totalPaceMinutes / runsWithPace.length;
      const mins = Math.floor(avg);
      const secs = Math.round((avg - mins) * 60);
      avgPace = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Total lift volume
    const totalVolume = completedLifts.reduce(
      (sum, w) => sum + (w.details.totalVolume || 0), 0
    );

    return {
      totalMiles: totalMiles.toFixed(1),
      avgPace,
      liftsThisWeek: liftsThisWeek.length,
      totalVolume: totalVolume.toLocaleString(),
    };
  }, [workouts]);

  return (
    <header className="border-b px-4 md:px-6 h-14
                        flex items-center justify-between
                        fixed top-0 left-0 right-0 z-40"
            style={{
              background: 'oklch(0.12 0.01 260 / 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}>
      {/* ── Wordmark ── */}
      <h1 className="text-lg font-bold tracking-tight">
        <span className="text-accent">BASE</span>
        <span className="text-primary">CAMP</span>
      </h1>

      {/* ── Stats Bar ── */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Miles */}
        <div className="flex items-center gap-1.5">
          <span className="stride-data text-sm font-bold text-primary">
            {stats.totalMiles}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">mi</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Avg Pace */}
        <div className="flex items-center gap-1.5">
          <span className="stride-data text-sm font-bold text-primary">
            {stats.avgPace}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">avg</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Lifts This Week */}
        <div className="flex items-center gap-1.5">
          <span className="stride-data text-sm font-bold text-primary">
            {stats.liftsThisWeek}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">lifts/wk</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <span className="stride-data text-sm font-bold text-primary">
            {stats.totalVolume}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">lbs</span>
        </div>
      </div>

      <LogoutButton />
    </header>
  );
}