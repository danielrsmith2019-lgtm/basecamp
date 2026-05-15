'use client';

import { useState, useMemo } from 'react';
import { formatDate } from '@/utils/runUtils';
import { getMuscleGroupColors } from '@/utils/liftUtils';
import { useWorkouts } from '@/lib/WorkoutContext';
import { ActivityIcon, PRIcon } from '@/utils/icons';
import { Footprints, Dumbbell, Trophy } from 'lucide-react';


export default function RecordsPage() {
  const [activeTab, setActiveTab] = useState('running');
  const { workouts, prs } = useWorkouts();

  const tabs = [
    { key: 'running', label: 'Running', count: prs.running.length, Icon: Footprints, color: 'text-run-accent' },
    { key: 'lifting', label: 'Lifting', count: prs.lifting.length, Icon: Dumbbell, color: 'text-lift-accent' },
  ];

  return (
    <div>
      <h2 className="bc-caption uppercase tracking-wider mb-4">Personal Records</h2>

      {/* ── Tab Toggle ── */}
      <div className="bc-tab-bar mb-6">
  {tabs.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={`bc-tab flex items-center gap-2 ${activeTab === tab.key ? 'bc-tab-active' : ''}`}>
      <tab.Icon size={16} strokeWidth={activeTab === tab.key ? 2.5 : 2} />
      {tab.label}
      <span
        className="bc-data text-xs"
        style={{ color: activeTab === tab.key ? 'rgba(255,255,255,0.75)' : '#AEAEB2' }}>
        {tab.count}
      </span>
    </button>
  ))}
</div>

      {/* ── Running Records ── */}
      {activeTab === 'running' && (
        <div>
          {prs.running.length > 0 ? (
            <div>
              <PRGroup
                title="Fastest Pace by Run Type"
                prs={prs.running.filter(p => p.category === 'pace')}
                accentColor="text-run-accent"
                sport="run"
              />
              <PRGroup
                title="Records by Distance"
                prs={prs.running.filter(p => p.category === 'distance-bracket')}
                accentColor="text-bc-teal-dark"
                sport="run"
              />
              <PRGroup
                title="Overall Records"
                prs={prs.running.filter(p => p.category === 'distance' || p.category === 'performance')}
                accentColor="text-bc-orange-dark"
                sport="run"
              />
            </div>
          ) : (
            <EmptyState type="running" />
          )}
        </div>
      )}

      {/* ── Lifting Records ── */}
      {activeTab === 'lifting' && (
        <div>
          {prs.lifting.length > 0 ? (
            <div>
              <PRGroup
                title="Estimated 1RM by Exercise"
                prs={prs.lifting.filter(p => p.category === 'e1rm')}
                accentColor="text-lift-accent"
                sport="lift"
                showMuscleGroup
              />
              <PRGroup
                title="Session Records"
                prs={prs.lifting.filter(p => p.category === 'volume' || p.category === 'set')}
                accentColor="text-bc-indigo-dark"
                sport="lift"
              />
            </div>
          ) : (
            <EmptyState type="lifting" />
          )}
        </div>
      )}
    </div>
  );
}


// ─── PR Group ─────────────────────────────────────────

function PRGroup({ title, prs, accentColor, sport, showMuscleGroup = false }) {
  if (prs.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="bc-caption uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prs.map(pr => (
          <PRCard key={pr.id} pr={pr} accentColor={accentColor} sport={sport} showMuscleGroup={showMuscleGroup} />
        ))}
      </div>
    </div>
  );
}


// ─── PR Card ──────────────────────────────────────────

function PRCard({ pr, accentColor, sport, showMuscleGroup }) {
  const mgColors = showMuscleGroup && pr.muscleGroup
    ? getMuscleGroupColors(pr.muscleGroup)
    : null;

  return (
    <div className={`bc-card border-l-4 p-4
      ${sport === 'run' ? 'border-run-accent' : 'border-lift-accent'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
              ${sport === 'run' ? 'bg-run-bg' : 'bg-lift-bg'}`}>
              <ActivityIcon type={sport === 'run' ? 'run' : 'lift'} size={16} />
            </div>
            <span className="text-sm font-semibold text-primary">{pr.label}</span>
          </div>

          {/* Value */}
          <p className={`bc-data text-xl font-bold ${accentColor} mb-1`}>
            {pr.value}
          </p>

          {/* Detail */}
          <div className="flex items-center gap-2 flex-wrap">
            {pr.detail && (
              <span className="text-xs text-secondary">{pr.detail}</span>
            )}
            {showMuscleGroup && pr.muscleGroup && mgColors && (
              <span className={`bc-pill text-[10px] ${mgColors.bg} ${mgColors.text}`}>
                {pr.muscleGroup}
              </span>
            )}
          </div>
        </div>

        {/* Date + PR badge */}
        <div className="text-right flex-shrink-0 ml-3">
          <p className="text-xs text-tertiary">{formatDate(pr.date)}</p>
          <span className="bc-pill bg-bc-green-light text-bc-green-dark text-[10px] mt-1">
            PR
          </span>
        </div>
      </div>
    </div>
  );
}


// ─── Empty State ──────────────────────────────────────

function EmptyState({ type }) {
  return (
    <div className="bc-card bc-empty">
      <div className={`bc-empty-icon w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3
        ${type === 'running' ? 'bg-run-bg' : 'bg-lift-bg'}`}>
        <ActivityIcon type={type === 'running' ? 'run' : 'lift'} size={24} />
      </div>
      <p className="bc-empty-title">No {type} records yet.</p>
      <p className="bc-empty-text">
        {type === 'running'
          ? 'Complete more runs to start setting PRs. Tracked by pace, distance, and performance index.'
          : 'Complete more lifts to start setting PRs. Tracked by estimated 1RM, heaviest set, and session volume.'
        }
      </p>
    </div>
  );
}