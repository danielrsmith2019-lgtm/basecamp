'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useWorkouts } from '@/lib/WorkoutContext';
import { getUserSettings, getNutritionLog, saveNutritionLog } from '@/lib/database';
import { getTrainingCalorieBonus, getMealTimeGroup, MEAL_ORDER } from '@/utils/nutrition';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  Plus, X, ChevronDown, ChevronUp,
  Footprints, Sun, Moon, Coffee, Apple, Flame,
} from 'lucide-react';
import FoodSearch from '@/components/shared/FoodSearch';

// ── Meal icons ──────────────────────────────────────────
const MEAL_ICON_MAP = {
  Breakfast: { Icon: Coffee, color: '#FF9500', bg: '#FFF3E0' },
  Lunch:     { Icon: Sun,    color: '#FF9500', bg: '#FFF3E0' },
  Dinner:    { Icon: Moon,   color: '#5856D6', bg: '#E8EAF6' },
  Snacks:    { Icon: Apple,  color: '#34C759', bg: '#E8F5E9' },
};


export default function NutritionPage() {
  const { user } = useAuth();
  const { workouts } = useWorkouts();
  const today = new Date().toLocaleDateString('en-CA');

  const [calorieTarget,    setCalorieTarget]    = useState(2000);
  const [proteinTarget,    setProteinTarget]    = useState(150);
  const [userWeight,       setUserWeight]       = useState(170);
  const [settingsLoaded,   setSettingsLoaded]   = useState(false);
  const [entries,          setEntries]          = useState([]);
  const [logLoaded,        setLogLoaded]        = useState(false);
  const [weeklyData,       setWeeklyData]       = useState([]);
  const [showSearch,       setShowSearch]       = useState(false);
  const [selectedMeal,     setSelectedMeal]     = useState('Breakfast');
  const [collapsedMeals,   setCollapsedMeals]   = useState(new Set());

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

      const weekEntries = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLog = await getNutritionLog(user.id, dateStr);
        const cals = (dayLog?.meals || []).reduce((s, e) => s + (e.calories || 0), 0);
        weekEntries.push({
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: dateStr, calories: cals,
        });
      }
      setWeeklyData(weekEntries);
    }
    load();
  }, [user, today]);

  const todayWorkouts = useMemo(() =>
    workouts.filter(w => w.date === today && w.type !== 'rest'),
  [workouts, today]);

  const calorieBonus = useMemo(() =>
    getTrainingCalorieBonus(todayWorkouts, userWeight),
  [todayWorkouts, userWeight]);

  const adjustedTarget = calorieTarget + calorieBonus;

  const exerciseCaloriesBurned = useMemo(() =>
    workouts
      .filter(w => w.date === today && w.status === 'completed' && w.details?.caloriesBurned)
      .reduce((s, w) => s + (w.details.caloriesBurned || 0), 0),
  [workouts, today]);

  const totals = useMemo(() => ({
    calories: entries.reduce((s, e) => s + (e.calories || 0), 0),
    protein:  entries.reduce((s, e) => s + (e.protein  || 0), 0),
    carbs:    entries.reduce((s, e) => s + (e.carbs    || 0), 0),
    fat:      entries.reduce((s, e) => s + (e.fat      || 0), 0),
  }), [entries]);

  const caloriePct = Math.min(100, Math.round((totals.calories / adjustedTarget) * 100));
  const proteinPct = Math.min(100, Math.round((totals.protein  / proteinTarget)  * 100));
  const remaining  = Math.max(0, adjustedTarget - totals.calories);

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

  async function persistEntries(newEntries) {
    setEntries(newEntries);
    if (!user) return;
    const t = {
      calories: newEntries.reduce((s, e) => s + (e.calories || 0), 0),
      protein:  newEntries.reduce((s, e) => s + (e.protein  || 0), 0),
      target:   adjustedTarget,
    };
    await saveNutritionLog(user.id, today, { meals: newEntries, daily_totals: t });
  }

  function addFoodEntry(food) {
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    persistEntries([...entries, {
      id: `${Date.now()}-${Math.random()}`,
      name: food.name, calories: food.calories,
      protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0,
      time, mealGroup: selectedMeal,
    }]);
    setShowSearch(false);
  }

  function removeEntry(id) { persistEntries(entries.filter(e => e.id !== id)); }

  function toggleMeal(meal) {
    setCollapsedMeals(prev => {
      const next = new Set(prev);
      next.has(meal) ? next.delete(meal) : next.add(meal);
      return next;
    });
  }

  function openSearch(meal) {
    setSelectedMeal(meal);
    setShowSearch(true);
  }

  if (!logLoaded || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="bc-caption uppercase tracking-wider">Nutrition</h2>
        <span className="text-xs text-secondary">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Training bonus */}
      {calorieBonus > 0 && (
        <div className="bc-card mb-3 bg-run-bg border-l-4 border-run-accent">
          <div className="flex items-center gap-2">
            <Footprints size={16} strokeWidth={2} className="text-run-accent flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-run-accent">Training day — target +{calorieBonus} cal</p>
              <p className="bc-caption">{todayWorkouts.length} session{todayWorkouts.length !== 1 ? 's' : ''} today</p>
            </div>
          </div>
        </div>
      )}

      {/* Exercise calories burned */}
      {exerciseCaloriesBurned > 0 && (
        <div className="bc-card mb-3 bg-lift-bg border-l-4 border-lift-accent">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame size={16} strokeWidth={2} className="text-lift-accent flex-shrink-0" />
              <p className="text-xs font-semibold text-lift-accent">{exerciseCaloriesBurned.toLocaleString()} cal burned training</p>
            </div>
            <p className="bc-caption flex-shrink-0">Net: {Math.max(0, totals.calories - exerciseCaloriesBurned).toLocaleString()} cal</p>
          </div>
        </div>
      )}

      {/* ── Summary card ── */}
      <div className="bc-card mb-5">
        {/* Calorie row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="bc-caption uppercase tracking-wider mb-0.5">Calories</p>
            <div className="flex items-baseline gap-1.5">
              <span className="bc-data text-2xl font-bold text-primary">{totals.calories.toLocaleString()}</span>
              <span className="text-sm text-tertiary">/ {adjustedTarget.toLocaleString()}</span>
            </div>
            <p className="bc-caption mt-0.5">
              {remaining > 0
                ? <span className="text-bc-blue">{remaining.toLocaleString()} remaining</span>
                : <span className="text-bc-green-dark">Goal reached!</span>}
            </p>
          </div>
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#F2F2F7" strokeWidth="7" />
              <circle cx="40" cy="40" r="34" fill="none"
                stroke={caloriePct >= 100 ? '#34C759' : caloriePct >= 60 ? '#FF9500' : '#007AFF'}
                strokeWidth="7" strokeLinecap="round" strokeDasharray="213.6"
                strokeDashoffset={213.6 * (1 - Math.min(caloriePct, 100) / 100)}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bc-data text-sm font-bold text-primary">{caloriePct}%</span>
            </div>
          </div>
        </div>

        {/* Macro progress bars */}
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-secondary">Protein</span>
              <span className="bc-data text-xs" style={{ color: '#5856D6' }}>{totals.protein}g / {proteinTarget}g</span>
            </div>
            <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, proteinPct)}%`, background: '#5856D6' }} />
            </div>
          </div>
          {totals.carbs > 0 && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-secondary">Carbs</span>
                <span className="bc-data text-xs text-bc-orange-dark">{totals.carbs}g</span>
              </div>
              <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totals.carbs / 250) * 100)}%`, background: '#FF9500' }} />
              </div>
            </div>
          )}
          {totals.fat > 0 && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-secondary">Fat</span>
                <span className="bc-data text-xs text-bc-green-dark">{totals.fat}g</span>
              </div>
              <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totals.fat / 80) * 100)}%`, background: '#34C759' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Meal tabs + Add ── */}
      <div className="flex gap-2 mb-4">
        <div className="bc-tab-bar flex-1 overflow-x-auto">
          {MEAL_ORDER.map(meal => {
            const isActive = selectedMeal === meal;
            const config = MEAL_ICON_MAP[meal];
            return (
              <button key={meal} onClick={() => setSelectedMeal(meal)}
                className="bc-tab text-xs whitespace-nowrap flex items-center gap-1"
                style={{
                  background:   isActive ? '#007AFF' : 'transparent',
                  color:        isActive ? '#FFFFFF' : '#8E8E93',
                  fontWeight:   isActive ? 600 : 500,
                  borderRadius: '10px', flex: 1,
                }}>
                {config && <config.Icon size={11} strokeWidth={2} style={{ color: isActive ? '#FFFFFF' : config.color, flexShrink: 0 }} />}
                {meal}
              </button>
            );
          })}
        </div>
        <button onClick={() => openSearch(selectedMeal)}
          className="bc-btn-primary !w-auto !px-4 !py-2 flex items-center gap-1.5 text-sm min-h-[44px]">
          <Plus size={14} /> Add
        </button>
      </div>

      {/* ── Search panel ── */}
      {showSearch && (
        <div className="bc-card mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Add to {selectedMeal}</p>
            <button onClick={() => setShowSearch(false)}
              className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary transition-colors">
              <X size={14} />
            </button>
          </div>
          <FoodSearch onSelect={addFoodEntry} />
        </div>
      )}

      {/* ── Meal sections ── */}
      <div className="space-y-3 mb-6">
        {MEAL_ORDER.map(mealGroup => {
          const mealEntries = groupedMeals[mealGroup] || [];
          const mealCals    = mealEntries.reduce((s, e) => s + (e.calories || 0), 0);
          const mealProtein = mealEntries.reduce((s, e) => s + (e.protein  || 0), 0);
          const isCollapsed = collapsedMeals.has(mealGroup);
          const mealConfig  = MEAL_ICON_MAP[mealGroup];

          return (
            <div key={mealGroup} className="bc-card-flush">
              <button onClick={() => toggleMeal(mealGroup)}
                className="w-full flex items-center justify-between p-4 hover:bg-canvas transition-colors min-h-[44px]">
                <div className="flex items-center gap-2">
                  {mealConfig && (
                    <div style={{ width: 28, height: 28, borderRadius: '8px', background: mealConfig.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <mealConfig.Icon size={14} strokeWidth={2} style={{ color: mealConfig.color }} />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-primary">{mealGroup}</span>
                  {mealEntries.length > 0 && (
                    <>
                      <span className="bc-caption hidden sm:inline">· {mealCals} cal · {mealProtein}g protein</span>
                      <span className="bc-caption sm:hidden">· {mealCals} cal</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {mealEntries.length === 0 && (
                    <button onClick={e => { e.stopPropagation(); openSearch(mealGroup); }}
                      className="text-xs text-bc-blue hover:underline px-2 py-1">+ Add</button>
                  )}
                  {isCollapsed ? <ChevronDown size={14} className="text-tertiary" /> : <ChevronUp size={14} className="text-tertiary" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t border-border">
                  {mealEntries.length > 0 ? (
                    <>
                      {mealEntries.map(entry => (
                        <div key={entry.id}
                          className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{entry.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {entry.time && <span className="bc-caption">{entry.time}</span>}
                              {entry.protein > 0 && <span className="bc-caption" style={{ color: '#5856D6' }}>{entry.protein}g pro</span>}
                              {entry.carbs > 0 && <span className="bc-caption text-bc-orange-dark">{entry.carbs}g carbs</span>}
                              {entry.fat > 0 && <span className="bc-caption text-bc-green-dark">{entry.fat}g fat</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="text-right">
                              <p className="bc-data text-sm text-primary">{entry.calories}</p>
                              <p className="bc-caption">cal</p>
                            </div>
                            <button onClick={() => removeEntry(entry.id)}
                              className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-tertiary hover:text-bc-red transition-colors min-w-[44px] min-h-[44px]">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openSearch(mealGroup)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-bc-blue hover:bg-canvas transition-colors">
                        <Plus size={12} /> Add to {mealGroup}
                      </button>
                    </>
                  ) : (
                    <div className="px-4 py-5 text-center">
                      <p className="bc-caption">Nothing logged yet.</p>
                      <button onClick={() => openSearch(mealGroup)}
                        className="text-bc-blue text-xs mt-1 hover:underline min-h-[44px]">+ Add food</button>
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
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={4}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '0.5px solid rgba(60,60,67,0.12)', borderRadius: '14px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    formatter={val => [`${val} cal`, 'Calories']}
                    cursor={{ fill: 'rgba(0,122,255,0.06)' }}
                  />
                  <ReferenceLine y={adjustedTarget} stroke="#007AFF" strokeDasharray="4 4" strokeOpacity={0.6}
                    label={{ value: `${adjustedTarget} target`, position: 'insideTopRight', fill: '#007AFF', fontSize: 10 }} />
                  <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                    {weeklyData.map((entry, i) => (
                      <Cell key={i} fill={entry.date === today ? '#007AFF' : '#BFDBFE'} fillOpacity={0.9} />
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