'use client';

/**
 * WorkoutContext — Global state for all workout data.
 * 
 * One source of truth. Every page reads from here via useWorkouts().
 * Persists to localStorage automatically via storage.js.
 * Will swap to Supabase in Iteration 3 — same hook, different backend.
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  loadWorkouts,
  addWorkout as storageAdd,
  updateWorkout as storageUpdate,
  deleteWorkout as storageDelete,
  addWorkoutsBatch,
} from '@/utils/storage';
import { createWorkout } from '@/data/types';
import { detectAllPRs, findNewPRs } from '@/utils/prDetection';
import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const [workouts, setWorkouts] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newPR, setNewPR] = useState(null); // For celebration trigger

  // ── Load on mount (client only) ──
  useEffect(() => {
    const saved = loadWorkouts();

    if (saved.length > 0) {
      setWorkouts(saved);
    } else {
      // First ever load — seed with sample data
      const seed = [...sampleRunData, ...sampleLiftData].filter(w => w != null);
      addWorkoutsBatch(seed);
      setWorkouts(seed);
    }

    setIsLoaded(true);
  }, []);

  // ── Sync state → localStorage whenever workouts change ──
  useEffect(() => {
    if (!isLoaded) return; // Don't write on initial mount before load
    // Write the full array to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('basecamp_workouts', JSON.stringify(workouts));
    }
  }, [workouts, isLoaded]);

  // ── PRs (recomputed when workouts change) ──
  const prs = useMemo(() => {
    if (workouts.length === 0) return { running: [], lifting: [], recent: [] };
    return detectAllPRs(workouts);
  }, [workouts]);

  // ── Add a new workout ──
  const addNewWorkout = useCallback((data) => {
    const workout = data.id ? data : createWorkout({
      date: data.date,
      type: data.type,
      status: data.status || 'completed',
      planId: data.planId || null,
      details: data.details,
    });

    // PR detection: compare before and after
    const prsBefore = detectAllPRs(workouts);

    const updated = [...workouts, workout];
    setWorkouts(updated);

    // Check for new PRs
    const prsAfter = detectAllPRs(updated);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]); // Show the first new PR
    }

    return workout;
  }, [workouts]);

  // ── Update an existing workout (log a planned one, or edit a completed one) ──
  const saveWorkout = useCallback((data) => {
    if (!data.id) {
      return addNewWorkout(data);
    }

    // PR detection: compare before and after
    const prsBefore = detectAllPRs(workouts);

    const updated = workouts.map(w => {
      if (w.id !== data.id) return w;

      // Deep merge details
      const mergedDetails = { ...w.details, ...data.details };

      return {
        ...w,
        ...data,
        details: mergedDetails,
        status: data.status || 'completed',
        updatedAt: new Date().toISOString(),
      };
    });

    setWorkouts(updated);

    // Check for new PRs
    const prsAfter = detectAllPRs(updated);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]);
    }
  }, [workouts, addNewWorkout]);

  // ── Delete a workout ──
  const removeWorkout = useCallback((id) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
  }, []);

  // ── Clear the PR celebration ──
  const clearNewPR = useCallback(() => {
    setNewPR(null);
  }, []);

  // ── Reset to sample data (for testing) ──
  const resetToSampleData = useCallback(() => {
    const seed = [...sampleRunData, ...sampleLiftData].filter(w => w != null);
    setWorkouts(seed);
  }, []);

  // ── Context value ──
  const value = useMemo(() => ({
    workouts,
    prs,
    newPR,
    isLoaded,
    addNewWorkout,
    saveWorkout,
    removeWorkout,
    clearNewPR,
    resetToSampleData,
  }), [workouts, prs, newPR, isLoaded, addNewWorkout, saveWorkout, removeWorkout, clearNewPR, resetToSampleData]);

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

/**
 * Hook to access workout state from any component.
 * 
 * Usage:
 *   const { workouts, saveWorkout, prs } = useWorkouts();
 */
export function useWorkouts() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkouts must be used within a WorkoutProvider');
  }
  return context;
}