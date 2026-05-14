'use client';

/**
 * SetLogger — Row-by-row set entry for a single exercise.
 * Ported from the Fitness App's exercise logger.
 * Numbers rendered in font-mono per STRIDE design contract.
 */

import { useState } from 'react';

export default function SetLogger({ exercise, onChange }) {
  const { name, muscleGroup, sets: rawSets = [] } = exercise;
  const sets = Array.isArray(rawSets) ? rawSets : [];

  function updateSet(setIndex, field, value) {
    const updated = sets.map((s, i) => {
      if (i !== setIndex) return s;
      const numVal = field === 'completed' ? value : (value === '' ? null : Number(value));
      return { ...s, [field]: numVal };
    });
    onChange({ ...exercise, sets: updated });
  }

  function addSet() {
    const lastSet = sets[sets.length - 1];
    const newSet = {
      setNumber: sets.length + 1,
      targetWeight: null,
      targetReps: null,
      weight: lastSet?.weight || null,
      reps: lastSet?.reps || null,
      rpe: null,
      completed: false,
    };
    onChange({ ...exercise, sets: [...sets, newSet] });
  }

  function removeSet(setIndex) {
    const updated = sets
      .filter((_, i) => i !== setIndex)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    onChange({ ...exercise, sets: updated });
  }

  return (
    <div className="bc-skeleton rounded-[10px]-lg p-3">
      {/* Exercise header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-primary text-sm">{name}</span>
          <span className="text-xs text-muted ml-2">{muscleGroup}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem_1.5rem] gap-2 mb-1 px-1">
        <span className="text-xs text-muted uppercase text-center">Set</span>
        <span className="text-xs text-muted uppercase text-center">lbs</span>
        <span className="text-xs text-muted uppercase text-center">Reps</span>
        <span className="text-xs text-muted uppercase text-center">RPE</span>
        <span className="text-xs text-muted uppercase text-center">✓</span>
        <span></span>
      </div>

      {/* Set rows */}
      {sets.map((set, i) => (
        <div
          key={i}
          className={`
            grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem_1.5rem] gap-2 items-center mb-1.5
            ${set.completed ? 'opacity-100' : 'opacity-70'}
          `}
        >
          {/* Set number */}
          <span className="stride-data text-xs text-muted text-center">{set.setNumber}</span>

          {/* Weight */}
          <input
            type="number"
            value={set.weight ?? ''}
            onChange={(e) => updateSet(i, 'weight', e.target.value)}
            placeholder="—"
            className="bg-card border border-border rounded px-2 py-1.5
                       text-center stride-data text-sm text-primary
                       focus:outline-none focus:border-accent w-full
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          {/* Reps */}
          <input
            type="number"
            value={set.reps ?? ''}
            onChange={(e) => updateSet(i, 'reps', e.target.value)}
            placeholder="—"
            className="bg-card border border-border rounded px-2 py-1.5
                       text-center stride-data text-sm text-primary
                       focus:outline-none focus:border-accent w-full
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          {/* RPE */}
          <input
            type="number"
            min="1"
            max="10"
            value={set.rpe ?? ''}
            onChange={(e) => updateSet(i, 'rpe', e.target.value)}
            placeholder="—"
            className="bg-card border border-border rounded px-2 py-1.5
                       text-center stride-data text-sm text-secondary
                       focus:outline-none focus:border-accent w-full
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          {/* Completed checkbox */}
          <button
            onClick={() => updateSet(i, 'completed', !set.completed)}
            className={`
              w-6 h-6 rounded border flex items-center justify-center mx-auto
              transition-colors text-xs
              ${set.completed
                ? 'bg-status-done/20 border-status-done text-status-done'
                : 'border-border text-muted hover:border-secondary'
              }
            `}
          >
            {set.completed ? '✓' : ''}
          </button>

          {/* Remove set */}
          <button
            onClick={() => removeSet(i)}
            className="text-muted hover:text-status-skipped text-xs transition-colors"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add set button */}
      <button
        onClick={addSet}
        className="w-full mt-2 py-1.5 text-xs text-accent hover:text-primary
                   border border-dashed border-border hover:border-accent
                   rounded transition-colors"
      >
        + Add Set
      </button>
    </div>
  );
}