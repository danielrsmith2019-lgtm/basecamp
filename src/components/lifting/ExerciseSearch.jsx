'use client';

/**
 * ExerciseSearch — Searchable dropdown for the exercise database.
 * Ported from the Fitness App. Reskinned to STRIDE dark theme.
 */

import { useState, useRef, useEffect } from 'react';
import exerciseDatabase from '@/data/exerciseDatabase.json';
import { getMuscleGroupColors } from '@/utils/liftUtils';

export default function ExerciseSearch({ onSelect, placeholder = 'Search exercises...' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef(null);

  // Filter exercises by name, muscle group, or equipment
  const results = query.length > 0
    ? exerciseDatabase.filter(ex => {
        const q = query.toLowerCase();
        return (
          ex.name.toLowerCase().includes(q) ||
          ex.muscleGroup.toLowerCase().includes(q) ||
          ex.equipment.toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[highlightIndex]) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  function handleSelect(exercise) {
    onSelect(exercise);
    setQuery('');
    setIsOpen(false);
    setHighlightIndex(0);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => query.length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-card border border-border text-primary text-sm rounded-lg
                   px-3 py-2.5 focus:outline-none focus:border-accent
                   placeholder:text-muted"
      />

      {/* ── Dropdown Results ── */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border
                        rounded-lg shadow-modal z-50 max-h-64 overflow-auto">
          {results.map((exercise, i) => {
            const mgColors = getMuscleGroupColors(exercise.muscleGroup);
            return (
              <button
                key={exercise.name}
                onClick={() => handleSelect(exercise)}
                className={`
                  w-full text-left px-3 py-2.5 flex items-center justify-between
                  transition-colors border-b border-border last:border-b-0
                  ${i === highlightIndex ? 'bg-surface' : 'hover:bg-surface'}
                `}
              >
                <div>
                  <span className="text-sm text-primary">{exercise.name}</span>
                  <span className="text-xs text-muted ml-2">{exercise.equipment}</span>
                </div>
                <span className={`stride-badge text-xs ${mgColors.bg} ${mgColors.text}`}>
                  {exercise.muscleGroup}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length > 0 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border
                        rounded-lg shadow-modal z-50 px-3 py-4 text-center">
          <p className="text-sm text-secondary">No exercises match &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-muted mt-1">Try searching by muscle group or equipment</p>
        </div>
      )}
    </div>
  );
}