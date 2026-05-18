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
      const km = dist * 1.60934;
      bonus += Math.round(weightKg * km);
    } else if (w.type === 'lift') {
      const duration = w.details?.duration || 60;
      bonus += Math.round(duration * 5);
    } else if (w.type === 'cardio') {
      const duration = w.details?.duration || 30;
      bonus += Math.round(duration * 7);
    }
  });

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

// ── Food database ──────────────────────────────────────
// ~150 items across 10 categories optimized for hybrid athletes

export const FOOD_DATABASE = [

  // ── PROTEIN ───────────────────────────────────────────
  { id: 'chicken-breast-100',   name: 'Chicken Breast (100g)',        calories: 165, protein: 31, carbs: 0,  fat: 3.6, category: 'Protein' },
  { id: 'chicken-breast-6oz',   name: 'Chicken Breast (6 oz)',        calories: 280, protein: 52, carbs: 0,  fat: 6,   category: 'Protein' },
  { id: 'chicken-thigh',        name: 'Chicken Thigh (100g)',         calories: 209, protein: 26, carbs: 0,  fat: 11,  category: 'Protein' },
  { id: 'ground-beef-93',       name: 'Ground Beef 93% (100g)',       calories: 152, protein: 26, carbs: 0,  fat: 5.5, category: 'Protein' },
  { id: 'ground-beef-80',       name: 'Ground Beef 80% (100g)',       calories: 215, protein: 26, carbs: 0,  fat: 13,  category: 'Protein' },
  { id: 'sirloin-steak',        name: 'Sirloin Steak (6 oz)',         calories: 330, protein: 48, carbs: 0,  fat: 14,  category: 'Protein' },
  { id: 'salmon-100',           name: 'Salmon (100g)',                calories: 208, protein: 20, carbs: 0,  fat: 13,  category: 'Protein' },
  { id: 'tilapia',              name: 'Tilapia (100g)',               calories: 128, protein: 26, carbs: 0,  fat: 3,   category: 'Protein' },
  { id: 'shrimp',               name: 'Shrimp (100g)',                calories: 99,  protein: 24, carbs: 0,  fat: 0.3, category: 'Protein' },
  { id: 'tuna-can',             name: 'Canned Tuna (1 can, 5oz)',     calories: 150, protein: 33, carbs: 0,  fat: 1,   category: 'Protein' },
  { id: 'tuna-packet',          name: 'Tuna Packet (2.6oz)',          calories: 80,  protein: 17, carbs: 0,  fat: 0.5, category: 'Protein' },
  { id: 'eggs-2',               name: 'Eggs (2 large)',               calories: 140, protein: 12, carbs: 1,  fat: 10,  category: 'Protein' },
  { id: 'eggs-3',               name: 'Eggs (3 large)',               calories: 210, protein: 18, carbs: 1,  fat: 15,  category: 'Protein' },
  { id: 'egg-whites-4',         name: 'Egg Whites (4)',               calories: 68,  protein: 14, carbs: 1,  fat: 0,   category: 'Protein' },
  { id: 'greek-yogurt',         name: 'Greek Yogurt (1 cup, 0%)',     calories: 130, protein: 22, carbs: 9,  fat: 0,   category: 'Protein' },
  { id: 'greek-yogurt-full',    name: 'Greek Yogurt (1 cup, full fat)',calories: 190, protein: 20, carbs: 9,  fat: 10,  category: 'Protein' },
  { id: 'cottage-cheese',       name: 'Cottage Cheese (1 cup, 2%)',   calories: 206, protein: 28, carbs: 8,  fat: 5,   category: 'Protein' },
  { id: 'protein-shake-25',     name: 'Protein Shake (25g protein)',  calories: 120, protein: 25, carbs: 3,  fat: 2,   category: 'Protein' },
  { id: 'protein-shake-50',     name: 'Double Protein Shake',         calories: 240, protein: 50, carbs: 6,  fat: 4,   category: 'Protein' },
  { id: 'turkey-breast',        name: 'Turkey Breast (100g)',         calories: 135, protein: 30, carbs: 0,  fat: 1,   category: 'Protein' },
  { id: 'turkey-burger',        name: 'Turkey Burger Patty (4oz)',    calories: 170, protein: 22, carbs: 0,  fat: 8,   category: 'Protein' },
  { id: 'tofu-firm',            name: 'Firm Tofu (100g)',             calories: 76,  protein: 8,  carbs: 2,  fat: 4,   category: 'Protein' },
  { id: 'edamame',              name: 'Edamame (1 cup shelled)',      calories: 188, protein: 17, carbs: 14, fat: 8,   category: 'Protein' },
  { id: 'tempeh',               name: 'Tempeh (100g)',                calories: 193, protein: 19, carbs: 9,  fat: 11,  category: 'Protein' },
  { id: 'deli-turkey',          name: 'Deli Turkey (4 slices)',       calories: 80,  protein: 16, carbs: 2,  fat: 1,   category: 'Protein' },
  { id: 'beef-jerky',           name: 'Beef Jerky (1 oz)',            calories: 116, protein: 9,  carbs: 3,  fat: 7,   category: 'Protein' },

  // ── CARBS ─────────────────────────────────────────────
  { id: 'white-rice-cup',       name: 'White Rice (1 cup cooked)',    calories: 206, protein: 4,  carbs: 45, fat: 0,   category: 'Carbs' },
  { id: 'brown-rice-cup',       name: 'Brown Rice (1 cup cooked)',    calories: 218, protein: 5,  carbs: 46, fat: 2,   category: 'Carbs' },
  { id: 'jasmine-rice',         name: 'Jasmine Rice (1 cup cooked)',  calories: 210, protein: 4,  carbs: 46, fat: 0,   category: 'Carbs' },
  { id: 'oatmeal-cup',          name: 'Oatmeal (1 cup cooked)',       calories: 158, protein: 6,  carbs: 27, fat: 3,   category: 'Carbs' },
  { id: 'overnight-oats',       name: 'Overnight Oats (½ cup dry)',   calories: 190, protein: 7,  carbs: 33, fat: 4,   category: 'Carbs' },
  { id: 'sweet-potato-med',     name: 'Sweet Potato (1 medium)',      calories: 103, protein: 2,  carbs: 24, fat: 0,   category: 'Carbs' },
  { id: 'sweet-potato-large',   name: 'Sweet Potato (1 large)',       calories: 162, protein: 4,  carbs: 37, fat: 0,   category: 'Carbs' },
  { id: 'white-potato',         name: 'Baked Potato (1 medium)',      calories: 161, protein: 4,  carbs: 37, fat: 0,   category: 'Carbs' },
  { id: 'bread-whole-2',        name: 'Whole Wheat Bread (2 slices)', calories: 138, protein: 7,  carbs: 24, fat: 2,   category: 'Carbs' },
  { id: 'sourdough-2',          name: 'Sourdough Bread (2 slices)',   calories: 160, protein: 6,  carbs: 32, fat: 1,   category: 'Carbs' },
  { id: 'pasta-cup',            name: 'Pasta (1 cup cooked)',         calories: 220, protein: 8,  carbs: 43, fat: 1,   category: 'Carbs' },
  { id: 'pasta-2cups',          name: 'Pasta (2 cups cooked)',        calories: 440, protein: 16, carbs: 86, fat: 2,   category: 'Carbs' },
  { id: 'quinoa-cup',           name: 'Quinoa (1 cup cooked)',        calories: 222, protein: 8,  carbs: 39, fat: 4,   category: 'Carbs' },
  { id: 'bagel-plain',          name: 'Bagel (1 plain)',              calories: 270, protein: 11, carbs: 53, fat: 1,   category: 'Carbs' },
  { id: 'english-muffin',       name: 'English Muffin (1)',           calories: 134, protein: 5,  carbs: 26, fat: 1,   category: 'Carbs' },
  { id: 'tortilla-large',       name: 'Flour Tortilla (10")',         calories: 218, protein: 6,  carbs: 36, fat: 6,   category: 'Carbs' },
  { id: 'pita-bread',           name: 'Pita Bread (1 whole)',         calories: 165, protein: 6,  carbs: 33, fat: 1,   category: 'Carbs' },
  { id: 'banana-med',           name: 'Banana (1 medium)',            calories: 105, protein: 1,  carbs: 27, fat: 0,   category: 'Carbs' },
  { id: 'apple-med',            name: 'Apple (1 medium)',             calories: 95,  protein: 0,  carbs: 25, fat: 0,   category: 'Carbs' },
  { id: 'orange',               name: 'Orange (1 large)',             calories: 87,  protein: 2,  carbs: 22, fat: 0,   category: 'Carbs' },
  { id: 'blueberries-cup',      name: 'Blueberries (1 cup)',          calories: 84,  protein: 1,  carbs: 21, fat: 0,   category: 'Carbs' },
  { id: 'strawberries-cup',     name: 'Strawberries (1 cup)',         calories: 49,  protein: 1,  carbs: 12, fat: 0,   category: 'Carbs' },
  { id: 'mango-cup',            name: 'Mango (1 cup)',                calories: 107, protein: 1,  carbs: 28, fat: 0,   category: 'Carbs' },
  { id: 'grapes-cup',           name: 'Grapes (1 cup)',               calories: 104, protein: 1,  carbs: 27, fat: 0,   category: 'Carbs' },
  { id: 'rice-cake-2',          name: 'Rice Cakes (2)',               calories: 70,  protein: 1,  carbs: 15, fat: 0,   category: 'Carbs' },
  { id: 'granola-bar',          name: 'Granola Bar (1)',              calories: 190, protein: 4,  carbs: 29, fat: 7,   category: 'Carbs' },
  { id: 'cream-of-rice',        name: 'Cream of Rice (1 cup cooked)', calories: 126, protein: 2,  carbs: 28, fat: 0,   category: 'Carbs' },

  // ── FATS ──────────────────────────────────────────────
  { id: 'avocado-half',         name: 'Avocado (½)',                  calories: 120, protein: 1,  carbs: 6,  fat: 11,  category: 'Fats' },
  { id: 'avocado-whole',        name: 'Avocado (1 whole)',            calories: 240, protein: 3,  carbs: 13, fat: 22,  category: 'Fats' },
  { id: 'almonds-oz',           name: 'Almonds (1 oz, ~23)',          calories: 164, protein: 6,  carbs: 6,  fat: 14,  category: 'Fats' },
  { id: 'walnuts-oz',           name: 'Walnuts (1 oz)',               calories: 185, protein: 4,  carbs: 4,  fat: 18,  category: 'Fats' },
  { id: 'cashews-oz',           name: 'Cashews (1 oz)',               calories: 157, protein: 5,  carbs: 9,  fat: 12,  category: 'Fats' },
  { id: 'mixed-nuts-oz',        name: 'Mixed Nuts (1 oz)',            calories: 173, protein: 5,  carbs: 6,  fat: 16,  category: 'Fats' },
  { id: 'peanut-butter-2tbsp',  name: 'Peanut Butter (2 tbsp)',       calories: 188, protein: 8,  carbs: 6,  fat: 16,  category: 'Fats' },
  { id: 'almond-butter-2tbsp',  name: 'Almond Butter (2 tbsp)',       calories: 196, protein: 7,  carbs: 6,  fat: 18,  category: 'Fats' },
  { id: 'olive-oil-tbsp',       name: 'Olive Oil (1 tbsp)',           calories: 119, protein: 0,  carbs: 0,  fat: 14,  category: 'Fats' },
  { id: 'coconut-oil-tbsp',     name: 'Coconut Oil (1 tbsp)',         calories: 121, protein: 0,  carbs: 0,  fat: 14,  category: 'Fats' },
  { id: 'whole-milk-cup',       name: 'Whole Milk (1 cup)',           calories: 149, protein: 8,  carbs: 12, fat: 8,   category: 'Fats' },
  { id: 'cheese-slice-2',       name: 'Cheddar Cheese (2 slices)',    calories: 226, protein: 14, carbs: 0,  fat: 18,  category: 'Fats' },
  { id: 'cheese-mozzarella',    name: 'Mozzarella (1 oz)',            calories: 85,  protein: 6,  carbs: 1,  fat: 6,   category: 'Fats' },
  { id: 'dark-chocolate-oz',    name: 'Dark Chocolate 70%+ (1 oz)',   calories: 170, protein: 2,  carbs: 13, fat: 12,  category: 'Fats' },

  // ── VEGETABLES ────────────────────────────────────────
  { id: 'broccoli-cup',         name: 'Broccoli (1 cup)',             calories: 31,  protein: 3,  carbs: 6,  fat: 0,   category: 'Vegetables' },
  { id: 'spinach-cup',          name: 'Spinach (2 cups raw)',         calories: 14,  protein: 2,  carbs: 2,  fat: 0,   category: 'Vegetables' },
  { id: 'asparagus',            name: 'Asparagus (1 cup)',            calories: 27,  protein: 3,  carbs: 5,  fat: 0,   category: 'Vegetables' },
  { id: 'green-beans',          name: 'Green Beans (1 cup)',          calories: 44,  protein: 2,  carbs: 10, fat: 0,   category: 'Vegetables' },
  { id: 'zucchini',             name: 'Zucchini (1 cup)',             calories: 21,  protein: 2,  carbs: 4,  fat: 0,   category: 'Vegetables' },
  { id: 'bell-pepper',          name: 'Bell Pepper (1 large)',        calories: 43,  protein: 1,  carbs: 10, fat: 0,   category: 'Vegetables' },
  { id: 'mixed-greens-2cups',   name: 'Mixed Greens (2 cups)',        calories: 18,  protein: 2,  carbs: 3,  fat: 0,   category: 'Vegetables' },
  { id: 'cucumber',             name: 'Cucumber (1 cup)',             calories: 16,  protein: 1,  carbs: 4,  fat: 0,   category: 'Vegetables' },
  { id: 'tomato',               name: 'Tomato (1 medium)',            calories: 22,  protein: 1,  carbs: 5,  fat: 0,   category: 'Vegetables' },
  { id: 'mushrooms-cup',        name: 'Mushrooms (1 cup)',            calories: 15,  protein: 2,  carbs: 2,  fat: 0,   category: 'Vegetables' },
  { id: 'carrots-cup',          name: 'Carrots (1 cup)',              calories: 52,  protein: 1,  carbs: 12, fat: 0,   category: 'Vegetables' },
  { id: 'kale-cup',             name: 'Kale (1 cup raw)',             calories: 33,  protein: 3,  carbs: 7,  fat: 0,   category: 'Vegetables' },
  { id: 'brussels-sprouts',     name: 'Brussels Sprouts (1 cup)',     calories: 56,  protein: 4,  carbs: 11, fat: 0,   category: 'Vegetables' },
  { id: 'cauliflower',          name: 'Cauliflower (1 cup)',          calories: 25,  protein: 2,  carbs: 5,  fat: 0,   category: 'Vegetables' },
  { id: 'corn-ear',             name: 'Corn (1 ear)',                 calories: 123, protein: 5,  carbs: 27, fat: 2,   category: 'Vegetables' },

  // ── MEALS ─────────────────────────────────────────────
  { id: 'burrito-bowl',         name: 'Burrito Bowl (Chipotle-style)',calories: 650, protein: 40, carbs: 70, fat: 18,  category: 'Meals' },
  { id: 'chicken-rice-veg',     name: 'Chicken, Rice & Veg',         calories: 520, protein: 48, carbs: 52, fat: 10,  category: 'Meals' },
  { id: 'steak-rice',           name: 'Steak + Rice',                calories: 550, protein: 45, carbs: 45, fat: 15,  category: 'Meals' },
  { id: 'chicken-pasta',        name: 'Chicken Pasta (2 cups)',       calories: 620, protein: 42, carbs: 68, fat: 14,  category: 'Meals' },
  { id: 'salmon-sweet-potato',  name: 'Salmon + Sweet Potato',       calories: 480, protein: 38, carbs: 40, fat: 16,  category: 'Meals' },
  { id: 'ground-beef-rice',     name: 'Ground Beef + Rice',          calories: 580, protein: 40, carbs: 48, fat: 18,  category: 'Meals' },
  { id: 'tuna-rice-bowl',       name: 'Tuna Rice Bowl',              calories: 430, protein: 38, carbs: 52, fat: 4,   category: 'Meals' },
  { id: 'turkey-sandwich',      name: 'Turkey Sandwich (whole wheat)',calories: 380, protein: 28, carbs: 40, fat: 10,  category: 'Meals' },
  { id: 'grilled-chicken-salad',name: 'Grilled Chicken Salad',       calories: 380, protein: 35, carbs: 15, fat: 18,  category: 'Meals' },
  { id: 'protein-smoothie',     name: 'Protein Smoothie',            calories: 320, protein: 28, carbs: 35, fat: 6,   category: 'Meals' },
  { id: 'egg-scramble-3',       name: 'Egg Scramble (3 eggs + veg)', calories: 280, protein: 20, carbs: 8,  fat: 18,  category: 'Meals' },
  { id: 'avocado-toast-egg',    name: 'Avocado Toast + 2 Eggs',      calories: 420, protein: 18, carbs: 34, fat: 24,  category: 'Meals' },
  { id: 'shrimp-stir-fry',      name: 'Shrimp Stir Fry + Rice',      calories: 460, protein: 36, carbs: 52, fat: 8,   category: 'Meals' },
  { id: 'poke-bowl',            name: 'Poke Bowl (regular)',          calories: 580, protein: 32, carbs: 68, fat: 16,  category: 'Meals' },
  { id: 'sushi-rolls-8pc',      name: 'Sushi Rolls (8 pieces)',       calories: 340, protein: 14, carbs: 56, fat: 6,   category: 'Meals' },
  { id: 'chili-cup',            name: 'Beef Chili (1 cup)',           calories: 290, protein: 22, carbs: 28, fat: 9,   category: 'Meals' },
  { id: 'pizza-slice-2',        name: 'Pizza (2 slices)',             calories: 570, protein: 24, carbs: 72, fat: 20,  category: 'Meals' },
  { id: 'burger-no-bun',        name: 'Burger Patty (no bun)',        calories: 290, protein: 26, carbs: 0,  fat: 20,  category: 'Meals' },
  { id: 'tacos-2-chicken',      name: 'Chicken Tacos (2)',            calories: 380, protein: 28, carbs: 36, fat: 14,  category: 'Meals' },

  // ── BREAKFAST ─────────────────────────────────────────
  { id: 'pancakes-3',           name: 'Pancakes (3 medium)',          calories: 360, protein: 9,  carbs: 60, fat: 10,  category: 'Breakfast' },
  { id: 'french-toast-2',       name: 'French Toast (2 slices)',      calories: 310, protein: 12, carbs: 40, fat: 12,  category: 'Breakfast' },
  { id: 'cereal-granola',       name: 'Granola (½ cup)',              calories: 298, protein: 8,  carbs: 48, fat: 10,  category: 'Breakfast' },
  { id: 'cereal-bran',          name: 'Bran Flakes (1 cup)',          calories: 190, protein: 5,  carbs: 45, fat: 1,   category: 'Breakfast' },
  { id: 'yogurt-parfait',       name: 'Yogurt Parfait',               calories: 310, protein: 18, carbs: 42, fat: 6,   category: 'Breakfast' },
  { id: 'acai-bowl',            name: 'Açaí Bowl (medium)',           calories: 420, protein: 8,  carbs: 68, fat: 14,  category: 'Breakfast' },
  { id: 'breakfast-burrito',    name: 'Breakfast Burrito (eggs/cheese)',calories: 490, protein: 24, carbs: 44, fat: 24, category: 'Breakfast' },
  { id: 'protein-oatmeal',      name: 'Protein Oatmeal (1 scoop+oats)',calories: 285, protein: 28, carbs: 32, fat: 5,  category: 'Breakfast' },
  { id: 'waffles-2',            name: 'Waffles (2)',                  calories: 310, protein: 8,  carbs: 46, fat: 11,  category: 'Breakfast' },

  // ── SNACKS ────────────────────────────────────────────
  { id: 'protein-bar',          name: 'Protein Bar (Quest/similar)',  calories: 200, protein: 21, carbs: 21, fat: 7,   category: 'Snacks' },
  { id: 'clif-bar',             name: 'Clif Bar',                    calories: 250, protein: 9,  carbs: 44, fat: 5,   category: 'Snacks' },
  { id: 'rx-bar',               name: 'RX Bar',                      calories: 210, protein: 12, carbs: 24, fat: 9,   category: 'Snacks' },
  { id: 'banana-pb',            name: 'Banana + Peanut Butter',      calories: 293, protein: 9,  carbs: 33, fat: 16,  category: 'Snacks' },
  { id: 'apple-pb',             name: 'Apple + Peanut Butter',       calories: 283, protein: 8,  carbs: 31, fat: 16,  category: 'Snacks' },
  { id: 'cheese-crackers',      name: 'Cheese + Crackers',           calories: 220, protein: 8,  carbs: 20, fat: 12,  category: 'Snacks' },
  { id: 'hummus-veggies',       name: 'Hummus + Veggies',            calories: 150, protein: 5,  carbs: 16, fat: 8,   category: 'Snacks' },
  { id: 'trail-mix-oz',         name: 'Trail Mix (1 oz)',             calories: 131, protein: 3,  carbs: 13, fat: 8,   category: 'Snacks' },
  { id: 'popcorn-3cups',        name: 'Popcorn (3 cups air-popped)',  calories: 93,  protein: 3,  carbs: 19, fat: 1,   category: 'Snacks' },
  { id: 'string-cheese-2',      name: 'String Cheese (2)',            calories: 160, protein: 14, carbs: 2,  fat: 10,  category: 'Snacks' },
  { id: 'edamame-snack',        name: 'Edamame (½ cup, snack)',       calories: 94,  protein: 8,  carbs: 7,  fat: 4,   category: 'Snacks' },
  { id: 'hard-boiled-egg-2',    name: 'Hard Boiled Eggs (2)',         calories: 140, protein: 12, carbs: 1,  fat: 10,  category: 'Snacks' },
  { id: 'rice-cakes-pb',        name: 'Rice Cakes + Peanut Butter',  calories: 258, protein: 9,  carbs: 21, fat: 16,  category: 'Snacks' },
  { id: 'cottage-cheese-snack', name: 'Cottage Cheese (½ cup)',       calories: 103, protein: 14, carbs: 4,  fat: 3,   category: 'Snacks' },

  // ── PRE-WORKOUT ───────────────────────────────────────
  { id: 'pre-banana-rice-cake', name: 'Banana + Rice Cakes',         calories: 175, protein: 2,  carbs: 42, fat: 0,   category: 'Pre-Workout' },
  { id: 'pre-oats-honey',       name: 'Oats + Honey',                calories: 210, protein: 5,  carbs: 44, fat: 3,   category: 'Pre-Workout' },
  { id: 'pre-toast-jam',        name: 'Toast + Jam',                  calories: 185, protein: 4,  carbs: 40, fat: 1,   category: 'Pre-Workout' },
  { id: 'pre-energy-gel',       name: 'Energy Gel (1 packet)',        calories: 100, protein: 0,  carbs: 25, fat: 0,   category: 'Pre-Workout' },
  { id: 'pre-chews',            name: 'Energy Chews (1 pack)',        calories: 100, protein: 0,  carbs: 25, fat: 0,   category: 'Pre-Workout' },
  { id: 'pre-dates-4',          name: 'Medjool Dates (4)',            calories: 280, protein: 2,  carbs: 74, fat: 0,   category: 'Pre-Workout' },
  { id: 'pre-gatorade',         name: 'Gatorade (20 oz)',             calories: 140, protein: 0,  carbs: 36, fat: 0,   category: 'Pre-Workout' },
  { id: 'pre-white-rice-small', name: 'White Rice (½ cup, pre-run)',  calories: 103, protein: 2,  carbs: 22, fat: 0,   category: 'Pre-Workout' },

  // ── POST-WORKOUT ──────────────────────────────────────
  { id: 'post-shake-banana',    name: 'Protein Shake + Banana',      calories: 340, protein: 28, carbs: 42, fat: 3,   category: 'Post-Workout' },
  { id: 'post-chocolate-milk',  name: 'Chocolate Milk (16 oz)',       calories: 320, protein: 16, carbs: 52, fat: 5,   category: 'Post-Workout' },
  { id: 'post-chicken-rice',    name: 'Chicken + Rice (post-workout)',calories: 410, protein: 42, carbs: 46, fat: 6,   category: 'Post-Workout' },
  { id: 'post-greek-honey',     name: 'Greek Yogurt + Honey',         calories: 180, protein: 18, carbs: 22, fat: 0,   category: 'Post-Workout' },
  { id: 'post-eggs-toast',      name: '3 Eggs + 2 Toast (recovery)',  calories: 420, protein: 24, carbs: 36, fat: 16,  category: 'Post-Workout' },
  { id: 'post-tuna-crackers',   name: 'Tuna + Crackers',              calories: 270, protein: 26, carbs: 22, fat: 6,   category: 'Post-Workout' },
  { id: 'post-smoothie-full',   name: 'Recovery Smoothie (full)',     calories: 480, protein: 32, carbs: 62, fat: 8,   category: 'Post-Workout' },

  // ── DRINKS ────────────────────────────────────────────
  { id: 'coffee-black',         name: 'Coffee (black, 12 oz)',        calories: 5,   protein: 0,  carbs: 1,  fat: 0,   category: 'Drinks' },
  { id: 'coffee-latte',         name: 'Latte (12 oz, 2% milk)',       calories: 150, protein: 8,  carbs: 14, fat: 6,   category: 'Drinks' },
  { id: 'coffee-oatmilk-latte', name: 'Oat Milk Latte (12 oz)',       calories: 130, protein: 4,  carbs: 18, fat: 5,   category: 'Drinks' },
  { id: 'orange-juice',         name: 'Orange Juice (8 oz)',          calories: 112, protein: 2,  carbs: 26, fat: 0,   category: 'Drinks' },
  { id: 'whole-milk-cup',       name: 'Whole Milk (8 oz)',            calories: 149, protein: 8,  carbs: 12, fat: 8,   category: 'Drinks' },
  { id: 'almond-milk-cup',      name: 'Almond Milk (8 oz, unsweet)', calories: 30,  protein: 1,  carbs: 1,  fat: 2.5, category: 'Drinks' },
  { id: 'oat-milk-cup',         name: 'Oat Milk (8 oz)',              calories: 120, protein: 3,  carbs: 16, fat: 5,   category: 'Drinks' },
  { id: 'sports-drink-20',      name: 'Sports Drink (20 oz)',         calories: 130, protein: 0,  carbs: 34, fat: 0,   category: 'Drinks' },
  { id: 'coconut-water',        name: 'Coconut Water (12 oz)',        calories: 60,  protein: 1,  carbs: 15, fat: 0,   category: 'Drinks' },
  { id: 'kombucha',             name: 'Kombucha (16 oz)',             calories: 60,  protein: 0,  carbs: 14, fat: 0,   category: 'Drinks' },
  { id: 'beer-regular',         name: 'Beer (12 oz)',                 calories: 153, protein: 1,  carbs: 13, fat: 0,   category: 'Drinks' },
  { id: 'beer-light',           name: 'Light Beer (12 oz)',           calories: 103, protein: 1,  carbs: 6,  fat: 0,   category: 'Drinks' },
  { id: 'wine-red',             name: 'Red Wine (5 oz)',              calories: 125, protein: 0,  carbs: 4,  fat: 0,   category: 'Drinks' },
  { id: 'protein-coffee',       name: 'Protein Coffee (16 oz)',       calories: 160, protein: 20, carbs: 8,  fat: 3,   category: 'Drinks' },

  // ── SUPPLEMENTS ───────────────────────────────────────
  { id: 'creatine',             name: 'Creatine (5g serving)',        calories: 0,   protein: 0,  carbs: 0,  fat: 0,   category: 'Supplements' },
  { id: 'bcaa-drink',           name: 'BCAA Drink',                   calories: 15,  protein: 5,  carbs: 1,  fat: 0,   category: 'Supplements' },
  { id: 'pre-workout-powder',   name: 'Pre-Workout Powder',           calories: 20,  protein: 0,  carbs: 5,  fat: 0,   category: 'Supplements' },
  { id: 'fish-oil',             name: 'Fish Oil (1 serving)',         calories: 45,  protein: 0,  carbs: 0,  fat: 5,   category: 'Supplements' },
];

export function searchFoods(query) {
  if (!query || query.length < 1) return FOOD_DATABASE.slice(0, 12);
  const q = query.toLowerCase();
  return FOOD_DATABASE.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  ).slice(0, 10);
}

// ── Post-workout calorie burn estimate ─────────────────

export function estimateCaloriesBurned(workout, weightLbs = 170) {
  const weightKg = weightLbs * 0.453592;

  if (workout.type === 'run') {
    const dist = workout.details?.actualDistance || workout.details?.plannedDistance || 0;
    const km = dist * 1.60934;
    return Math.round(weightKg * km);
  }

  if (workout.type === 'lift') {
    const duration = workout.details?.duration || 60;
    return Math.round(duration * 5);
  }

  if (workout.type === 'cardio') {
    const duration = workout.details?.duration || 30;
    return Math.round(duration * 7);
  }

  return 0;
}

export function shouldShowPostWorkoutPrompt(workout) {
  if (workout.type === 'run') {
    const dist = workout.details?.actualDistance || 0;
    return dist >= 6;
  }
  if (workout.type === 'lift') {
    const duration = workout.details?.duration || 0;
    const sets = workout.details?.totalSets || 0;
    const estimatedDuration = duration || sets * 3;
    return estimatedDuration >= 45;
  }
  return false;
}