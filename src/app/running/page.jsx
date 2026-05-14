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

  return (
    <div className="min-h-screen bg-canvas text-primary">

      {/* ── Header ── */}
      <header className="bc-header">
        <div className="flex items-center gap-3">
          <span className="bc-wordmark">BaseCamp</span>
          <span className="bc-caption hidden sm:inline">Running Components</span>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-6 pt-20 pb-10">

        {/* ── Tab toggle ── */}
        <div className="bc-tab-bar mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`bc-tab ${activeTab === tab.key ? 'bc-tab-active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'schedule' && (
          <div>
            <p className="bc-caption uppercase tracking-wider mb-3">Run Schedule</p>
            <RunSchedule
              workouts={sampleRunData}
              onRunClick={(w) => setSelectedRun(w)}
            />
          </div>
        )}

        {activeTab === 'paces' && (
          <div>
            <p className="bc-caption uppercase tracking-wider mb-3">Pace Reference</p>
            <PaceGuide />
          </div>
        )}
      </main>

      {/* ── Detail modal ── */}
      {selectedRun && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center
                     justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px]
                       shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-primary">
                {selectedRun.details.runType}
                <span className="bc-label font-normal ml-2">{selectedRun.date}</span>
              </h3>
              <button
                onClick={() => setSelectedRun(null)}
                className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                           text-secondary hover:text-primary text-lg transition-colors">
                ×
              </button>
            </div>
            <pre className="text-xs font-mono text-secondary bg-canvas rounded-[14px] p-4 overflow-auto">
              {JSON.stringify(selectedRun, null, 2)}
            </pre>
            <p className="bc-caption mt-4">
              This will become the LogForm modal. For now it shows raw data to verify the model is correct.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}