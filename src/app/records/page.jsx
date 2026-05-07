'use client';

import { useState, useMemo } from 'react';
import { formatDate } from '@/utils/runUtils';
import { getMuscleGroupColors } from '@/utils/liftUtils';
import { useWorkouts } from '@/lib/WorkoutContext';
import { ActivityIcon, PRIcon } from '@/utils/icons';
import { Footprints, Dumbbell, Trophy } from 'lucide-react';


export default function RecordsPage() {
  const [activeTab, setActiveTab] = useState('running');


// Inside the component:
  const { workouts, prs } = useWorkouts();

  const tabs = [
    { key: 'running', label: 'Running', count: prs.running.length, Icon: Footprints, color: 'text-activity-run' },
    { key: 'lifting', label: 'Lifting', count: prs.lifting.length, Icon: Dumbbell, color: 'text-activity-lift' },
  ];

  return (
    <div>
      <h2 className="stride-section-label">Personal Records</h2>

      {/* ── Tab Toggle ── */}
      <div className="flex gap-1.5 mb-6">
        {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                flex items-center gap-2
                ${activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'bg-surface text-secondary hover:text-primary'
                }
              `}
            >
              <tab.Icon size={16} strokeWidth={activeTab === tab.key ? 2.5 : 2} />
              {tab.label}
              <span className={`stride-data text-xs ${activeTab === tab.key ? 'text-white/70' : 'text-muted'}`}>
                {tab.count}
              </span>
            </button>
          ))}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* RUNNING RECORDS */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'running' && (
        <div>
          {prs.running.length > 0 ? (
            <div>
              {/* Group by category */}
              <PRGroup
                title="Fastest Pace by Run Type"
                prs={prs.running.filter(p => p.category === 'pace')}
                accentColor="text-activity-run"
              />
              <PRGroup
                title="Records by Distance"
                prs={prs.running.filter(p => p.category === 'distance-bracket')}
                accentColor="text-phase-taper"
              />
              <PRGroup
                title="Overall Records"
                prs={prs.running.filter(p => p.category === 'distance' || p.category === 'performance')}
                accentColor="text-phase-peak"
              />
            </div>
          ) : (
            <EmptyState type="running" />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* LIFTING RECORDS */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'lifting' && (
        <div>
          {prs.lifting.length > 0 ? (
            <div>
              <PRGroup
                title="Estimated 1RM by Exercise"
                prs={prs.lifting.filter(p => p.category === 'e1rm')}
                accentColor="text-activity-lift"
                showMuscleGroup
              />
              <PRGroup
                title="Session Records"
                prs={prs.lifting.filter(p => p.category === 'volume' || p.category === 'set')}
                accentColor="text-phase-build"
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


// ─── PR Group Section ─────────────────────────────────

function PRGroup({ title, prs, accentColor, showMuscleGroup = false }) {
  if (prs.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="stride-section-label">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prs.map(pr => (
          <PRCard key={pr.id} pr={pr} accentColor={accentColor} showMuscleGroup={showMuscleGroup} />
        ))}
      </div>
    </div>
  );
}


// ─── PR Card ──────────────────────────────────────────

function PRCard({ pr, accentColor, showMuscleGroup }) {
  const mgColors = showMuscleGroup && pr.muscleGroup
    ? getMuscleGroupColors(pr.muscleGroup)
    : null;

  return (
    <div className={`
      stride-card stride-accent-left p-4
      ${pr.sport === 'run' ? 'border-activity-run' : 'border-activity-lift'}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
              <ActivityIcon type={pr.sport === 'run' ? 'run' : 'lift'} size={16} />
            </div>
            <span className="text-sm font-semibold text-primary">{pr.label}</span>
          </div>

          {/* Value */}
          <p className={`stride-data text-xl font-bold ${accentColor} mb-1`}>
            {pr.value}
          </p>

          {/* Detail */}
          <div className="flex items-center gap-2 flex-wrap">
            {pr.detail && (
              <span className="text-xs text-secondary">{pr.detail}</span>
            )}
            {showMuscleGroup && pr.muscleGroup && mgColors && (
              <span className={`stride-badge text-[10px] ${mgColors.bg} ${mgColors.text}`}>
                {pr.muscleGroup}
              </span>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="text-right flex-shrink-0 ml-3">
          <p className="text-xs text-muted">{formatDate(pr.date)}</p>
          <span className="stride-badge bg-status-done/20 text-status-done text-[10px] mt-1">
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
    <div className="stride-card p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mx-auto mb-3">
        <ActivityIcon type={type === 'running' ? 'run' : 'lift'} size={24} />
      </div>
      <p className="text-secondary text-sm">
        No {type} records yet. Complete more workouts to start setting PRs.
      </p>
      <p className="text-muted text-xs mt-2">
        {type === 'running'
          ? 'PRs are tracked by pace, distance, and performance index.'
          : 'PRs are tracked by estimated 1RM (Epley formula), heaviest set, and session volume.'
        }
      </p>
    </div>
  );
}