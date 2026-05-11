'use client';
 
/**
 * WorkoutContext — Global state for all workout data.
 * 
 * One source of truth. Every page reads from here via useWorkouts().
 * 
 * ITERATION 3 UPDATE: Now persists to Supabase instead of localStorage.
 * Same hook, same interface — every component works exactly as before.
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
import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';
 
const WorkoutContext = createContext(null);
 
export function WorkoutProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newPR, setNewPR] = useState(null);
  const [error, setError] = useState(null);
 
  // ── Load workouts from Supabase when user is available ──
  useEffect(() => {
    if (authLoading) return;       // Wait for auth to finish checking
    if (!user) {                   // Not logged in — clear state
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
          // First ever load for this user — seed with sample data
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
 
  // ── Add a new workout ──
  const addNewWorkout = useCallback(async (data) => {
    if (!user) return null;
 
    // PR detection: snapshot before
    const prsBefore = detectAllPRs(workouts);
 
    // Save to Supabase
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
 
    // Update local state with the Supabase-created workout (has real UUID)
    const updated = [...workouts, created];
    setWorkouts(updated);
 
    // Check for new PRs
    const prsAfter = detectAllPRs(updated);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]);
    }
 
    return created;
  }, [user, workouts]);
 
  // ── Update an existing workout (log a planned one, or edit) ──
  const saveWorkout = useCallback(async (data) => {
    if (!user) return;
 
    // If no id, it's a new workout
    if (!data.id) {
      return addNewWorkout(data);
    }
 
    // PR detection: snapshot before
    const prsBefore = detectAllPRs(workouts);
 
    // Find the existing workout to merge details
    const existing = workouts.find(w => w.id === data.id);
    const mergedDetails = { ...(existing?.details || {}), ...(data.details || {}) };
 
    // Save to Supabase
    const updated = await dbUpdateWorkout(data.id, {
      status: data.status || 'completed',
      details: mergedDetails,
      notes: data.notes || existing?.notes || null,
    });
 
    if (!updated) {
      setError('Failed to update workout. Please try again.');
      return;
    }
 
    // Update local state
    const newWorkouts = workouts.map(w => w.id === data.id ? updated : w);
    setWorkouts(newWorkouts);
 
    // Check for new PRs
    const prsAfter = detectAllPRs(newWorkouts);
    const newPRs = findNewPRs(prsBefore, prsAfter);
    if (newPRs.length > 0) {
      setNewPR(newPRs[0]);
    }
  }, [user, workouts, addNewWorkout]);
 
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

  // ── Reload workouts from database ──
  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    setIsLoaded(false);
    const data = await dbGetWorkouts(user.id);
    setWorkouts(data || []);
    setIsLoaded(true);
  }, [user]);
 
  // ── Reset to sample data (for testing) ──
  const resetToSampleData = useCallback(async () => {
    if (!user) return;
 
    // Delete all existing workouts for this user
    for (const w of workouts) {
      await dbDeleteWorkout(w.id);
    }
 
    // Re-seed with sample data
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
 
  // ── Context value (same shape as before + error handling) ──
  const value = useMemo(() => ({
    workouts,
    prs,
    newPR,
    isLoaded,
    error,
    addNewWorkout,
    saveWorkout,
    removeWorkout,
    clearNewPR,
    clearError,
    refreshWorkouts,
    resetToSampleData,
  }), [workouts, prs, newPR, isLoaded, error, addNewWorkout, saveWorkout, removeWorkout, clearNewPR, clearError, resetToSampleData]);
 
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