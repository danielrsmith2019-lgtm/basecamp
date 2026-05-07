'use client';

import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';
import { formatDate } from '@/utils/runUtils';
import { formatVolume } from '@/utils/liftUtils';

export default function Home() {
  const allWorkouts = [...sampleRunData, ...sampleLiftData]
    .sort((a, b) => b.date.localeCompare(a.date));

  const completedRuns = sampleRunData.filter(w => w.status === 'completed');
  const completedLifts = sampleLiftData.filter(w => w.status === 'completed');
  const plannedToday = allWorkouts.filter(w => {
    const today = new Date().toISOString().split('T')[0];
    return w.date === today && w.status === 'planned';
  });

  return (
    <div>
      <h2 className="stride-section-label">Dashboard</h2>

      {/* ── Today's Plan ── */}
      <div className="stride-card p-5 mb-6">
        <p className="text-xs text-muted uppercase tracking-wider mb-3">Today</p>
        {plannedToday.length > 0 ? (
          <div className="space-y-2">
            {plannedToday.map(w => (
              <div key={w.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{w.type === 'run' ? '🏃' : '🏋️'}</span>
                  <span className="text-primary text-sm font-medium">
                    {w.type === 'run' ? w.details.runDescription : w.details.sessionName}
                  </span>
                </div>
                <span className="stride-badge bg-status-planned/20 text-status-planned">
                  Planned
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-sm">No workouts scheduled for today.</p>
        )}
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stride-card p-4 text-center">
          <p className="stride-data text-2xl font-bold text-phase-base">
            {completedRuns.length}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted mt-1">Runs Done</p>
        </div>
        <div className="stride-card p-4 text-center">
          <p className="stride-data text-2xl font-bold text-primary">
            {completedRuns.reduce((s, w) => s + (w.details.actualDistance || 0), 0).toFixed(1)}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted mt-1">Total Miles</p>
        </div>
        <div className="stride-card p-4 text-center">
          <p className="stride-data text-2xl font-bold text-activity-lift">
            {completedLifts.length}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted mt-1">Lifts Done</p>
        </div>
        <div className="stride-card p-4 text-center">
          <p className="stride-data text-2xl font-bold text-primary">
            {formatVolume(completedLifts.reduce((s, w) => s + (w.details.totalVolume || 0), 0))}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted mt-1">Total Volume</p>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <h2 className="stride-section-label">Recent Activity</h2>
      <div className="space-y-2">
        {allWorkouts.slice(0, 8).map(w => (
          <div
            key={w.id}
            className={`
              stride-card stride-accent-left p-3
              flex items-center justify-between
              ${w.type === 'run' ? 'border-activity-run' : 'border-activity-lift'}
            `}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{w.type === 'run' ? '🏃' : '🏋️'}</span>
              <div>
                <p className="text-sm font-medium text-primary">
                  {w.type === 'run' ? w.details.runType : w.details.sessionName}
                </p>
                <p className="text-xs text-secondary">{formatDate(w.date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {w.type === 'run' && w.details.actualDistance && (
                <span className="stride-data text-sm text-secondary">
                  {w.details.actualDistance} mi
                </span>
              )}
              {w.type === 'run' && w.details.actualPace && (
                <span className="stride-data text-sm text-primary">
                  {w.details.actualPace}
                </span>
              )}
              {w.type === 'lift' && w.details.totalVolume && (
                <span className="stride-data text-sm text-primary">
                  {formatVolume(w.details.totalVolume)}
                </span>
              )}
              <span className={`
                stride-badge text-xs
                ${w.status === 'completed' ? 'bg-status-done/20 text-status-done' : ''}
                ${w.status === 'planned' ? 'bg-status-planned/20 text-status-planned' : ''}
                ${w.status === 'skipped' ? 'bg-status-skipped/20 text-status-skipped' : ''}
              `}>
                {w.status === 'completed' ? '✓' : w.status === 'planned' ? '—' : '✗'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}