'use client';

/**
 * WorkoutContext — Global state for all workout data.
 * 
 * One source of truth. Every page reads from here via useWorkouts().
 * Persists to Supabase. Includes adaptive plan engine.
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getWorkouts as dbGetWorkouts,
  addWorkout as dbAddWorkout,
  updateWorkout as dbUpdateWorkout,
  deleteWorkout as dbDeleteWorkout,
  addWorkoutsBatch as dbAddWorkoutsBatch,
} from '@/lib/database';
import { useAuth } from '@/lib/auth';
import { detectAllPRs, findNewPRs } from '@/utils/prDetection';
import { checkAdaptations, applyAdaptation } from '@/utils/adaptation';
import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newPR, setNewPR] = useState(null);
  const [error, setError] = useState(null);
  const [adaptations, setAdaptations] = useState([]);

  // ── Load workouts from Supabase when user is available ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWorkouts([]);
      setIsLoaded(true);
      return;
    }

    async function loadFromDatabase() {
      try {
        const data = await dbGetWorkouts(user.id);

        if (data.length > 0) {
          setWorkouts(data);
        } else {
          const seed = [...sampleRunData, ...sampleLiftData]
            .filter(w => w != null)
            .map(w => ({
              date: w.date,
              type: w.type,
              status: w.status || 'planned',
              details: w.details || {},
              notes: w.notes || null,
            }));

          const created = await dbAddWorkoutsBatch(user.id, seed);
          setWorkouts(created.length > 0 ? created : []);
        }
      } catch (err) {
        console.error('Failed to load workouts:', err);
        setError('Failed to load workouts. Please refresh.');
      } finally {
        setIsLoaded(true);
      }
    }

    loadFromDatabase();
  }, [user, authLoading]);

  // ── PRs (recomputed when workouts change) ──
  const prs = useMemo(() => {
    if (workouts.length === 0) return { running: [], lifting: [], recent: [] };
    return detectAllPRs(workouts);
  }, [workouts]);

  // ── Reload workouts from database ──
  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    setIsLoaded(false);
    const data = await dbGetWorkouts(user.id);
    setWorkouts(data || []);
    setIsLoaded(true);
  }, [user]);

  // ── Run adaptation engine ──
  const runAdaptations = useCallback(() => {
    if (workouts.length < 3) return;
    const results = checkAdaptations(workouts);
    setAdaptations(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newOnes = results.filter(r => !existingIds.has(r.id));
      return [...prev.filter(a => a.status === 'pending'), ...newOnes];
    });
  }, [workouts]);

  // ── Run adaptations when workouts first load ──
  useEffect(() => {
    if (isLoaded && workouts.length > 3) {
      runAdaptations();
    }
  }, [isLoaded]);

  // ── Add a new workout ──
  const addNewWorkout = useCallback(async (data) => {
    if (!user) return null;

    const prsBefore = detectAllPRs(workouts);

    const created = await dbAddWorkout(user.id, {
      date: data.date,
      type: data.type,
      status: data.status || 'completed',
      details: data.details || {},
      notes: data.notes || null,
    });

    if (!created) {
      setError('Failed to save workout. Please try again.');
      return null;
    }

    const updated = [...workouts, created];
    setWorkouts(updated);

    const prsAfter = detectAllPRs(updated);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]);
    }

    // Run adaptation engine after logging
    runAdaptations();

    return created;
  }, [user, workouts, runAdaptations]);

  // ── Update an existing workout (log a planned one, or edit) ──
  const saveWorkout = useCallback(async (data) => {
    if (!user) return;

    if (!data.id) {
      return addNewWorkout(data);
    }

    const prsBefore = detectAllPRs(workouts);

    const existing = workouts.find(w => w.id === data.id);
    const mergedDetails = { ...(existing?.details || {}), ...(data.details || {}) };

    const updated = await dbUpdateWorkout(data.id, {
      status: data.status || 'completed',
      details: mergedDetails,
      notes: data.notes || existing?.notes || null,
    });

    if (!updated) {
      setError('Failed to update workout. Please try again.');
      return;
    }

    const newWorkouts = workouts.map(w => w.id === data.id ? updated : w);
    setWorkouts(newWorkouts);

    const prsAfter = detectAllPRs(newWorkouts);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]);
    }

    // Run adaptation engine after logging
    runAdaptations();
  }, [user, workouts, addNewWorkout, runAdaptations]);

  // ── Delete a workout ──
  const removeWorkout = useCallback(async (id) => {
    const success = await dbDeleteWorkout(id);
    if (success) {
      setWorkouts(prev => prev.filter(w => w.id !== id));
    } else {
      setError('Failed to delete workout. Please try again.');
    }
  }, []);

  // ── Clear the PR celebration ──
  const clearNewPR = useCallback(() => {
    setNewPR(null);
  }, []);

  // ── Clear error ──
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ── Accept an adaptation ──
  const acceptAdaptation = useCallback(async (adaptation) => {
    const updates = applyAdaptation(adaptation, workouts);
    for (const update of updates) {
      await dbUpdateWorkout(update.id, { details: update.details });
    }
    setAdaptations(prev =>
      prev.map(a => a.id === adaptation.id ? { ...a, status: 'accepted' } : a)
    );
    await refreshWorkouts();
  }, [workouts, refreshWorkouts]);

  // ── Reject an adaptation ──
  const rejectAdaptation = useCallback((adaptation) => {
    setAdaptations(prev =>
      prev.map(a => a.id === adaptation.id ? { ...a, status: 'rejected' } : a)
    );
  }, []);

  // ── Reset to sample data (for testing) ──
  const resetToSampleData = useCallback(async () => {
    if (!user) return;

    for (const w of workouts) {
      await dbDeleteWorkout(w.id);
    }

    const seed = [...sampleRunData, ...sampleLiftData]
      .filter(w => w != null)
      .map(w => ({
        date: w.date,
        type: w.type,
        status: w.status || 'planned',
        details: w.details || {},
        notes: w.notes || null,
      }));

    const created = await dbAddWorkoutsBatch(user.id, seed);
    setWorkouts(created.length > 0 ? created : []);
  }, [user, workouts]);

  // ── Context value ──
  const value = useMemo(() => ({
    workouts,
    prs,
    newPR,
    isLoaded,
    error,
    adaptations,
    addNewWorkout,
    saveWorkout,
    removeWorkout,
    clearNewPR,
    clearError,
    refreshWorkouts,
    acceptAdaptation,
    rejectAdaptation,
    resetToSampleData,
  }), [workouts, prs, newPR, isLoaded, error, adaptations, addNewWorkout, saveWorkout, removeWorkout, clearNewPR, clearError, refreshWorkouts, acceptAdaptation, rejectAdaptation, resetToSampleData]);

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
 *   const { workouts, saveWorkout, prs, adaptations } = useWorkouts();
 */
export function useWorkouts() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkouts must be used within a WorkoutProvider');
  }
  return context;
}