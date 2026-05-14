'use client';

import { useState } from 'react';
import LiftCard from '@/components/lifting/LiftCard';
import ExerciseSearch from '@/components/lifting/ExerciseSearch';
import SetLogger from '@/components/lifting/SetLogger';
import sampleLiftData from '@/data/sampleLiftData';

export default function LiftingTestPage() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedLift, setSelectedLift] = useState(null);
  const [demoExercise, setDemoExercise] = useState(null);

  function handleExerciseSelect(exercise) {
    setDemoExercise({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      sets: [
        { setNumber: 1, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 2, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
        { setNumber: 3, targetWeight: null, targetReps: null, weight: null, reps: null, rpe: null, completed: false },
      ],
    });
  }

  const tabs = [
    { key: 'sessions', label: 'Sessions' },
    { key: 'logger',   label: 'Log Demo' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-primary">

      {/* ── Header ── */}
      <header className="bc-header">
        <div className="flex items-center gap-3">
          <span className="bc-wordmark">BaseCamp</span>
          <span className="bc-caption hidden sm:inline">Lifting Components</span>
        </div>
      </header>

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

        {/* ── Sessions tab ── */}
        {activeTab === 'sessions' && (
          <div>
            <p className="bc-caption uppercase tracking-wider mb-3">Lift Sessions</p>
            <div className="flex flex-col gap-3">
              {sampleLiftData.map(workout => (
                <LiftCard
                  key={workout.id}
                  workout={workout}
                  onClick={(w) => setSelectedLift(w)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Logger tab ── */}
        {activeTab === 'logger' && (
          <div>
            <p className="bc-caption uppercase tracking-wider mb-3">Exercise Search</p>
            <div className="mb-6">
              <ExerciseSearch onSelect={handleExerciseSelect} />
              <p className="bc-caption mt-2">
                Search by name, muscle group, or equipment. Select an exercise to open the set logger.
              </p>
            </div>

            {demoExercise ? (
              <div>
                <p className="bc-caption uppercase tracking-wider mb-3">Set Logger</p>
                <SetLogger
                  exercise={demoExercise}
                  onChange={(updated) => setDemoExercise(updated)}
                />
                <div className="bc-card mt-4">
                  <p className="bc-caption uppercase tracking-wider mb-3">Live Data</p>
                  <pre className="text-xs font-mono text-secondary overflow-auto">
                    {JSON.stringify(demoExercise, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bc-card bc-empty">
                <p className="bc-empty-title">No exercise selected.</p>
                <p className="bc-empty-text">
                  Search and select an exercise above to start logging sets.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Detail modal ── */}
      {selectedLift && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center
                     justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelectedLift(null)}
        >
          <div
            className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px]
                       shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-primary">
                {selectedLift.details.sessionName}
                <span className="bc-label font-normal ml-2">{selectedLift.date}</span>
              </h3>
              <button
                onClick={() => setSelectedLift(null)}
                className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                           text-secondary hover:text-primary text-lg transition-colors">
                ×
              </button>
            </div>
            <pre className="text-xs font-mono text-secondary bg-canvas rounded-[14px] p-4 overflow-auto">
              {JSON.stringify(selectedLift, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}