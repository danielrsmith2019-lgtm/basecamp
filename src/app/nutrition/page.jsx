'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useWorkouts } from '@/lib/WorkoutContext';
import { getUserSettings, getNutritionLog, saveNutritionLog } from '@/lib/database';
import {
  getTrainingCalorieBonus, getFuelStatus,
  getMealTimeGroup, MEAL_ORDER, searchFoods, FOOD_DATABASE,
} from '@/utils/nutrition';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Plus, Search, X, ChevronDown, ChevronUp } from 'lucide-react';

const MEAL_ICONS = {
  Breakfast: '🌅',
  Lunch:     '☀️',
  Dinner:    '🌙',
  Snacks:    '🍎',
};

export default function NutritionPage() {
  const { user } = useAuth();
  const { workouts } = useWorkouts();

  const today = new Date().toISOString().split('T')[0];

  // ── Settings ───────────────────────────────────────────
  const [calorieTarget,  setCalorieTarget]  = useState(2000);
  const [proteinTarget,  setProteinTarget]  = useState(150);
  const [userWeight,     setUserWeight]     = useState(170);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ── Nutrition log ──────────────────────────────────────
  const [entries,   setEntries]   = useState([]);
  const [logLoaded, setLogLoaded] = useState(false);

  // ── UI state ───────────────────────────────────────────
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [selectedMeal,  setSelectedMeal]  = useState('Breakfast');
  const [customEntry,   setCustomEntry]   = useState({ name: '', calories: '', protein: '' });
  const [showCustom,    setShowCustom]    = useState(false);
  const [weeklyData,    setWeeklyData]    = useState([]);
  const [collapsedMeals, setCollapsedMeals] = useState(new Set());

  const searchRef = useRef(null);

  // ── Load settings + log ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function load() {
      const settings = await getUserSettings(user.id);
      if (settings) {
        setCalorieTarget(settings.calorie_target || 2000);
        setProteinTarget(settings.protein_target || 150);
        setUserWeight(settings.weight || 170);
      }
      setSettingsLoaded(true);

      const log = await getNutritionLog(user.id, today);
      if (log?.meals) setEntries(log.meals);
      setLogLoaded(true);

      // Load weekly data
      const weekEntries = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLog = await getNutritionLog(user.id, dateStr);
        const dayMeals = dayLog?.meals || [];
        const cals = dayMeals.reduce((s, e) => s + (e.calories || 0), 0);
        weekEntries.push({
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: dateStr,
          calories: cals,
        });
      }
      setWeeklyData(weekEntries);
    }
    load();
  }, [user, today]);

  // ── Today's workouts ───────────────────────────────────
  const todayWorkouts = useMemo(() =>
    workouts.filter(w => w.date === today && w.type !== 'rest'),
  [workouts, today]);

  // ── Training-adjusted calorie target ───────────────────
  const calorieBonus = useMemo(() =>
    getTrainingCalorieBonus(todayWorkouts, userWeight),
  [todayWorkouts, userWeight]);

  const adjustedTarget = calorieTarget + calorieBonus;

  // ── Totals ─────────────────────────────────────────────
  const totals = useMemo(() => ({
    calories: entries.reduce((s, e) => s + (e.calories || 0), 0),
    protein:  entries.reduce((s, e) => s + (e.protein  || 0), 0),
  }), [entries]);

  const caloriePct = Math.min(100, Math.round((totals.calories / adjustedTarget) * 100));
  const proteinPct = Math.min(100, Math.round((totals.protein  / proteinTarget)  * 100));

  // ── Grouped meals ──────────────────────────────────────
  const groupedMeals = useMemo(() => {
    const groups = {};
    MEAL_ORDER.forEach(g => { groups[g] = []; });
    entries.forEach(e => {
      const group = e.mealGroup || getMealTimeGroup(e.time);
      if (!groups[group]) groups[group] = [];
      groups[group].push(e);
    });
    return groups;
  }, [entries]);

  // ── Save to Supabase ───────────────────────────────────
  async function persistEntries(newEntries) {
    setEntries(newEntries);
    if (!user) return;
    const totals = {
      calories: newEntries.reduce((s, e) => s + (e.calories || 0), 0),
      protein:  newEntries.reduce((s, e) => s + (e.protein  || 0), 0),
    };
    await saveNutritionLog(user.id, today, { meals: newEntries, daily_totals: totals });
  }

  // ── Add food entry ─────────────────────────────────────
  function addFoodEntry(food) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newEntry = {
      id:        `${Date.now()}-${Math.random()}`,
      name:      food.name,
      calories:  food.calories,
      protein:   food.protein  || 0,
      carbs:     food.carbs    || 0,
      fat:       food.fat      || 0,
      time,
      mealGroup: selectedMeal,
    };
    persistEntries([...entries, newEntry]);
    setSearchQuery('');
    setShowSearch(false);
  }

  function addCustomEntry() {
    if (!customEntry.name || !customEntry.calories) return;
    addFoodEntry({
      name:     customEntry.name,
      calories: parseInt(customEntry.calories) || 0,
      protein:  parseInt(customEntry.protein)  || 0,
      carbs: 0, fat: 0,
    });
    setCustomEntry({ name: '', calories: '', protein: '' });
    setShowCustom(false);
  }

  function removeEntry(id) {
    persistEntries(entries.filter(e => e.id !== id));
  }

  function toggleMeal(meal) {
    setCollapsedMeals(prev => {
      const next = new Set(prev);
      next.has(meal) ? next.delete(meal) : next.add(meal);
      return next;
    });
  }

  const searchResults = useMemo(() => searchFoods(searchQuery), [searchQuery]);

  if (!logLoaded || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="bc-caption uppercase tracking-wider">Nutrition</h2>
        <span className="text-xs text-secondary">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* ── Training bonus banner ── */}
      {calorieBonus > 0 && (
        <div className="bc-card mb-4 bg-run-bg border-l-4 border-run-accent">
          <div className="flex items-center gap-2">
            <span className="text-base">🏃</span>
            <div>
              <p className="text-xs font-semibold text-run-accent">
                Training day — target increased by {calorieBonus} cal
              </p>
              <p className="bc-caption">
                Based on {todayWorkouts.length} session{todayWorkouts.length !== 1 ? 's' : ''} scheduled today
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress rings ── */}
      <div className="bc-card mb-6">
        <div className="flex items-center justify-around py-2">

          {/* Calories ring */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 96 96" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="48" cy="48" r="40" fill="none" stroke="#F2F2F7" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none"
                  stroke={caloriePct >= 90 ? '#34C759' : caloriePct >= 60 ? '#FF9500' : '#007AFF'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - caloriePct / 100)}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="bc-data text-lg font-bold text-primary">{caloriePct}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                {totals.calories.toLocaleString()}
              </p>
              <p className="bc-caption">of {adjustedTarget.toLocaleString()} cal</p>
              {calorieBonus > 0 && (
                <p className="text-[9px] text-run-accent mt-0.5">+{calorieBonus} training</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-20 w-px bg-border" />

          {/* Protein ring */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 96 96" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="48" cy="48" r="40" fill="none" stroke="#F2F2F7" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none"
                  stroke="#5856D6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - proteinPct / 100)}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="bc-data text-lg font-bold text-primary">{proteinPct}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">{totals.protein}g</p>
              <p className="bc-caption">of {proteinTarget}g protein</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-20 w-px bg-border" />

          {/* Quick macros */}
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <p className="bc-data text-sm font-bold text-primary">{totals.calories}</p>
              <p className="bc-caption">Calories</p>
            </div>
            <div className="text-center">
              <p className="bc-data text-sm font-bold" style={{ color: '#5856D6' }}>{totals.protein}g</p>
              <p className="bc-caption">Protein</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Log Food button ── */}
      <div className="flex gap-2 mb-4">
        <div className="bc-tab-bar flex-1">
          {MEAL_ORDER.map(meal => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              className={`bc-tab text-xs ${selectedMeal === meal ? 'bc-tab-active' : ''}`}>
              {meal}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); }}
          className="bc-btn-primary !w-auto !px-4 !py-2 flex items-center gap-1.5 text-sm">
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* ── Food search panel ── */}
      {showSearch && (
        <div className="bc-card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search foods..."
                className="bc-input !pl-8"
              />
            </div>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center
                         text-secondary hover:text-primary transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Search results */}
          <div className="space-y-1 max-h-64 overflow-auto">
            {searchResults.map(food => (
              <button
                key={food.id}
                onClick={() => addFoodEntry(food)}
                className="w-full flex items-center justify-between p-2.5 rounded-[10px]
                           hover:bg-canvas text-left transition-colors">
                <div>
                  <p className="text-sm font-medium text-primary">{food.name}</p>
                  <p className="bc-caption">{food.category}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="bc-data text-sm text-primary">{food.calories} cal</p>
                  <p className="bc-caption">{food.protein}g protein</p>
                </div>
              </button>
            ))}
          </div>

          {/* Custom entry toggle */}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="flex items-center gap-1.5 mt-3 text-xs text-bc-blue hover:underline">
            {showCustom ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Add custom food
          </button>

          {showCustom && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={customEntry.name}
                onChange={e => setCustomEntry(p => ({ ...p, name: e.target.value }))}
                placeholder="Food name"
                className="bc-input"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={customEntry.calories}
                  onChange={e => setCustomEntry(p => ({ ...p, calories: e.target.value }))}
                  placeholder="Calories"
                  className="bc-input bc-data"
                />
                <input
                  type="number"
                  value={customEntry.protein}
                  onChange={e => setCustomEntry(p => ({ ...p, protein: e.target.value }))}
                  placeholder="Protein (g)"
                  className="bc-input bc-data"
                />
              </div>
              <button
                onClick={addCustomEntry}
                disabled={!customEntry.name || !customEntry.calories}
                className="bc-btn-primary disabled:opacity-40">
                Add to {selectedMeal}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Meal log grouped by time ── */}
      <div className="space-y-4 mb-6">
        {MEAL_ORDER.map(mealGroup => {
          const mealEntries = groupedMeals[mealGroup] || [];
          const mealCals    = mealEntries.reduce((s, e) => s + (e.calories || 0), 0);
          const mealProtein = mealEntries.reduce((s, e) => s + (e.protein  || 0), 0);
          const isCollapsed = collapsedMeals.has(mealGroup);

          return (
            <div key={mealGroup} className="bc-card-flush">
              {/* Meal section header */}
              <button
                onClick={() => toggleMeal(mealGroup)}
                className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-base">{MEAL_ICONS[mealGroup]}</span>
                  <span className="text-sm font-semibold text-primary">{mealGroup}</span>
                  {mealEntries.length > 0 && (
                    <span className="bc-caption">
                      · {mealCals} cal · {mealProtein}g protein
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {mealEntries.length === 0 && (
                    <span className="bc-caption">Empty</span>
                  )}
                  {isCollapsed
                    ? <ChevronDown size={14} className="text-tertiary" />
                    : <ChevronUp   size={14} className="text-tertiary" />}
                </div>
              </button>

              {/* Meal entries */}
              {!isCollapsed && (
                <div className="border-t border-border">
                  {mealEntries.length > 0 ? (
                    mealEntries.map(entry => (
                      <div key={entry.id}
                        className="flex items-center justify-between px-4 py-3
                                   border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{entry.name}</p>
                          <p className="bc-caption">
                            {entry.time && <span>{entry.time} · </span>}
                            {entry.carbs > 0 && <span>{entry.carbs}g carbs · </span>}
                            {entry.fat > 0   && <span>{entry.fat}g fat</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                          <div className="text-right">
                            <p className="bc-data text-sm text-primary">{entry.calories}</p>
                            <p className="bc-caption">cal</p>
                          </div>
                          <div className="text-right">
                            <p className="bc-data text-sm" style={{ color: '#5856D6' }}>{entry.protein}g</p>
                            <p className="bc-caption">protein</p>
                          </div>
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className="w-6 h-6 rounded-full bg-canvas flex items-center justify-center
                                       text-tertiary hover:text-bc-red transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="bc-caption">No {mealGroup.toLowerCase()} logged yet.</p>
                      <button
                        onClick={() => {
                          setSelectedMeal(mealGroup);
                          setShowSearch(true);
                          setTimeout(() => searchRef.current?.focus(), 100);
                        }}
                        className="text-bc-blue text-xs mt-1 hover:underline">
                        + Add food
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Weekly chart ── */}
      {weeklyData.length > 0 && (
        <>
          <p className="bc-caption uppercase tracking-wider mb-3">Weekly Calories</p>
          <div className="bc-card p-5 mb-6">
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={4}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false}
                    tick={{ fill: '#8E8E93', fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '0.5px solid rgba(60,60,67,0.12)',
                      borderRadius: '14px',
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                    formatter={(val) => [`${val} cal`, 'Calories']}
                    cursor={{ fill: 'rgba(0,122,255,0.06)' }}
                  />
                  {/* Dashed target reference line */}
                  <ReferenceLine
                    y={adjustedTarget}
                    stroke="#007AFF"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{
                      value: `Target ${adjustedTarget}`,
                      position: 'insideTopRight',
                      fill: '#007AFF',
                      fontSize: 10,
                    }}
                  />
                  <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                    {weeklyData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.date === today ? '#007AFF' : '#BFDBFE'}
                        fillOpacity={0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#007AFF' }} />
                <span className="text-xs text-tertiary">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#BFDBFE' }} />
                <span className="text-xs text-tertiary">Past days</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-px" style={{ borderTop: '2px dashed #007AFF', opacity: 0.6 }} />
                <span className="text-xs text-tertiary">Target</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}