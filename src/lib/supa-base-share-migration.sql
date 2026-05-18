-- ============================================================
-- BaseCamp: Share Count Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add shared_count column to workouts table
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS shared_count integer DEFAULT 0;

-- 2. Create index for querying shared workouts
CREATE INDEX IF NOT EXISTS idx_workouts_shared_count
ON workouts (shared_count DESC)
WHERE shared_count > 0;

-- 3. Create atomic increment RPC function
CREATE OR REPLACE FUNCTION increment_share_count(workout_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workouts
  SET shared_count = COALESCE(shared_count, 0) + 1
  WHERE id = workout_id;
END;
$$;

-- 4. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_share_count(uuid) TO authenticated;

-- 5. RLS policy: users can only increment their own workouts
-- (The existing RLS on workouts table should handle this,
--  but the SECURITY DEFINER on the function bypasses RLS.
--  Add a check inside the function for safety.)
CREATE OR REPLACE FUNCTION increment_share_count(workout_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workouts
  SET shared_count = COALESCE(shared_count, 0) + 1
  WHERE id = workout_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout not found or unauthorized';
  END IF;
END;
$$;