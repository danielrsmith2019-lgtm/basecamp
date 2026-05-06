'use client';

/**
 * Test page for ported running components.
 * Temporary — this route gets removed once the unified schedule is built.
 */

import { useState } from 'react';
import RunSchedule from '@/components/running/RunSchedule';
import PaceGuide from '@/components/running/PaceGuide';
import sampleRunData from '@/data/sampleRunData';

export default function RunningTestPage() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedRun, setSelectedRun] = useState(null);

  const tabs = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'paces',    label: 'Pace Guide' },
  ];

  function handleRunClick(workout) {
    setSelectedRun(workout);
  }

  return (
    <div className="min-h-screen bg-base text-primary">
      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-accent">BASE</span>CAMP
              <span className="text-muted text-sm font-normal ml-3">Running Components Test</span>
            </h1>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <nav className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-primary hover:bg-surface'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-6 py-6">
        {activeTab === 'schedule' && (
          <div>
            <h2 className="stride-section-label">Run Schedule</h2>
            <RunSchedule
              workouts={sampleRunData}
              onRunClick={handleRunClick}
            />
          </div>
        )}

        {activeTab === 'paces' && (
          <div>
            <h2 className="stride-section-label">Pace Reference</h2>
            <PaceGuide />
          </div>
        )}
      </main>

      {/* ── Click Detail Modal (temporary — shows raw data) ── */}
      {selectedRun && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="bg-card border border-border rounded-card shadow-modal max-w-lg w-full
                       p-6 animate-modal-in max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                {selectedRun.details.runType} — {selectedRun.date}
              </h3>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-muted hover:text-primary text-xl leading-none"
              >
                ×
              </button>
            </div>
            <pre className="text-xs font-mono text-secondary bg-base rounded-lg p-4 overflow-auto">
              {JSON.stringify(selectedRun, null, 2)}
            </pre>
            <p className="text-xs text-muted mt-4">
              This will become the LogForm modal. For now it shows raw data to verify the model is correct.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}