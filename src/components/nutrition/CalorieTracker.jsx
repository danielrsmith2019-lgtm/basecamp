'use client';

/**
 * CalorieTracker — Daily nutrition view with meal sections.
 * Ported from the Fitness App. Reskinned to STRIDE design system.
 * 
 * Numbers in font-mono. Progress uses STRIDE gradient fills.
 */

import { useState, useMemo } from 'react';
import { recalculateNutritionTotals, createFoodEntry } from '@/data/types';

export default function CalorieTracker({ nutritionLog, onChange }) {
  const [quickAddLabel, setQuickAddLabel] = useState('');
  const [quickAddCalories, setQuickAddCalories] = useState('');
  const [quickAddProtein, setQuickAddProtein] = useState('');
  const [activeMeal, setActiveMeal] = useState('Lunch');

  if (!nutritionLog) return null;

  const { meals, totals, calorieTarget, proteinTarget } = nutritionLog;
  const calPercent = Math.min((totals.calories / calorieTarget) * 100, 100);
  const proPercent = Math.min((totals.protein / proteinTarget) * 100, 100);

  function handleQuickAdd() {
    if (!quickAddCalories) return;

    const food = createFoodEntry({
      label: quickAddLabel || 'Quick add',
      calories: Number(quickAddCalories) || 0,
      protein: Number(quickAddProtein) || 0,
      carbs: 0,
      fat: 0,
      servings: 1,
    });

    const updatedMeals = meals.map(meal => {
      if (meal.name !== activeMeal) return meal;
      return { ...meal, foods: [...meal.foods, food] };
    });

    const updated = recalculateNutritionTotals({ ...nutritionLog, meals: updatedMeals });
    onChange(updated);

    setQuickAddLabel('');
    setQuickAddCalories('');
    setQuickAddProtein('');
  }

  function removeFood(mealName, foodId) {
    const updatedMeals = meals.map(meal => {
      if (meal.name !== mealName) return meal;
      return { ...meal, foods: meal.foods.filter(f => f.id !== foodId) };
    });
    const updated = recalculateNutritionTotals({ ...nutritionLog, meals: updatedMeals });
    onChange(updated);
  }

  return (
    <div>
      {/* ── Daily Totals ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Calories */}
        <div className="stride-card p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="stride-section-label mb-0">Calories</span>
            <span className="text-xs text-secondary">
              <span className="stride-data">{calorieTarget}</span> target
            </span>
          </div>
          <p className="stride-data text-3xl font-bold text-primary mb-2">
            {totals.calories}
          </p>
          <div className="stride-progress-track">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-completion)]"
              style={{ width: `${calPercent}%`, transition: 'width 0.5s ease' }}
            />
          </div>
          <p className="text-xs text-muted mt-1">
            <span className="stride-data">{Math.max(calorieTarget - totals.calories, 0)}</span> remaining
          </p>
        </div>

        {/* Protein */}
        <div className="stride-card p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="stride-section-label mb-0">Protein</span>
            <span className="text-xs text-secondary">
              <span className="stride-data">{proteinTarget}g</span> target
            </span>
          </div>
          <p className="stride-data text-3xl font-bold text-primary mb-2">
            {totals.protein}<span className="text-lg text-secondary">g</span>
          </p>
          <div className="stride-progress-track">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-mileage)]"
              style={{ width: `${proPercent}%`, transition: 'width 0.5s ease' }}
            />
          </div>
          <p className="text-xs text-muted mt-1">
            <span className="stride-data">{Math.max(proteinTarget - totals.protein, 0)}g</span> remaining
          </p>
        </div>
      </div>

      {/* ── Quick Add Form ── */}
      <div className="stride-card p-4 mb-6">
        <p className="stride-section-label">Quick Add</p>
        <div className="flex items-center gap-2 mb-2">
          {meals.map(meal => (
            <button
              key={meal.name}
              onClick={() => setActiveMeal(meal.name)}
              className={`
                px-3 py-1 text-xs rounded-lg transition-colors
                ${activeMeal === meal.name
                  ? 'bg-accent text-white'
                  : 'bg-surface text-secondary hover:text-primary'
                }
              `}
            >
              {meal.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={quickAddLabel}
            onChange={(e) => setQuickAddLabel(e.target.value)}
            placeholder="Food name"
            className="flex-1 bg-card border border-border text-primary text-sm rounded-lg
                       px-3 py-2 focus:outline-none focus:border-accent placeholder:text-muted"
          />
          <input
            type="number"
            value={quickAddCalories}
            onChange={(e) => setQuickAddCalories(e.target.value)}
            placeholder="Cal"
            className="w-20 bg-card border border-border text-primary text-sm rounded-lg
                       px-3 py-2 focus:outline-none focus:border-accent placeholder:text-muted
                       stride-data text-center
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <input
            type="number"
            value={quickAddProtein}
            onChange={(e) => setQuickAddProtein(e.target.value)}
            placeholder="Pro"
            className="w-20 bg-card border border-border text-primary text-sm rounded-lg
                       px-3 py-2 focus:outline-none focus:border-accent placeholder:text-muted
                       stride-data text-center
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleQuickAdd}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg
                       hover:brightness-110 transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Meal Sections ── */}
      {meals.map(meal => {
        const mealCalories = meal.foods.reduce((sum, f) => sum + (f.calories * f.servings), 0);
        const mealProtein = meal.foods.reduce((sum, f) => sum + (f.protein * f.servings), 0);

        return (
          <div key={meal.name} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="stride-section-label mb-0">{meal.name}</span>
              <div className="flex gap-3 text-xs text-secondary">
                <span className="stride-data">{mealCalories} cal</span>
                <span className="stride-data">{mealProtein}g pro</span>
              </div>
            </div>

            {meal.foods.length > 0 ? (
              <div className="space-y-1">
                {meal.foods.map(food => (
                  <div
                    key={food.id}
                    className="flex items-center justify-between bg-surface rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-primary">{food.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="stride-data text-xs text-secondary">{food.calories} cal</span>
                      <span className="stride-data text-xs text-activity-nutrition">{food.protein}g</span>
                      <button
                        onClick={() => removeFood(meal.name, food.id)}
                        className="text-muted hover:text-status-skipped text-sm transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted bg-surface rounded-lg px-3 py-3 text-center">
                No foods logged
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}