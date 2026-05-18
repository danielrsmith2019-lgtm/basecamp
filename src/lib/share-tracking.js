/**
 * Share tracking — Supabase helpers for shared_count column.
 *
 * Requires running the migration in supabase-share-migration.sql first.
 */

import { createClient } from '@/lib/supabase';

/**
 * Increment shared_count for a workout.
 * Uses Supabase RPC for atomic increment.
 */
export async function incrementShareCount(workoutId) {
  const supabase = createClient();

  // Atomic increment via RPC or raw SQL
  const { data, error } = await supabase.rpc('increment_share_count', {
    workout_id: workoutId,
  });

  if (error) {
    // Fallback: read-modify-write (less safe but works without RPC)
    console.warn('RPC fallback for share count:', error.message);
    const { data: workout, error: fetchError } = await supabase
      .from('workouts')
      .select('shared_count')
      .eq('id', workoutId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('workouts')
      .update({ shared_count: (workout?.shared_count || 0) + 1 })
      .eq('id', workoutId);

    if (updateError) throw updateError;
  }

  return data;
}

/**
 * Get share count for a workout.
 */
export async function getShareCount(workoutId) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('workouts')
    .select('shared_count')
    .eq('id', workoutId)
    .single();

  if (error) throw error;
  return data?.shared_count || 0;
}