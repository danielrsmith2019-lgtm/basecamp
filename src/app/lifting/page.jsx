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
    <div className="min-h-screen bg-base text-primary">
      <header className="bg-card border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold">
          <span className="text-accent">BASE</span>CAMP
          <span className="text-muted text-sm font-normal ml-3">Lifting Components Test</span>
        </h1>
        <nav className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {activeTab === 'sessions' && (
          <div>
            <h2 className="stride-section-label">Lift Sessions</h2>
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

        {activeTab === 'logger' && (
          <div>
            <h2 className="stride-section-label">Exercise Search</h2>
            <div className="mb-6">
              <ExerciseSearch onSelect={handleExerciseSelect} />
              <p className="text-xs text-muted mt-2">
                Search by name, muscle group, or equipment. Select an exercise to open the set logger.
              </p>
            </div>

            {demoExercise && (
              <div>
                <h2 className="stride-section-label">Set Logger</h2>
                <SetLogger
                  exercise={demoExercise}
                  onChange={(updated) => setDemoExercise(updated)}
                />
                <div className="mt-4 stride-card p-4">
                  <p className="stride-section-label">Live Data</p>
                  <pre className="text-xs font-mono text-secondary overflow-auto">
                    {JSON.stringify(demoExercise, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!demoExercise && (
              <div className="stride-card p-8 text-center">
                <p className="text-secondary">Search and select an exercise above to start logging sets.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {selectedLift && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLift(null)}
        >
          <div
            className="bg-card border border-border rounded-card shadow-modal max-w-lg w-full
                       p-6 animate-modal-in max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                {selectedLift.details.sessionName} — {selectedLift.date}
              </h3>
              <button onClick={() => setSelectedLift(null)} className="text-muted hover:text-primary text-xl">×</button>
            </div>
            <pre className="text-xs font-mono text-secondary bg-base rounded-lg p-4 overflow-auto">
              {JSON.stringify(selectedLift, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}