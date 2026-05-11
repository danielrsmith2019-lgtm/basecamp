// lib/database.js
// CRUD functions for all BaseCamp tables.
// Every function talks to Supabase and returns clean data.
//
// Pattern for every function:
//   1. Make the Supabase query
//   2. If there's an error, log it and return a safe default
//   3. Return just the data (not the Supabase wrapper object)
//
// Usage: import { getWorkouts, addWorkout } from '@/lib/database'
 
import { createClient } from '@/lib/supabase'
 
 
// ============================================================
// WORKOUTS
// ============================================================
 
/**
 * Get all workouts for a user, optionally filtered.
 * @param {string} userId
 * @param {object} filters - Optional: { type, status, startDate, endDate }
 * @returns {Array} Array of workout objects, or empty array on error
 */
export async function getWorkouts(userId, filters = {}) {
  const supabase = createClient()
 
  // Start building the query
  let query = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
 
  // Apply optional filters
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate)
  }
 
  const { data, error } = await query
 
  if (error) {
    console.error('Error fetching workouts:', error.message)
    return []
  }
 
  return data || []
}
 
/**
 * Add a new workout.
 * @param {string} userId
 * @param {object} workout - { date, type, status, details, notes }
 * @returns {object|null} The created workout, or null on error
 */
export async function addWorkout(userId, workout) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      date: workout.date,
      type: workout.type,
      status: workout.status || 'planned',
      details: workout.details || {},
      notes: workout.notes || null,
    })
    .select()        // Return the created row (with its generated id)
    .single()        // We inserted one row, so return an object not an array
 
  if (error) {
    console.error('Error adding workout:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Update an existing workout.
 * @param {string} id - The workout's UUID
 * @param {object} updates - Fields to update (e.g., { status: 'completed', details: {...} })
 * @returns {object|null} The updated workout, or null on error
 */
export async function updateWorkout(id, updates) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('workouts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
 
  if (error) {
    console.error('Error updating workout:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Delete a workout.
 * @param {string} id - The workout's UUID
 * @returns {boolean} true if deleted, false on error
 */
export async function deleteWorkout(id) {
  const supabase = createClient()
 
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
 
  if (error) {
    console.error('Error deleting workout:', error.message)
    return false
  }
 
  return true
}
 
/**
 * Add multiple workouts at once (used when activating a plan).
 * @param {string} userId
 * @param {Array} workouts - Array of workout objects
 * @returns {Array} Array of created workouts, or empty array on error
 */
export async function addWorkoutsBatch(userId, workouts) {
  const supabase = createClient()
 
  const rows = workouts.map(w => ({
    user_id: userId,
    date: w.date,
    type: w.type,
    status: w.status || 'planned',
    details: w.details || {},
    notes: w.notes || null,
  }))
 
  const { data, error } = await supabase
    .from('workouts')
    .insert(rows)
    .select()
 
  if (error) {
    console.error('Error batch adding workouts:', error.message)
    return []
  }
 
  return data || []
}
 
 
// ============================================================
// PLANS
// ============================================================
 
/**
 * Get the user's currently active plan.
 * @param {string} userId
 * @returns {object|null} The active plan, or null if none
 */
export async function getActivePlan(userId) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()
 
  if (error) {
    // "PGRST116" means no rows found — that's fine, user just has no active plan
    if (error.code === 'PGRST116') return null
    console.error('Error fetching active plan:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Get all plans for a user (active and archived).
 * @param {string} userId
 * @returns {Array} Array of plans
 */
export async function getAllPlans(userId) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
 
  if (error) {
    console.error('Error fetching plans:', error.message)
    return []
  }
 
  return data || []
}
 
/**
 * Save a new plan. Deactivates any existing active plan first.
 * @param {string} userId
 * @param {object} plan - { name, description, plan_type, plan_data, is_active }
 * @returns {object|null} The created plan, or null on error
 */
export async function savePlan(userId, plan) {
  const supabase = createClient()
 
  // If this plan is being activated, deactivate any existing active plan
  if (plan.is_active) {
    await supabase
      .from('plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
  }
 
  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: userId,
      name: plan.name,
      description: plan.description || null,
      plan_type: plan.plan_type || 'hybrid',
      plan_data: plan.plan_data || {},
      is_active: plan.is_active || false,
      progress: plan.progress || { completed: 0, total: 0 },
    })
    .select()
    .single()
 
  if (error) {
    console.error('Error saving plan:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Update an existing plan.
 * @param {string} id - The plan's UUID
 * @param {object} updates - Fields to update
 * @returns {object|null} The updated plan, or null on error
 */
export async function updatePlan(id, updates) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
 
  if (error) {
    console.error('Error updating plan:', error.message)
    return null
  }
 
  return data
}
 
 
// ============================================================
// NUTRITION LOGS
// ============================================================
 
/**
 * Get nutrition log for a specific date.
 * @param {string} userId
 * @param {string} date - YYYY-MM-DD
 * @returns {object|null} The nutrition log, or null if none exists
 */
export async function getNutritionLog(userId, date) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single()
 
  if (error) {
    if (error.code === 'PGRST116') return null  // No log for this date yet
    console.error('Error fetching nutrition log:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Get nutrition logs for a date range (for weekly charts).
 * @param {string} userId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Array of nutrition logs
 */
export async function getNutritionLogs(userId, startDate, endDate) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
 
  if (error) {
    console.error('Error fetching nutrition logs:', error.message)
    return []
  }
 
  return data || []
}
 
/**
 * Save or update a nutrition log for a specific date.
 * Uses "upsert" — inserts if no row exists, updates if one does.
 * @param {string} userId
 * @param {string} date - YYYY-MM-DD
 * @param {object} logData - { meals, daily_totals }
 * @returns {object|null} The saved log, or null on error
 */
export async function saveNutritionLog(userId, date, logData) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert(
      {
        user_id: userId,
        date: date,
        meals: logData.meals || [],
        daily_totals: logData.daily_totals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
      {
        // Tell Supabase which columns form the unique constraint
        // so it knows when to update vs insert
        onConflict: 'user_id,date',
      }
    )
    .select()
    .single()
 
  if (error) {
    console.error('Error saving nutrition log:', error.message)
    return null
  }
 
  return data
}
 
 
// ============================================================
// USER SETTINGS
// ============================================================
 
/**
 * Get settings for a user.
 * @param {string} userId
 * @returns {object|null} Settings object, or null if not found
 */
export async function getUserSettings(userId) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
 
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching user settings:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Update user settings. Creates the row if it doesn't exist.
 * @param {string} userId
 * @param {object} settings - Fields to update
 * @returns {object|null} The updated settings, or null on error
 */
export async function updateUserSettings(userId, settings) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        ...settings,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()
 
  if (error) {
    console.error('Error updating user settings:', error.message)
    return null
  }
 
  return data
}
 
 
// ============================================================
// PROFILES
// ============================================================
 
/**
 * Get a user's profile.
 * @param {string} userId
 * @returns {object|null} Profile object, or null if not found
 */
export async function getProfile(userId) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
 
  if (error) {
    console.error('Error fetching profile:', error.message)
    return null
  }
 
  return data
}
 
/**
 * Update a user's profile.
 * @param {string} userId
 * @param {object} updates - { display_name, avatar_url, fitness_goals }
 * @returns {object|null} The updated profile, or null on error
 */
export async function updateProfile(userId, updates) {
  const supabase = createClient()
 
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
 
  if (error) {
    console.error('Error updating profile:', error.message)
    return null
  }
 
  return data
}
 
 
// ============================================================
// FEEDBACK
// ============================================================
 
/**
 * Submit feedback from the in-app button.
 * @param {string} userId
 * @param {string} message - The feedback text
 * @param {string} page - Which page they were on
 * @returns {boolean} true if submitted, false on error
 */
export async function submitFeedback(userId, message, page) {
  const supabase = createClient()
 
  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId,
      message,
      page: page || null,
    })
 
  if (error) {
    console.error('Error submitting feedback:', error.message)
    return false
  }
 
  return true
}