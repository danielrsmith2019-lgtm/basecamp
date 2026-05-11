'use client';

import { useState } from 'react';
import CalorieTracker from '@/components/nutrition/CalorieTracker';
import { createNutritionLog, createFoodEntry, recalculateNutritionTotals } from '@/data/types';

// Create sample data with some pre-logged foods
function buildSampleNutrition() {
  const log = createNutritionLog({
    date: '2026-05-06',
    calorieTarget: 2600,
    proteinTarget: 180,
  });

  log.meals[0].foods = [
    createFoodEntry({ label: 'Protein shake', calories: 320, protein: 40, carbs: 15, fat: 8 }),
    createFoodEntry({ label: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 }),
    createFoodEntry({ label: 'Oatmeal with honey', calories: 280, protein: 8, carbs: 48, fat: 6 }),
  ];

  log.meals[1].foods = [
    createFoodEntry({ label: 'Chicken breast (8 oz)', calories: 420, protein: 52, carbs: 0, fat: 10 }),
    createFoodEntry({ label: 'Brown rice', calories: 220, protein: 5, carbs: 45, fat: 2 }),
    createFoodEntry({ label: 'Mixed vegetables', calories: 80, protein: 3, carbs: 14, fat: 1 }),
  ];

  return recalculateNutritionTotals(log);
}

export default function NutritionTestPage() {
  const [nutritionLog, setNutritionLog] = useState(() => buildSampleNutrition());

  return (
    <div className="min-h-screen bg-base text-primary">
      <header className="bg-card border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold">
          <span className="text-accent">BASE</span>CAMP
          <span className="text-muted text-sm font-normal ml-3">Nutrition Test</span>
        </h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        <h2 className="stride-section-label">Daily Nutrition — May 6, 2026</h2>
        <CalorieTracker
          nutritionLog={nutritionLog}
          onChange={setNutritionLog}
        />
      </main>
    </div>
  );
}