/**
 * BASECAMP — Unified Data Model
 * 
 * Core design principle: one workout = one card = one database row.
 * A single day can have multiple workouts (e.g., morning run + evening lift).
 * Type-specific fields live inside the `details` object.
 * This maps to a JSONB column in Supabase (Iteration 3).
 * 
 * ─── DECISION LOG ────────────────────────────────────
 * - Run and lift are separate entries, not nested in one object.
 *   Reason: they render as separate cards, get logged independently,
 *   and this matches how the marathon tracker spreadsheet works.
 * - `details` is a flexible object, not a fixed schema.
 *   Reason: different workout types need different fields,
 *   and this maps cleanly to Supabase JSONB.
 * - Plans generate workout entries with status 'planned'.
 *   Reason: the schedule view just renders workouts — it doesn't
 *   need to know whether they came from a plan or manual entry.
 * ─────────────────────────────────────────────────────
 */


// ═══════════════════════════════════════════════════════
// WORKOUT TYPES
// ═══════════════════════════════════════════════════════

/**
 * @typedef {'run' | 'lift' | 'cardio' | 'rest' | 'other'} WorkoutType
 */

/**
 * @typedef {'planned' | 'completed' | 'skipped'} WorkoutStatus
 */


// ═══════════════════════════════════════════════════════
// THE CORE WORKOUT OBJECT
// ═══════════════════════════════════════════════════════

/**
 * Every entry in the app — whether it's a scheduled run, a completed lift,
 * a rest day, or a manual cardio session — is a Workout.
 * 
 * @typedef {Object} Workout
 * @property {string}        id        - Unique identifier (uuid in Supabase, incremented string for now)
 * @property {string}        date      - ISO date string: "2026-05-13"
 * @property {WorkoutType}   type      - "run" | "lift" | "cardio" | "rest" | "other"
 * @property {WorkoutStatus} status    - "planned" | "completed" | "skipped"
 * @property {string|null}   planId    - Links to the plan that generated this (null if manually added)
 * @property {RunDetails|LiftDetails|CardioDetails|RestDetails|null} details - Type-specific data
 * @property {string}        createdAt - ISO timestamp of when this entry was created
 * @property {string}        updatedAt - ISO timestamp of last modification
 */


// ═══════════════════════════════════════════════════════
// TYPE-SPECIFIC DETAILS
// ═══════════════════════════════════════════════════════

/**
 * Details for a run workout. Maps directly from STRIDE's data model.
 * Every field from STRIDE's trainingPlan.js is preserved here.
 * 
 * @typedef {Object} RunDetails
 * @property {string}      runType         - "Easy Run" | "Tempo" | "Intervals" | "Long Run" | "Race" | "Shakeout" | "REST"
 * @property {string}      runDescription  - Human-readable: "Tempo 4 mi: 1 WU + 2@7:30-7:50 + 1 CD"
 * @property {string}      phase           - "Base Building" | "Recovery" | "Marathon Specific" | "Peak Training" | "Taper"
 * @property {number}      week            - Training plan week number
 * @property {number}      plannedDistance  - Target distance in miles
 * @property {string}      targetPace      - Target pace range: "8:30-9:00"
 * 
 * // ── Filled in when status changes to 'completed' ──
 * @property {number|null} actualDistance   - Actual distance in miles
 * @property {string|null} actualTime      - Actual total time: "31:20"
 * @property {string|null} actualPace      - Calculated pace: "7:50" (auto-computed from distance/time)
 * @property {number|null} rpe             - Rate of Perceived Exertion: 1–10
 * @property {string|null} notes           - Free-text notes
 */

/**
 * Details for a lift workout. Maps from the Fitness App's session structure.
 * The nested exercises > sets hierarchy is preserved inside details
 * so LiftCard can render it without transformation.
 * 
 * @typedef {Object} LiftDetails
 * @property {string}      sessionName     - "Push Day" | "Pull Day" | "Legs" | custom name
 * @property {string[]}    muscleGroups    - ["Chest", "Shoulders", "Triceps"]
 * @property {Exercise[]}  exercises       - Ordered list of exercises in the session
 * 
 * // ── Computed when exercises are logged ──
 * @property {number|null} totalVolume     - Sum of (sets × reps × weight) across all exercises
 * @property {number|null} totalSets       - Total sets completed
 * @property {number|null} duration        - Session duration in minutes (optional, manual entry)
 * @property {string|null} notes           - Free-text notes
 */

/**
 * A single exercise within a lift session.
 * 
 * @typedef {Object} Exercise
 * @property {string}      name            - "Bench Press", "Squat", etc.
 * @property {string}      muscleGroup     - Primary muscle group: "Chest", "Quads", etc.
 * @property {string}      equipment       - "Barbell" | "Dumbbell" | "Cable" | "Machine" | "Bodyweight"
 * @property {Set[]}       sets            - Ordered list of sets
 */

/**
 * A single set within an exercise.
 * 
 * @typedef {Object} Set
 * @property {number}      setNumber       - 1, 2, 3...
 * @property {number|null} targetWeight    - Planned weight in lbs (from plan, null if no plan)
 * @property {number|null} targetReps      - Planned reps (from plan, null if no plan)
 * @property {number|null} weight          - Actual weight lifted in lbs
 * @property {number|null} reps            - Actual reps completed
 * @property {number|null} rpe             - RPE for this set: 1–10
 * @property {boolean}     completed       - Whether this set was performed
 */

/**
 * Details for a cardio workout (non-running: cycling, swimming, rowing, etc.)
 * 
 * @typedef {Object} CardioDetails
 * @property {string}      activityType    - "Cycling" | "Swimming" | "Rowing" | "Elliptical" | etc.
 * @property {number|null} duration        - Duration in minutes
 * @property {number|null} distance        - Distance if applicable (miles)
 * @property {number|null} heartRate       - Average heart rate
 * @property {number|null} caloriesBurned  - Estimated calories
 * @property {number|null} rpe             - RPE: 1–10
 * @property {string|null} notes           - Free-text notes
 */

/**
 * Details for a rest day. Minimal, but worth tracking.
 * 
 * @typedef {Object} RestDetails
 * @property {string}      restType        - "Full Rest" | "Active Recovery" | "Deload"
 * @property {string|null} notes           - "Achilles sore" or "Travel day" etc.
 */


// ═══════════════════════════════════════════════════════
// NUTRITION (separate from workouts, one entry per day)
// ═══════════════════════════════════════════════════════

/**
 * @typedef {Object} NutritionLog
 * @property {string}      id              - Unique identifier
 * @property {string}      date            - ISO date: "2026-05-13"
 * @property {Meal[]}      meals           - Breakfast, lunch, dinner, snacks
 * @property {DailyTotals} totals          - Aggregated daily totals
 * @property {number}      calorieTarget   - Adjusted target for this day (may differ from base if training-adjusted)
 * @property {number}      proteinTarget   - Adjusted protein target
 */

/**
 * @typedef {Object} Meal
 * @property {string}      name            - "Breakfast" | "Lunch" | "Dinner" | "Snacks"
 * @property {FoodEntry[]} foods           - List of foods in this meal
 */

/**
 * @typedef {Object} FoodEntry
 * @property {string}      id              - Unique identifier
 * @property {string}      label           - "Chicken breast" | "Protein shake" | custom
 * @property {number}      calories        - Calories
 * @property {number}      protein         - Grams of protein
 * @property {number}      carbs           - Grams of carbs
 * @property {number}      fat             - Grams of fat
 * @property {number}      servings        - Serving multiplier (default 1)
 */

/**
 * @typedef {Object} DailyTotals
 * @property {number}      calories
 * @property {number}      protein
 * @property {number}      carbs
 * @property {number}      fat
 */


// ═══════════════════════════════════════════════════════
// PLANS (containers that generate planned workouts)
// ═══════════════════════════════════════════════════════

/**
 * A training plan. When activated, it generates Workout entries
 * with status 'planned' and planId pointing back here.
 * 
 * Plans can be hybrid — containing both running and lifting prescriptions.
 * The plan itself stores the template. The generated workouts are what
 * the schedule view actually renders.
 * 
 * @typedef {Object} Plan
 * @property {string}      id              - Unique identifier
 * @property {string}      name            - "Sub-4 Marathon + Strength Maintenance"
 * @property {string}      description     - Plan summary
 * @property {PlanType}    planType        - "run" | "lift" | "hybrid"
 * @property {boolean}     isActive        - Only one plan can be active at a time
 * @property {string}      startDate       - ISO date: when the plan begins
 * @property {string}      endDate         - ISO date: when the plan ends
 * @property {PlanWeek[]}  weeks           - The full plan broken into weeks
 * @property {PlanGoals}   goals           - What the user is training for
 * @property {string}      createdAt       - ISO timestamp
 */

/**
 * @typedef {'run' | 'lift' | 'hybrid'} PlanType
 */

/**
 * @typedef {Object} PlanGoals
 * @property {string|null} raceType        - "Half Marathon" | "Marathon" | null
 * @property {string|null} targetTime      - "3:59:59" | null
 * @property {string|null} raceDate        - ISO date | null
 * @property {string|null} liftingGoal     - "strength" | "hypertrophy" | "maintenance" | null
 * @property {number|null} daysPerWeek     - Total training days available
 */

/**
 * A single week in a plan. Contains both run and lift prescriptions.
 * When the plan is activated, each prescription becomes a Workout entry.
 * 
 * @typedef {Object} PlanWeek
 * @property {number}            weekNumber  - 1, 2, 3...
 * @property {string}            phase       - "Base Building", "Recovery", etc.
 * @property {boolean}           isDeload    - Whether this is a deload/down week
 * @property {PlannedWorkout[]}  workouts    - All workouts prescribed for this week
 */

/**
 * A single prescribed workout within a plan week.
 * This gets converted into a Workout object when the plan is activated.
 * 
 * @typedef {Object} PlannedWorkout
 * @property {number}      dayOfWeek       - 0=Sunday, 1=Monday, ... 6=Saturday
 * @property {WorkoutType} type            - "run" | "lift" | "rest"
 * @property {RunDetails|LiftDetails|RestDetails} details - Prescription details
 */


// ═══════════════════════════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════════════════════════

/**
 * @typedef {Object} UserSettings
 * @property {string}      displayName     - User's name
 * @property {number|null} weight          - Current weight in lbs
 * @property {number|null} goalWeight      - Target weight in lbs
 * @property {number|null} height          - Height in inches
 * @property {number|null} age             - Age in years
 * @property {string}      sex             - "male" | "female" | "other"
 * @property {string}      activityLevel   - "sedentary" | "light" | "moderate" | "active" | "very_active"
 * @property {number}      calorieTarget   - Base daily calorie target (before training adjustments)
 * @property {number}      proteinTarget   - Daily protein target in grams
 * @property {number}      trainingDaysPerWeek - Preferred training days
 * @property {string}      primaryGoal     - "marathon" | "strength" | "hybrid" | "general"
 * @property {string}      experience      - "beginner" | "intermediate" | "advanced"
 */


// ═══════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Creates a new workout with sensible defaults.
 * Use this instead of manually constructing objects — it ensures
 * every workout has all required fields and timestamps.
 */
export function createWorkout({ date, type, status = 'planned', planId = null, details = {} }) {
  return {
    id: generateId(),
    date,
    type,
    status,
    planId,
    details,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a new run workout with STRIDE-compatible defaults.
 */
export function createRunWorkout({
  date,
  status = 'planned',
  planId = null,
  runType = 'Easy Run',
  runDescription = '',
  phase = '',
  week = 0,
  plannedDistance = 0,
  targetPace = '',
  actualDistance = null,
  actualTime = null,
  actualPace = null,
  rpe = null,
  notes = null,
}) {
  return createWorkout({
    date,
    type: 'run',
    status,
    planId,
    details: {
      runType,
      runDescription,
      phase,
      week,
      plannedDistance,
      targetPace,
      actualDistance,
      actualTime,
      actualPace,
      rpe,
      notes,
    },
  });
}

/**
 * Creates a new lift workout with Fitness App-compatible defaults.
 */
export function createLiftWorkout({
  date,
  status = 'planned',
  planId = null,
  sessionName = '',
  muscleGroups = [],
  exercises = [],
  totalVolume = null,
  totalSets = null,
  duration = null,
  notes = null,
}) {
  return createWorkout({
    date,
    type: 'lift',
    status,
    planId,
    details: {
      sessionName,
      muscleGroups,
      exercises,
      totalVolume,
      totalSets,
      duration,
      notes,
    },
  });
}

/**
 * Creates a new rest day entry.
 */
export function createRestWorkout({ date, planId = null, restType = 'Full Rest', notes = null }) {
  return createWorkout({
    date,
    type: 'rest',
    status: 'planned',
    planId,
    details: { restType, notes },
  });
}

/**
 * Creates an empty nutrition log for a given date.
 */
export function createNutritionLog({ date, calorieTarget = 2400, proteinTarget = 180 }) {
  return {
    id: generateId(),
    date,
    meals: [
      { name: 'Breakfast', foods: [] },
      { name: 'Lunch',     foods: [] },
      { name: 'Dinner',    foods: [] },
      { name: 'Snacks',    foods: [] },
    ],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    calorieTarget,
    proteinTarget,
  };
}

/**
 * Creates a food entry for a meal.
 */
export function createFoodEntry({ label, calories = 0, protein = 0, carbs = 0, fat = 0, servings = 1 }) {
  return {
    id: generateId(),
    label,
    calories,
    protein,
    carbs,
    fat,
    servings,
  };
}

/**
 * Default user settings for a new user.
 */
export function createDefaultSettings() {
  return {
    displayName: '',
    weight: null,
    goalWeight: null,
    height: null,
    age: null,
    sex: 'male',
    activityLevel: 'active',
    calorieTarget: 2400,
    proteinTarget: 180,
    trainingDaysPerWeek: 6,
    primaryGoal: 'hybrid',
    experience: 'intermediate',
  };
}


// ═══════════════════════════════════════════════════════
// COMPUTED HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Calculates total volume for a lift session: sum of (weight × reps) for all completed sets.
 * Call this after logging sets and store the result in details.totalVolume.
 */
export function calculateLiftVolume(exercises) {
  let volume = 0;
  let setCount = 0;

  for (const exercise of exercises) {
    for (const set of (Array.isArray(exercise.sets) ? exercise.sets : [])) {
      if (set.completed && set.weight && set.reps) {
        volume += set.weight * set.reps;
        setCount++;
      }
    }
  }

  return { totalVolume: volume, totalSets: setCount };
}

/**
 * Recalculates a nutrition log's daily totals from its meals.
 */
export function recalculateNutritionTotals(nutritionLog) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const meal of nutritionLog.meals) {
    for (const food of meal.foods) {
      totals.calories += food.calories * food.servings;
      totals.protein  += food.protein  * food.servings;
      totals.carbs    += food.carbs    * food.servings;
      totals.fat      += food.fat      * food.servings;
    }
  }

  return { ...nutritionLog, totals };
}


// ═══════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════

/**
 * Generates a unique ID. Uses crypto.randomUUID where available,
 * falls back to timestamp + random for older environments.
 * These get replaced by Supabase UUIDs in Iteration 3.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}