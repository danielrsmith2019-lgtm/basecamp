/**
 * Nutrition utilities — training-aware calorie targets,
 * fuel status, and food database helpers.
 */

// ── Hard session detection ─────────────────────────────

const HARD_RUN_TYPES = ['tempo', 'interval', 'long_run', 'race'];
const HARD_LIFT_TYPES = ['strength', 'powerlifting', 'heavy'];

export function isHardSession(workout) {
  if (workout.type === 'run') {
    return HARD_RUN_TYPES.includes(workout.details?.runType);
  }
  if (workout.type === 'lift') {
    const name = (workout.details?.sessionName || '').toLowerCase();
    return HARD_LIFT_TYPES.some(t => name.includes(t)) ||
      (workout.details?.exercises || []).length >= 5;
  }
  return false;
}

// ── Training-aware calorie adjustment ─────────────────

export function getTrainingCalorieBonus(todayWorkouts, weightLbs = 170) {
  const weightKg = weightLbs * 0.453592;
  let bonus = 0;

  todayWorkouts.forEach(w => {
    if (w.type === 'run') {
      const dist = w.details?.plannedDistance || 0;
      // ~1 cal/kg/km running
      const km = dist * 1.60934;
      bonus += Math.round(weightKg * km);
    } else if (w.type === 'lift') {
      const exercises = (w.details?.exercises || []).length;
      const duration = w.details?.duration || 60;
      // ~5 cal/min lifting estimate
      bonus += Math.round(duration * 5);
    } else if (w.type === 'cardio') {
      const duration = w.details?.duration || 30;
      bonus += Math.round(duration * 7);
    }
  });

  // Cap bonus between 200–400 for hard days, 0–200 for easy
  const hasHard = todayWorkouts.some(isHardSession);
  if (hasHard) return Math.min(400, Math.max(200, bonus));
  return Math.min(200, bonus);
}

// ── Fuel status ────────────────────────────────────────

export function getFuelStatus(caloriesConsumed, calorieTarget) {
  const pct = calorieTarget > 0 ? caloriesConsumed / calorieTarget : 0;
  if (pct >= 0.6) return { color: '#34C759', label: 'Well fueled' };
  if (pct >= 0.3) return { color: '#FF9500', label: 'Fueling up' };
  return { color: '#FF3B30', label: 'Under fueled' };
}

// ── Meal time grouping ─────────────────────────────────

export function getMealTimeGroup(time) {
  if (!time) return 'Snacks';
  const hour = parseInt(time.split(':')[0]);
  if (hour >= 5  && hour < 10) return 'Breakfast';
  if (hour >= 10 && hour < 14) return 'Lunch';
  if (hour >= 14 && hour < 20) return 'Dinner';
  return 'Snacks';
}

export const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// ── Common food database ───────────────────────────────

export const FOOD_DATABASE = [
  // Proteins
  { id: 'chicken-breast',   name: 'Chicken Breast (100g)',  calories: 165, protein: 31, carbs: 0,  fat: 3.6, category: 'Protein' },
  { id: 'ground-beef-lean', name: 'Ground Beef 93% (100g)', calories: 152, protein: 26, carbs: 0,  fat: 5.5, category: 'Protein' },
  { id: 'salmon',           name: 'Salmon (100g)',           calories: 208, protein: 20, carbs: 0,  fat: 13,  category: 'Protein' },
  { id: 'tuna-can',         name: 'Canned Tuna (1 can)',     calories: 109, protein: 25, carbs: 0,  fat: 1,   category: 'Protein' },
  { id: 'eggs-2',           name: 'Eggs (2 large)',          calories: 140, protein: 12, carbs: 1,  fat: 10,  category: 'Protein' },
  { id: 'greek-yogurt',     name: 'Greek Yogurt (1 cup)',    calories: 130, protein: 22, carbs: 9,  fat: 0,   category: 'Protein' },
  { id: 'cottage-cheese',   name: 'Cottage Cheese (1 cup)', calories: 206, protein: 28, carbs: 8,  fat: 5,   category: 'Protein' },
  { id: 'protein-shake',    name: 'Protein Shake (1 scoop)', calories: 120, protein: 25, carbs: 3,  fat: 2,   category: 'Protein' },
  { id: 'turkey-breast',    name: 'Turkey Breast (100g)',    calories: 135, protein: 30, carbs: 0,  fat: 1,   category: 'Protein' },
  { id: 'tofu',             name: 'Tofu (100g)',             calories: 76,  protein: 8,  carbs: 2,  fat: 4,   category: 'Protein' },

  // Carbs
  { id: 'white-rice',       name: 'White Rice (1 cup cooked)', calories: 206, protein: 4,  carbs: 45, fat: 0,   category: 'Carbs' },
  { id: 'brown-rice',       name: 'Brown Rice (1 cup cooked)', calories: 218, protein: 5,  carbs: 46, fat: 2,   category: 'Carbs' },
  { id: 'oatmeal',          name: 'Oatmeal (1 cup cooked)',    calories: 158, protein: 6,  carbs: 27, fat: 3,   category: 'Carbs' },
  { id: 'sweet-potato',     name: 'Sweet Potato (1 medium)',   calories: 103, protein: 2,  carbs: 24, fat: 0,   category: 'Carbs' },
  { id: 'bread-whole',      name: 'Whole Wheat Bread (2 slices)', calories: 138, protein: 7, carbs: 24, fat: 2, category: 'Carbs' },
  { id: 'pasta',            name: 'Pasta (1 cup cooked)',      calories: 220, protein: 8,  carbs: 43, fat: 1,   category: 'Carbs' },
  { id: 'banana',           name: 'Banana (1 medium)',         calories: 105, protein: 1,  carbs: 27, fat: 0,   category: 'Carbs' },
  { id: 'apple',            name: 'Apple (1 medium)',          calories: 95,  protein: 0,  carbs: 25, fat: 0,   category: 'Carbs' },
  { id: 'quinoa',           name: 'Quinoa (1 cup cooked)',     calories: 222, protein: 8,  carbs: 39, fat: 4,   category: 'Carbs' },
  { id: 'bagel',            name: 'Bagel (1 plain)',           calories: 270, protein: 11, carbs: 53, fat: 1,   category: 'Carbs' },

  // Fats
  { id: 'avocado-half',     name: 'Avocado (½)',               calories: 120, protein: 1,  carbs: 6,  fat: 11,  category: 'Fats' },
  { id: 'almonds',          name: 'Almonds (1 oz)',            calories: 164, protein: 6,  carbs: 6,  fat: 14,  category: 'Fats' },
  { id: 'peanut-butter',    name: 'Peanut Butter (2 tbsp)',    calories: 188, protein: 8,  carbs: 6,  fat: 16,  category: 'Fats' },
  { id: 'olive-oil',        name: 'Olive Oil (1 tbsp)',        calories: 119, protein: 0,  carbs: 0,  fat: 14,  category: 'Fats' },

  // Meals
  { id: 'burrito-bowl',     name: 'Burrito Bowl',              calories: 650, protein: 40, carbs: 70, fat: 18,  category: 'Meals' },
  { id: 'salad-grilled',    name: 'Grilled Chicken Salad',     calories: 380, protein: 35, carbs: 15, fat: 18,  category: 'Meals' },
  { id: 'steak-rice',       name: 'Steak + Rice',              calories: 550, protein: 45, carbs: 45, fat: 15,  category: 'Meals' },
  { id: 'overnight-oats',   name: 'Overnight Oats',            calories: 350, protein: 15, carbs: 55, fat: 8,   category: 'Meals' },
  { id: 'smoothie-protein', name: 'Protein Smoothie',          calories: 320, protein: 28, carbs: 35, fat: 6,   category: 'Meals' },
];

export function searchFoods(query) {
  if (!query || query.length < 1) return FOOD_DATABASE.slice(0, 10);
  const q = query.toLowerCase();
  return FOOD_DATABASE.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  ).slice(0, 8);
}