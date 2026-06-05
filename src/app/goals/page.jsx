'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkouts } from '@/lib/WorkoutContext';
import { formatDate, parsePace } from '@/utils/runUtils';
import { calculateE1RM, formatVolume } from '@/utils/liftUtils';
import ProgressRing from '@/components/shared/ProgressRing';
import {
  Flag, Footprints, Dumbbell, Flame, Check, TrendingUp, TrendingDown,
  Plus, X, ChevronDown, ChevronUp, Calendar, Target, Scale,
  Star, Trophy, Zap, ArrowRight, Sparkles, Droplet,
} from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/lib/database';
import { useAuth } from '@/lib/auth';

// ── Helpers ─────────────────────────────────────────────────
function getLocalToday() { return new Date().toLocaleDateString('en-CA'); }

function isoWeekBounds() {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow)); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { mondayStr: mon.toLocaleDateString('en-CA'), sundayStr: sun.toLocaleDateString('en-CA') };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today  = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function fmtPace(decimalMins) {
  if (!decimalMins) return null;
  const m = Math.floor(decimalMins);
  const s = Math.round((decimalMins - m) * 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function loadCustomMilestones() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('bc-milestones') || '[]'); } catch { return []; }
}
function saveCustomMilestones(m) {
  try { localStorage.setItem('bc-milestones', JSON.stringify(m)); } catch {}
}

function calcNutritionPlan(direction, currentWeight, targetWeight, weeklyRate, tdee) {
  const deficitPerDay = Math.round(weeklyRate * 3500 / 7);
  const weeks = Math.round(Math.abs(targetWeight - currentWeight) / weeklyRate);
  const adjustedCal = direction === 'lose'
    ? Math.max(1500, Math.round(tdee - deficitPerDay))
    : Math.round(tdee + deficitPerDay);
  const protein    = direction === 'lose' ? Math.round(targetWeight * 1.0) : Math.round(targetWeight * 0.8);
  const proteinCal = protein * 4;
  const remaining  = adjustedCal - proteinCal;
  const fat   = Math.round(remaining * (direction === 'lose' ? 0.35 : 0.25) / 9);
  const carbs = Math.round(remaining * (direction === 'lose' ? 0.65 : 0.75) / 4);
  return { calories: adjustedCal, protein, carbs, fat, weeks, deficitPerDay };
}

// ── Milestone type config ────────────────────────────────────
const MILESTONE_TYPES = [
  { value:'run_distance', label:'Longest Run',      unit:'mi',   Icon:Footprints, color:'#34C759',  bg:'#E8F5E9'  },
  { value:'weekly_miles', label:'Weekly Miles PR',  unit:'mi',   Icon:TrendingUp, color:'#34C759',  bg:'#E8F5E9'  },
  { value:'lift_e1rm',    label:'Strength PR',      unit:'lbs',  Icon:Dumbbell,   color:'#007AFF',  bg:'#E3F2FD'  },
  { value:'streak',       label:'Streak',           unit:'days', Icon:Flame,      color:'#FF9500',  bg:'#FFF3E0'  },
  { value:'race_time',    label:'Race Time',         unit:'min',  Icon:Flag,       color:'#34C759',  bg:'#E8F5E9'  },
  { value:'body_weight',  label:'Body Weight',       unit:'lbs',  Icon:Scale,      color:'#AF52DE',  bg:'#F3E5F5'  },
  { value:'custom',       label:'Custom',            unit:'',     Icon:Star,       color:'#FF9500',  bg:'#FFF3E0'  },
];

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function GoalsPage() {
  const { workouts, prs, isLoaded } = useWorkouts();
  const { user } = useAuth();
  const router   = useRouter();
  const today    = getLocalToday();

  const formRef       = useRef(null);
  const milestonesRef = useRef(null);

  const [settings,        setSettings]       = useState({});
  const [settingsLoaded,  setSettingsLoaded]  = useState(false);
  const [milestones,      setMilestones]      = useState(loadCustomMilestones);
  const [showSetup,       setShowSetup]       = useState(null);
  const [expandedSection, setExpandedSection] = useState({ race:true, weekly:true, milestones:true });

  // Race goal
  const [raceDate,     setRaceDate]     = useState('');
  const [raceName,     setRaceName]     = useState('');
  const [raceGoalTime, setRaceGoalTime] = useState('');
  const [raceDistance, setRaceDistance] = useState('marathon');

  // Weekly targets
  const [weeklyMileTarget, setWeeklyMileTarget] = useState('');
  const [weeklyLiftTarget, setWeeklyLiftTarget] = useState('');
  const [weeklyDaysTarget, setWeeklyDaysTarget] = useState('');

  // Milestone form
  const [msType,    setMsType]    = useState('run_distance');
  const [msTitle,   setMsTitle]   = useState('');
  const [msTarget,  setMsTarget]  = useState('');
  const [msCurrent, setMsCurrent] = useState('');
  const [msUnit,    setMsUnit]    = useState('mi');
  const [msDeadline,setMsDeadline]= useState('');

  // Body weight goal form
  const [bwDirection, setBwDirection] = useState('lose');
  const [bwCurrent,   setBwCurrent]   = useState('');
  const [bwTarget,    setBwTarget]    = useState('');
  const [bwRate,      setBwRate]      = useState(1.0);
  const [bwStep,      setBwStep]      = useState('fields'); // 'fields' | 'confirm'
  const [bwNutrPlan,  setBwNutrPlan]  = useState(null);
  const [savingBw,    setSavingBw]    = useState(false);
  const [toast,       setToast]       = useState(null);
  const toastRef = useRef(null);

  // ── Settings load ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function loadSettings() {
      const s = await getUserSettings(user.id);
      if (s) {
        setSettings(s);
        setRaceDate(s.race_date      || '');
        setRaceName(s.race_name      || '');
        setRaceGoalTime(s.race_goal_time  || '');
        setRaceDistance(s.race_distance  || 'marathon');
        setWeeklyMileTarget(s.weekly_mile_target ? String(s.weekly_mile_target) : '');
        setWeeklyLiftTarget(s.weekly_lift_target ? String(s.weekly_lift_target) : '');
        setWeeklyDaysTarget(s.weekly_days_target ? String(s.weekly_days_target) : '');
        if (s.body_weight_goal) {
          setBwCurrent(String(s.body_weight_goal.current_weight || ''));
          setBwTarget(String(s.body_weight_goal.target_weight || ''));
          setBwRate(s.body_weight_goal.weekly_rate || 1.0);
          setBwDirection(s.body_weight_goal.direction || 'lose');
        }
      }
      setSettingsLoaded(true);
    }
    loadSettings();
  }, [user]);

  // Scroll form into view when shown
  useEffect(() => {
    if (showSetup === 'milestone') {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
  }, [showSetup]);

  function showToast(msg) {
    clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!workouts.length) return null;
    const { mondayStr, sundayStr } = isoWeekBounds();
    const runs  = workouts.filter(w => w.type === 'run');
    const lifts = workouts.filter(w => w.type === 'lift');
    const cRuns  = runs.filter(w => w.status === 'completed');
    const cLifts = lifts.filter(w => w.status === 'completed');

    const wkRuns  = cRuns.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const wkLifts = cLifts.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const wkAll   = workouts.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status === 'completed' && w.type !== 'rest');
    const wkMiles = wkRuns.reduce((s,w) => s+(w.details?.actualDistance||0), 0);
    const wkDays  = new Set(wkAll.map(w => w.date)).size;

    const wkPlannedRuns  = runs.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').length;
    const wkPlannedLifts = lifts.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').length;
    const wkPlannedMiles = runs.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').reduce((s,w) => s+(w.details?.plannedDistance||0),0);

    const longRuns = cRuns.filter(w => (w.details?.actualDistance||0) >= 8 && w.details?.actualPace)
      .sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
    const avgPaceDec = longRuns.length
      ? longRuns.map(r => parsePace(r.details.actualPace)).filter(Boolean).reduce((a,b)=>a+b,0) / longRuns.length
      : null;

    const weekBuckets = {};
    cRuns.forEach(w => {
      const d = new Date(w.date+'T00:00:00'), dow = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate()+(dow===0?-6:1-dow));
      const k = mon.toLocaleDateString('en-CA');
      weekBuckets[k] = (weekBuckets[k]||0)+(w.details?.actualDistance||0);
    });
    const bestWeekMiles = Math.max(0, ...Object.values(weekBuckets));
    const longestRun = cRuns.reduce((m,w) => Math.max(m, w.details?.actualDistance||0), 0);

    const doneSet = new Set(workouts.filter(w=>w.status==='completed').map(w=>w.date));
    let streak = 0;
    if (doneSet.has(today)) streak++;
    const check = new Date(); check.setDate(check.getDate()-1);
    for (let i=0;i<365;i++){
      const ds = check.toLocaleDateString('en-CA');
      if (doneSet.has(ds)) { streak++; check.setDate(check.getDate()-1); } else break;
    }

    const past = workouts.filter(w => w.date <= today && w.type !== 'rest');
    const adherencePct = past.length ? Math.round((past.filter(w=>w.status==='completed').length/past.length)*100) : 0;

    const strengthBests = {};
    cLifts.forEach(w => (w.details?.exercises||[]).forEach(ex => {
      if (!ex.name || !Array.isArray(ex.sets)) return;
      ex.sets.forEach(s => {
        if (!s.completed || !s.weight || !s.reps) return;
        const e1rm = calculateE1RM(s.weight, s.reps);
        if (!strengthBests[ex.name] || e1rm > strengthBests[ex.name]) strengthBests[ex.name] = e1rm;
      });
    }));

    const phaseCounts = {};
    workouts.forEach(w => { const p = w.details?.phase; if (p) phaseCounts[p]=(phaseCounts[p]||0)+1; });
    const currentPhase = Object.keys(phaseCounts).sort((a,b)=>phaseCounts[b]-phaseCounts[a])[0]||null;
    const phaseRuns = currentPhase ? runs.filter(w=>w.details?.phase===currentPhase) : [];
    const phaseRunsDone  = phaseRuns.filter(w=>w.status==='completed').length;
    const phaseRunsTotal = phaseRuns.filter(w=>w.status!=='skipped').length;

    return {
      wkMiles: parseFloat(wkMiles.toFixed(1)), wkLiftSessions: wkLifts.length, wkDays,
      wkPlannedMiles: parseFloat(wkPlannedMiles.toFixed(1)), wkPlannedRuns, wkPlannedLifts,
      avgPaceDec, longRuns, bestWeekMiles: parseFloat(bestWeekMiles.toFixed(1)),
      longestRun: parseFloat(longestRun.toFixed(1)), streak, adherencePct, strengthBests,
      currentPhase, phaseRunsDone, phaseRunsTotal,
    };
  }, [workouts, today]);

  const raceStats = useMemo(() => {
    if (!settings.race_date) return null;
    const days = daysUntil(settings.race_date);
    const weeksLeft = days !== null ? Math.ceil(days / 7) : null;
    let goalPaceDec = null;
    if (settings.race_goal_time) {
      const parts = settings.race_goal_time.split(':').map(Number);
      let totalMins = parts.length === 3 ? parts[0]*60 + parts[1] + parts[2]/60 : parts[0] + parts[1]/60;
      const distMiles = settings.race_distance === 'marathon' ? 26.2 : settings.race_distance === 'half' ? 13.1 : settings.race_distance === '10k' ? 6.2 : 3.1;
      goalPaceDec = totalMins / distMiles;
    }
    let projectedTime = null, projectedPaceDec = null;
    if (stats?.avgPaceDec) {
      const distMiles = settings.race_distance === 'marathon' ? 26.2 : settings.race_distance === 'half' ? 13.1 : settings.race_distance === '10k' ? 6.2 : 3.1;
      projectedPaceDec = stats.avgPaceDec * 1.04;
      const projectedMins = projectedPaceDec * distMiles;
      const h = Math.floor(projectedMins / 60), m = Math.floor(projectedMins % 60), s = Math.round((projectedMins - Math.floor(projectedMins)) * 60);
      projectedTime = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    }
    let paceGapSec = null;
    if (goalPaceDec && projectedPaceDec) paceGapSec = Math.round((projectedPaceDec - goalPaceDec) * 60);
    let trajectory = null;
    if (stats?.longRuns?.length >= 2) {
      const oldest = parsePace(stats.longRuns[stats.longRuns.length-1].details.actualPace);
      const newest = parsePace(stats.longRuns[0].details.actualPace);
      if (oldest && newest) trajectory = newest < oldest ? 'improving' : newest > oldest ? 'declining' : 'steady';
    }
    return { days, weeksLeft, goalPaceDec, projectedTime, projectedPaceDec, paceGapSec, trajectory };
  }, [settings, stats]);

  const hasActivePlan = useMemo(() =>
    workouts.some(w => w.status === 'planned' && w.date >= today),
  [workouts, today]);

  // ── Savers ────────────────────────────────────────────
  async function saveRaceGoal() {
    if (!user) return;
    const updates = { race_date: raceDate, race_name: raceName, race_goal_time: raceGoalTime, race_distance: raceDistance };
    await updateUserSettings(user.id, updates);
    setSettings(prev => ({ ...prev, ...updates }));
    setShowSetup(null);
  }

  async function saveWeeklyTargets() {
    if (!user) return;
    const updates = {
      weekly_mile_target: parseFloat(weeklyMileTarget) || null,
      weekly_lift_target: parseFloat(weeklyLiftTarget) || null,
      weekly_days_target: parseFloat(weeklyDaysTarget) || null,
    };
    await updateUserSettings(user.id, updates);
    setSettings(prev => ({ ...prev, ...updates }));
    setShowSetup(null);
  }

  function handleTypeChange(type) {
    const conf = MILESTONE_TYPES.find(t => t.value === type);
    setMsType(type);
    setMsUnit(conf?.unit || '');
    setMsTitle('');
    setBwStep('fields');
  }

  function handleBwNext() {
    const cur = parseFloat(bwCurrent), tgt = parseFloat(bwTarget);
    if (!cur || !tgt || cur === tgt) return;
    const tdee = settings.calorie_target || 2200;
    const plan = calcNutritionPlan(bwDirection, cur, tgt, bwRate, tdee);
    setBwNutrPlan(plan);
    setBwStep('confirm');
  }

  async function saveBodyWeightGoal(applyNutrition) {
    if (!user) return;
    setSavingBw(true);
    const cur = parseFloat(bwCurrent), tgt = parseFloat(bwTarget);
    const bwGoal = {
      direction: bwDirection,
      current_weight: cur,
      target_weight: tgt,
      weekly_rate: bwRate,
      start_weight: cur,
      start_date: today,
    };
    const updates = { body_weight_goal: bwGoal };
    if (applyNutrition && bwNutrPlan) {
      updates.calorie_target = bwNutrPlan.calories;
      updates.protein_target = bwNutrPlan.protein;
      updates.carb_target    = bwNutrPlan.carbs;
      updates.fat_target     = bwNutrPlan.fat;
    }
    await updateUserSettings(user.id, updates);
    setSettings(prev => ({ ...prev, ...updates }));
    setSavingBw(false);
    setShowSetup(null);
    setBwStep('fields');
    showToast(applyNutrition ? 'Goal saved + nutrition targets updated' : 'Body composition goal saved');
  }

  async function updateBodyWeightCurrent(newWeight) {
    if (!user) return;
    const updated = { ...settings.body_weight_goal, current_weight: newWeight };
    await updateUserSettings(user.id, { body_weight_goal: updated });
    setSettings(prev => ({ ...prev, body_weight_goal: updated }));
  }

  function addMilestone() {
    if (msType === 'body_weight') { handleBwNext(); return; }
    if (!msTarget || parseFloat(msTarget) <= 0) return;
    const typeConf = MILESTONE_TYPES.find(t => t.value === msType);
    const m = {
      id: `ms-${Date.now()}`,
      type: msType,
      title: msTitle || typeConf?.label || 'Milestone',
      target: parseFloat(msTarget),
      current: parseFloat(msCurrent) || 0,
      unit: msUnit || typeConf?.unit || '',
      deadline: msDeadline || null,
      createdAt: new Date().toISOString(),
    };
    const updated = [...milestones, m];
    setMilestones(updated); saveCustomMilestones(updated);
    setMsTitle(''); setMsTarget(''); setMsCurrent(''); setMsUnit('mi'); setMsDeadline(''); setMsType('run_distance');
    setShowSetup(null);
  }

  function updateMilestone(id, current) {
    const updated = milestones.map(m => m.id === id ? {...m, current: parseFloat(current)||0} : m);
    setMilestones(updated); saveCustomMilestones(updated);
  }
  function deleteMilestone(id) {
    const updated = milestones.filter(m => m.id !== id);
    setMilestones(updated); saveCustomMilestones(updated);
  }
  function toggleSection(key) {
    setExpandedSection(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!isLoaded || !settingsLoaded) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-tertiary text-sm">Loading…</p>
    </div>
  );

  const hasRaceGoal  = !!settings.race_date;
  const hasWeekly    = !!(settings.weekly_mile_target || settings.weekly_lift_target || settings.weekly_days_target);
  const hasMilestone = milestones.length > 0;
  const bwGoal       = settings.body_weight_goal;

  // Current milestone type config
  const curTypeConf = MILESTONE_TYPES.find(t => t.value === msType);

  return (
    <div className="pb-24 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-primary">Goals</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSetup('race')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[10px] border border-border text-secondary hover:text-primary transition-colors min-h-[36px]">
            <Flag size={12}/> Race
          </button>
          <button onClick={() => {
              setShowSetup('milestone');
              setExpandedSection(prev => ({ ...prev, milestones: true }));
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-bc-blue text-white text-xs font-semibold rounded-[10px] hover:opacity-90 active:scale-95 transition-all min-h-[36px]">
            <Plus size={12}/> Goal
          </button>
        </div>
      </div>

      {/* ══════════════════════ RACE / EVENT ══════════════════════ */}
      <SectionHeader title={hasRaceGoal ? (settings.race_name || 'Race Goal') : 'Race / Event'}
        icon={<Flag size={14} className="text-run-accent"/>}
        expanded={expandedSection.race} onToggle={() => toggleSection('race')}
        action={hasRaceGoal ? {label:'Edit', onClick:()=>setShowSetup('race')} : null}
      />

      {expandedSection.race && (
        showSetup === 'race' ? (
          <div className="bc-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-primary">Set Race Goal</p>
              <button onClick={() => setShowSetup(null)} className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary"><X size={12}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Race Name</label>
                <input type="text" value={raceName} onChange={e=>setRaceName(e.target.value)}
                  placeholder="e.g. Chicago Marathon" className="bc-input" style={{fontSize:16}}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Distance</label>
                  <select value={raceDistance} onChange={e=>setRaceDistance(e.target.value)} className="bc-input">
                    <option value="marathon">Marathon (26.2)</option>
                    <option value="half">Half (13.1)</option>
                    <option value="10k">10K</option>
                    <option value="5k">5K</option>
                  </select>
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Race Date</label>
                  <input type="date" value={raceDate} onChange={e=>setRaceDate(e.target.value)} min={today} className="bc-input"/>
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Goal Finish Time (H:MM:SS)</label>
                <input type="text" value={raceGoalTime} onChange={e=>setRaceGoalTime(e.target.value)}
                  placeholder="3:45:00" className="bc-input font-mono" style={{fontSize:16}}/>
              </div>
              <button onClick={saveRaceGoal} className="bc-btn-primary w-full min-h-[44px] text-sm">Save Race Goal</button>
            </div>
          </div>
        ) : hasRaceGoal ? (
          <RaceCard settings={settings} stats={stats} raceStats={raceStats} hasActivePlan={hasActivePlan} onPlanClick={() => router.push('/plans')}/>
        ) : (
          <button onClick={() => setShowSetup('race')}
            className="w-full bc-card p-5 flex items-center gap-4 hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 rounded-[14px] bg-run-bg flex items-center justify-center flex-shrink-0">
              <Flag size={22} className="text-run-accent"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Add a race goal</p>
              <p className="text-xs text-secondary mt-0.5">Set your target race, date, and finish time. BaseCamp projects your fitness against your goal.</p>
            </div>
            <ArrowRight size={16} className="text-tertiary flex-shrink-0"/>
          </button>
        )
      )}

      {/* ══════════════════════ THIS WEEK ══════════════════════ */}
      <SectionHeader title="This Week" icon={<Calendar size={14} className="text-bc-blue"/>}
        expanded={expandedSection.weekly} onToggle={() => toggleSection('weekly')}
        action={{label: hasWeekly ? 'Edit targets' : 'Set targets', onClick:()=>setShowSetup('weekly')}}
      />

      {expandedSection.weekly && (
        showSetup === 'weekly' ? (
          <div className="bc-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-primary">Weekly Targets</p>
              <button onClick={()=>setShowSetup(null)} className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary"><X size={12}/></button>
            </div>
            <div className="space-y-3">
              {[
                { label:'Miles per week', value:weeklyMileTarget, setter:setWeeklyMileTarget, placeholder:'e.g. 30' },
                { label:'Lift sessions per week', value:weeklyLiftTarget, setter:setWeeklyLiftTarget, placeholder:'e.g. 4' },
                { label:'Training days per week', value:weeklyDaysTarget, setter:setWeeklyDaysTarget, placeholder:'e.g. 5' },
              ].map(({label, value, setter, placeholder}) => (
                <div key={label}>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">{label}</label>
                  <input type="number" value={value} onChange={e=>setter(e.target.value)}
                    placeholder={placeholder} className="bc-input bc-data" style={{fontSize:16}}/>
                </div>
              ))}
              <button onClick={saveWeeklyTargets} className="bc-btn-primary w-full min-h-[44px] text-sm">Save Targets</button>
            </div>
          </div>
        ) : (
          <WeeklySection stats={stats} settings={settings} onSetTargets={()=>setShowSetup('weekly')}/>
        )
      )}

      {/* ══════════════════════ MILESTONES ══════════════════════ */}
      <div ref={milestonesRef}>
        <SectionHeader title="Milestones" icon={<Trophy size={14} className="text-bc-orange-dark"/>}
          expanded={expandedSection.milestones} onToggle={() => toggleSection('milestones')}
          action={null}
        />
      </div>

      {expandedSection.milestones && (
        <>
          <AutoMilestones stats={stats}/>

          {/* Body composition goal card */}
          {bwGoal && (
            <BodyWeightGoalCard goal={bwGoal} onUpdate={updateBodyWeightCurrent}
              onEdit={() => { setShowSetup('milestone'); setMsType('body_weight'); setBwStep('fields'); }}/>
          )}

          {/* Custom milestones */}
          {milestones.length > 0 && (
            <div className="space-y-2">
              {milestones.map(m => (
                <CustomMilestoneCard key={m.id} milestone={m}
                  strengthBests={stats?.strengthBests || {}}
                  onUpdate={v => updateMilestone(m.id, v)}
                  onDelete={() => deleteMilestone(m.id)}
                  onReset={() => {
                    setMsType(m.type); setMsTitle(''); setMsTarget(''); setMsCurrent('');
                    setMsUnit(MILESTONE_TYPES.find(t=>t.value===m.type)?.unit||'');
                    setShowSetup('milestone');
                  }}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!hasMilestone && !bwGoal && !stats && showSetup !== 'milestone' && (
            <div className="bc-card p-6 text-center">
              <Trophy size={32} className="text-tertiary mx-auto mb-3"/>
              <p className="text-sm font-semibold text-primary">Track what matters to you</p>
              <p className="text-xs text-secondary mt-1 max-w-xs mx-auto leading-relaxed">
                Set strength PRs, mileage records, weight goals — anything you want to achieve.
              </p>
              <div className="flex gap-2 mt-4 justify-center">
                <button onClick={() => { handleTypeChange('body_weight'); setShowSetup('milestone'); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-canvas border border-border text-xs font-semibold text-secondary hover:text-primary transition-colors min-h-[44px]">
                  <Scale size={13}/> Body composition
                </button>
                <button onClick={() => { handleTypeChange('custom'); setShowSetup('milestone'); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-canvas border border-border text-xs font-semibold text-secondary hover:text-primary transition-colors min-h-[44px]">
                  <Star size={13}/> Custom milestone
                </button>
              </div>
            </div>
          )}

          {/* ── Milestone form ── */}
          {showSetup === 'milestone' ? (
            <div ref={formRef} className="bc-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[17px] font-semibold text-primary">
                  {msType === 'body_weight' && bwStep === 'confirm' ? 'Nutrition Recommendation' : 'New Milestone'}
                </p>
                <button onClick={() => { setShowSetup(null); setBwStep('fields'); }}
                  className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-secondary hover:text-primary">
                  <X size={14}/>
                </button>
              </div>

              {/* ── Body weight confirm step ── */}
              {msType === 'body_weight' && bwStep === 'confirm' && bwNutrPlan ? (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">
                    Based on your {bwDirection === 'lose' ? 'weight loss' : 'weight gain'} goal, we recommend:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:'Calorie target', value:`${bwNutrPlan.calories.toLocaleString()} cal/day`, Icon:Flame,   color:'#FF9500' },
                      { label:'Protein',        value:`${bwNutrPlan.protein}g`,                          Icon:Dumbbell, color:'#007AFF' },
                      { label:'Carbs',          value:`${bwNutrPlan.carbs}g`,                            Icon:Zap,      color:'#34C759' },
                      { label:'Fat',            value:`${bwNutrPlan.fat}g`,                              Icon:Droplet,  color:'#AF52DE' },
                    ].map(({ label, value, Icon, color }) => (
                      <div key={label} className="bc-card p-3">
                        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center mb-2"
                          style={{ background: color + '20' }}>
                          <Icon size={16} style={{ color }}/>
                        </div>
                        <p className="text-base font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{value}</p>
                        <p className="bc-caption mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="bc-caption">These will be set as your nutrition targets in the Nutrition page.</p>
                  <div className="space-y-2">
                    <button onClick={() => saveBodyWeightGoal(true)} disabled={savingBw}
                      className="bc-btn-primary w-full min-h-[52px] flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                      <Check size={16}/> Apply targets + Save goal
                    </button>
                    <button onClick={() => saveBodyWeightGoal(false)} disabled={savingBw}
                      className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors min-h-[44px]">
                      Save goal only
                    </button>
                    <button onClick={() => setBwStep('fields')}
                      className="w-full py-2 text-xs text-bc-blue hover:opacity-70 transition-opacity min-h-[36px]">
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Type selector ── */}
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-2">Goal Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MILESTONE_TYPES.map(t => {
                        const selected = msType === t.value;
                        return (
                          <button key={t.value} onClick={() => handleTypeChange(t.value)}
                            className={`flex flex-col items-center gap-2 p-3.5 rounded-[14px] transition-all active:scale-95 ${
                              selected ? 'border-2 border-bc-blue bg-bc-blue-light/30' : 'border border-border bg-canvas hover:border-border-strong'
                            }`}>
                            <div className="w-11 h-11 rounded-full flex items-center justify-center"
                              style={{ background: selected ? t.color + '30' : t.bg }}>
                              <t.Icon size={22} style={{ color: selected ? t.color : t.color }}/>
                            </div>
                            <span className={`text-xs font-semibold text-center leading-tight ${selected ? 'text-bc-blue' : 'text-secondary'}`}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Body weight specific fields ── */}
                  {msType === 'body_weight' ? (
                    <div className="space-y-4">
                      {/* Direction selector */}
                      <div>
                        <label className="bc-caption uppercase tracking-wider block mb-2">Direction</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value:'lose', label:'Lose weight', Icon:TrendingDown, color:'#34C759' },
                            { value:'gain', label:'Gain weight', Icon:TrendingUp,   color:'#007AFF' },
                          ].map(opt => (
                            <button key={opt.value} onClick={() => setBwDirection(opt.value)}
                              className={`flex flex-col items-center gap-2 p-4 rounded-[14px] border-2 transition-all ${
                                bwDirection === opt.value ? 'border-bc-blue bg-bc-blue-light/30' : 'border-border bg-canvas'}`}>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ background: bwDirection === opt.value ? opt.color + '25' : '#F2F2F7' }}>
                                <opt.Icon size={20} style={{ color: bwDirection === opt.value ? opt.color : '#8E8E93' }}/>
                              </div>
                              <span className={`text-sm font-semibold ${bwDirection === opt.value ? 'text-bc-blue' : 'text-secondary'}`}>
                                {opt.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Current and target weight */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label:'Current weight', value:bwCurrent, setter:setBwCurrent, pill:'lbs now' },
                          { label:'Target weight',  value:bwTarget,  setter:setBwTarget,  pill:'lbs goal' },
                        ].map(({label, value, setter, pill}) => (
                          <div key={label}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="bc-pill bg-canvas border border-border text-tertiary text-[9px] font-bold">{pill}</span>
                            </div>
                            <input type="number" inputMode="decimal" value={value}
                              onChange={e => setter(e.target.value)}
                              placeholder="0"
                              className="bc-input bc-data text-center font-bold w-full"
                              style={{ fontSize: 24, height: 64, fontVariantNumeric:'tabular-nums' }}/>
                            <p className="bc-caption text-center mt-1">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Weekly rate */}
                      <div>
                        <label className="bc-caption uppercase tracking-wider block mb-2">Weekly rate</label>
                        <div className="bc-tab-bar">
                          {[
                            { value:0.5, label:'0.5 lbs/wk', desc:'Conservative' },
                            { value:1.0, label:'1 lb/wk',    desc:'Recommended'  },
                            { value:1.5, label:'1.5 lbs/wk', desc:'Aggressive'   },
                          ].map(opt => (
                            <button key={opt.value} onClick={() => setBwRate(opt.value)}
                              className="bc-tab flex-1 flex flex-col py-2"
                              style={{
                                background: bwRate === opt.value ? '#007AFF' : 'transparent',
                                color: bwRate === opt.value ? '#fff' : '#8E8E93',
                                fontWeight: bwRate === opt.value ? 600 : 500,
                                borderRadius: '10px',
                              }}>
                              <span className="text-[11px] font-bold">{opt.label}</span>
                              <span className="text-[9px] opacity-70">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live preview */}
                      {bwCurrent && bwTarget && parseFloat(bwCurrent) !== parseFloat(bwTarget) && (
                        <div className="p-3 bg-canvas rounded-[12px] border border-border">
                          <p className="text-xs text-secondary">
                            At {bwRate} lbs/week: reach {bwTarget} lbs in ~{Math.round(Math.abs(parseFloat(bwTarget||0) - parseFloat(bwCurrent||0)) / bwRate)} weeks
                          </p>
                          <p className="text-xs font-semibold text-primary mt-0.5">
                            Calorie {bwDirection === 'lose' ? 'deficit' : 'surplus'}: ~{Math.round(bwRate * 3500 / 7)} cal/day
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Standard milestone fields ── */
                    <div className="space-y-4">
                      {/* Goal name */}
                      <div>
                        <label className="bc-caption uppercase tracking-wider block mb-1.5">Goal name</label>
                        <input type="text" value={msTitle} onChange={e=>setMsTitle(e.target.value)}
                          placeholder={curTypeConf?.label || 'My goal'}
                          className="bc-input text-base" style={{fontSize:16}}/>
                      </div>

                      {/* Target + Current */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label:'Target', value:msTarget, setter:setMsTarget },
                          { label:'Current', value:msCurrent, setter:setMsCurrent },
                        ].map(({label, value, setter}) => (
                          <div key={label}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="bc-pill bg-bc-blue-light text-bc-blue text-[9px] font-bold">
                                {msUnit || curTypeConf?.unit || ''}
                              </span>
                              <span className="bc-caption">{label}</span>
                            </div>
                            <input type="number" inputMode="decimal" value={value}
                              onChange={e => setter(e.target.value)}
                              placeholder="0"
                              className="bc-input bc-data text-center font-bold w-full"
                              style={{ fontSize: 24, height: 64, fontVariantNumeric:'tabular-nums' }}/>
                          </div>
                        ))}
                      </div>

                      {/* Custom unit for 'custom' type */}
                      {msType === 'custom' && (
                        <div>
                          <label className="bc-caption uppercase tracking-wider block mb-1.5">Unit</label>
                          <input type="text" value={msUnit} onChange={e=>setMsUnit(e.target.value)}
                            placeholder="lbs, km, reps…" className="bc-input" style={{fontSize:16}}/>
                        </div>
                      )}

                      {/* Deadline */}
                      <div>
                        <label className="bc-caption uppercase tracking-wider block mb-1.5">Deadline (optional)</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none"/>
                          <input type="date" value={msDeadline} onChange={e=>setMsDeadline(e.target.value)}
                            min={today} className="bc-input pl-9" style={{fontSize:16}}/>
                        </div>
                        {msDeadline && daysUntil(msDeadline) !== null && (
                          <p className="bc-caption mt-1">
                            {daysUntil(msDeadline)} days · ~{Math.round(daysUntil(msDeadline)/7)} weeks away
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <button onClick={addMilestone}
                    disabled={msType === 'body_weight' ? (!bwCurrent || !bwTarget) : (!msTarget || parseFloat(msTarget) <= 0)}
                    className="bc-btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-40"
                    style={{minHeight:52}}>
                    {msType === 'body_weight' ? 'Next: Review Nutrition' : 'Add Goal'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => setShowSetup('milestone')}
              className="w-full py-3.5 border border-dashed border-border rounded-[14px] text-xs font-medium text-tertiary hover:text-secondary hover:border-secondary transition-colors flex items-center justify-center gap-2 min-h-[52px]">
              <Plus size={14}/> Add a milestone goal
            </button>
          )}
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 pointer-events-none">
          <div className="bg-primary text-white text-sm font-semibold px-4 py-3 rounded-[14px] shadow-xl text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section header ───────────────────────────────────────
function SectionHeader({ title, icon, expanded, onToggle, action }) {
  return (
    <div className="flex items-center justify-between min-h-[36px]">
      <button onClick={onToggle} className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-primary">{title}</span>
        {expanded ? <ChevronUp size={12} className="text-tertiary"/> : <ChevronDown size={12} className="text-tertiary"/>}
      </button>
      {action && (
        <button onClick={action.onClick}
          className="text-[11px] font-semibold text-bc-blue hover:opacity-70 transition-opacity px-2 py-1 min-h-[32px]">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Race card ────────────────────────────────────────────
function RaceCard({ settings, stats, raceStats, hasActivePlan, onPlanClick }) {
  if (!raceStats) return null;
  const { days, weeksLeft, goalPaceDec, projectedTime, projectedPaceDec, paceGapSec, trajectory } = raceStats;
  const isPast  = days !== null && days < 0;
  const distLabel = { marathon:'Marathon', half:'Half Marathon', '10k':'10K', '5k':'5K' }[settings.race_distance] || 'Race';
  const onTrack = paceGapSec !== null && paceGapSec <= 15;
  const statusColor = isPast ? '#8E8E93' : onTrack ? '#34C759' : paceGapSec !== null ? '#FF9500' : '#007AFF';
  const statusLabel = isPast ? 'Race Complete' : onTrack ? 'On Pace' : paceGapSec !== null ? `${paceGapSec}s/mi off goal` : 'Tracking';

  return (
    <div className="bc-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: statusColor + '15', borderBottom: `1px solid ${statusColor}30` }}>
        <div>
          <p className="text-sm font-bold text-primary">{settings.race_name || distLabel}</p>
          <p className="text-[10px] text-tertiary mt-0.5">
            {isPast ? `${Math.abs(days)} days ago` : days === 0 ? 'Race day!' : `${days} days · ${weeksLeft} weeks away`}
          </p>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className="text-2xl font-bold tabular-nums" style={{ color: statusColor, letterSpacing: '-0.02em' }}>
            {isPast ? '—' : days === null ? '?' : days <= 99 ? days : `${weeksLeft}wk`}
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: statusColor }}>
            {isPast ? 'done' : days === 0 ? 'today' : 'days left'}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-border/50">
        <div className="text-center">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Goal Pace</p>
          <p className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>
            {goalPaceDec ? `${fmtPace(goalPaceDec)}/mi` : '—'}
          </p>
          {settings.race_goal_time && <p className="text-[10px] text-secondary">{settings.race_goal_time}</p>}
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Current Pace</p>
          <p className="text-sm font-bold" style={{fontVariantNumeric:'tabular-nums', color: statusColor}}>
            {stats?.avgPaceDec ? `${fmtPace(stats.avgPaceDec)}/mi` : '—'}
          </p>
          <p className="text-[10px]" style={{color: trajectory==='improving'?'#34C759':trajectory==='declining'?'#FF3B30':'#8E8E93'}}>
            {trajectory === 'improving' ? 'improving' : trajectory === 'declining' ? 'declining' : trajectory === 'steady' ? 'steady' : 'no data'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Projected</p>
          <p className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>{projectedTime || '—'}</p>
          <p className="text-[10px]" style={{color:statusColor}}>{statusLabel}</p>
        </div>
      </div>

      {stats && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-tertiary">Weekly mileage this week</p>
            <p className="text-[10px] font-semibold text-run-accent" style={{fontVariantNumeric:'tabular-nums'}}>{stats.wkMiles} mi</p>
          </div>
          <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-run-accent/70 transition-[width] duration-500"
              style={{ width: `${Math.min(100, stats.wkPlannedMiles > 0 ? (stats.wkMiles/stats.wkPlannedMiles)*100 : 0)}%` }}/>
          </div>
          <p className="text-[9px] text-tertiary mt-1">{stats.wkMiles} of {stats.wkPlannedMiles} mi planned</p>
        </div>
      )}

      {/* Plan connection */}
      {!isPast && (
        <div className="px-4 pb-3 border-t border-border/40 pt-3">
          <button onClick={onPlanClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-border-strong transition-colors min-h-[40px]">
            {hasActivePlan
              ? <><Calendar size={12}/> View training plan</>
              : <><Sparkles size={12}/> Build a plan for this race</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Weekly section ───────────────────────────────────────
function WeeklySection({ stats, settings, onSetTargets }) {
  if (!stats) return (
    <div className="bc-card p-4 text-center"><p className="text-sm text-secondary">Log workouts to track weekly progress.</p></div>
  );
  const now = new Date(), dow = now.getDay(), dayOfWeek = dow === 0 ? 7 : dow;
  const weekPct = (dayOfWeek / 7) * 100;
  const hasTargets = !!(settings.weekly_mile_target || settings.weekly_lift_target || settings.weekly_days_target);

  const rows = [
    { label:'Miles run',      current:stats.wkMiles,        target:parseFloat(settings.weekly_mile_target)||stats.wkPlannedMiles, unit:'mi',       color:'#34C759', icon:<Footprints size={14} className="text-run-accent"/>, sub:`${stats.wkPlannedRuns} runs planned` },
    { label:'Lift sessions',  current:stats.wkLiftSessions, target:parseFloat(settings.weekly_lift_target)||stats.wkPlannedLifts, unit:'sessions', color:'#007AFF', icon:<Dumbbell size={14} className="text-lift-accent"/>,   sub:`${stats.wkPlannedLifts} planned` },
    { label:'Training days',  current:stats.wkDays,         target:parseFloat(settings.weekly_days_target)||5,                    unit:'days',     color:'#AF52DE', icon:<Calendar size={14} style={{color:'#AF52DE'}}/>,       sub:`Day ${dayOfWeek} of 7` },
  ].filter(r => r.target > 0);

  return (
    <div className="bc-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-tertiary">Week progress</p>
          <p className="text-[10px] font-semibold text-secondary">{now.toLocaleDateString('en-US',{weekday:'short'})} · {Math.round(weekPct)}% through</p>
        </div>
        <div className="h-1 bg-canvas rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-tertiary/50 transition-[width] duration-500" style={{ width: `${weekPct}%` }}/>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {rows.map((row, i) => {
          const pct = row.target > 0 ? Math.min(100, Math.round((row.current/row.target)*100)) : 0;
          const done = pct >= 100;
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: row.color + '18' }}>
                  {row.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-primary">{row.label}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {done && <Check size={12} style={{color:'#34C759'}}/>}
                      <span className="text-xs font-bold tabular-nums" style={{ color: done ? '#34C759' : row.color }}>
                        {row.current}<span className="text-tertiary font-normal text-[10px]">/{row.target} {row.unit}</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: done ? '#34C759' : row.color + 'B0' }}/>
                  </div>
                  <p className="text-[9px] text-tertiary mt-0.5">{row.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!hasTargets && (
        <div className="px-4 pb-3">
          <button onClick={onSetTargets} className="w-full py-2 text-xs font-semibold text-bc-blue border border-bc-blue/30 rounded-[10px] active:scale-95 transition-transform min-h-[36px]">
            Set custom weekly targets
          </button>
        </div>
      )}
      <div className="px-4 pb-3 border-t border-border/40 pt-2">
        <a href="/" className="flex items-center gap-1.5 text-[11px] text-bc-blue hover:opacity-70 transition-opacity">
          <ArrowRight size={11}/> See this week's full breakdown on Home
        </a>
      </div>
    </div>
  );
}

// ── Auto-computed milestones ─────────────────────────────
function AutoMilestones({ stats }) {
  if (!stats) return null;
  const items = [
    { label:'Current streak', value:`${stats.streak} days`, Icon:Flame,    color:'#FF9500', bg:'#FFF3E0', sub: stats.streak >= 7 ? 'Keep it up!' : `${7-stats.streak} more for a week` },
    { label:'Longest run',    value:`${stats.longestRun} mi`, Icon:Footprints, color:'#34C759', bg:'#E8F5E9', sub: stats.longestRun >= 20 ? 'Marathon ready!' : stats.longestRun >= 13 ? 'Half marathon distance' : 'Keep building base' },
    { label:'Best week',      value:`${stats.bestWeekMiles} mi`, Icon:TrendingUp, color:'#34C759', bg:'#E8F5E9', sub:'Peak weekly mileage' },
    { label:'Adherence',      value:`${stats.adherencePct}%`, Icon:Check,   color:stats.adherencePct>=85?'#34C759':stats.adherencePct>=70?'#FF9500':'#FF3B30', bg:stats.adherencePct>=85?'#E8F5E9':stats.adherencePct>=70?'#FFF3E0':'#FFEBEE', sub: stats.adherencePct >= 85 ? 'Excellent consistency' : stats.adherencePct >= 70 ? 'Good — keep pushing' : 'Room to improve' },
    ...Object.entries(stats.strengthBests).slice(0,3).map(([name, e1rm]) => ({
      label: name.length > 16 ? name.slice(0,16)+'…' : name,
      value:`${e1rm} lbs`, Icon:Dumbbell, color:'#007AFF', bg:'#E3F2FD', sub:'Estimated 1RM',
    })),
  ].filter(item => {
    if (item.label === 'Longest run' && stats.longestRun === 0) return false;
    if (item.label === 'Best week' && stats.bestWeekMiles === 0) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-2 gap-2 mb-2">
      {items.map((item, i) => (
        <div key={i} className="bc-card p-3">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center mb-1.5" style={{ background: item.bg }}>
            <item.Icon size={14} style={{ color: item.color }}/>
          </div>
          <p className="text-lg font-bold" style={{ color: item.color, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', lineHeight:1 }}>
            {item.value}
          </p>
          <p className="text-[9px] text-tertiary mt-1 leading-tight">{item.label}</p>
          <p className="text-[9px] text-tertiary mt-0.5 italic">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Body weight goal card ────────────────────────────────
function BodyWeightGoalCard({ goal, onUpdate, onEdit }) {
  const [editing,   setEditing]   = useState(false);
  const [newWeight, setNewWeight] = useState(String(goal.current_weight));

  const { direction, current_weight, target_weight, weekly_rate, start_weight } = goal;
  const isLoss  = direction === 'lose';
  const totalDiff = Math.abs(target_weight - start_weight);
  const madeSoFar = Math.abs(current_weight - start_weight);
  const pct = totalDiff > 0 ? Math.min(100, Math.round((madeSoFar / totalDiff) * 100)) : 0;
  const lbsLeft   = Math.abs(target_weight - current_weight);
  const weeksLeft = weekly_rate > 0 ? Math.round(lbsLeft / weekly_rate) : 0;
  const projDate  = new Date(); projDate.setDate(projDate.getDate() + weeksLeft * 7);
  const projDateStr = projDate.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const color = isLoss ? '#34C759' : '#007AFF';

  return (
    <div className="bc-card p-4 mb-2">
      <div className="flex items-center gap-4 mb-4">
        <ProgressRing percentage={pct} size={56} strokeWidth={5} color={color}/>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">Weight {isLoss ? 'Loss' : 'Gain'} Goal</p>
          <p className="bc-caption">{current_weight} lbs → {target_weight} lbs</p>
          <p className="bc-caption">{weekly_rate} lbs/week target</p>
        </div>
        <button onClick={onEdit} className="text-[11px] text-bc-blue font-semibold min-h-[36px] px-2">Edit</button>
      </div>

      {/* 3-point progress bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-canvas rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%`, background: color }}/>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="bc-caption">{start_weight} lbs</span>
          <span className="bc-caption font-semibold" style={{ color }}>{current_weight} lbs now</span>
          <span className="bc-caption">{target_weight} lbs</span>
        </div>
      </div>

      {/* Update current weight */}
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" value={newWeight}
            onChange={e => setNewWeight(e.target.value)}
            className="bc-input bc-data flex-1" style={{ fontSize:16 }} autoFocus/>
          <span className="bc-caption flex-shrink-0">lbs</span>
          <button onClick={() => { onUpdate(parseFloat(newWeight)); setEditing(false); }}
            className="px-3 py-2 bg-bc-green-light text-bc-green-dark text-xs font-semibold rounded-[8px] min-h-[36px]">Save</button>
          <button onClick={() => setEditing(false)} className="text-tertiary text-xs min-h-[36px] px-2">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full py-2 text-xs font-medium text-bc-blue border border-bc-blue/30 rounded-[10px] hover:bg-bc-blue-light/30 transition-colors min-h-[36px]">
          Update current weight
        </button>
      )}

      <p className="bc-caption mt-2 text-center">
        {lbsLeft.toFixed(1)} lbs remaining · Est. {projDateStr}
      </p>
    </div>
  );
}

// ── Custom milestone card ─────────────────────────────────
function CustomMilestoneCard({ milestone, onUpdate, onDelete, onReset, strengthBests }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(milestone.current));
  const pct  = milestone.target > 0 ? Math.min(100, Math.round((milestone.current/milestone.target)*100)) : 0;
  const done = pct >= 100;

  // Check if we have real e1RM data for strength goals
  const liftE1rm = milestone.type === 'lift_e1rm' && strengthBests
    ? Object.entries(strengthBests).find(([name]) => name.toLowerCase().includes((milestone.title||'').toLowerCase().split(' ')[0]))?.[1]
    : null;

  if (done) {
    return (
      <div className="bc-card p-4 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
          style={{ background: '#FFD70025' }}>
          <Trophy size={24} style={{ color: '#FFD700' }}/>
        </div>
        <p className="text-sm font-bold text-primary">Goal Achieved!</p>
        <p className="bc-caption mt-0.5">{milestone.title}</p>
        <div className="flex gap-2 mt-3 justify-center">
          <button onClick={onDelete} className="text-xs text-tertiary hover:text-bc-red min-h-[36px] px-3">Remove</button>
          <button onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-bc-blue border border-bc-blue/30 rounded-[8px] hover:bg-bc-blue-light/30 transition-colors min-h-[36px]">
            Set new target
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bc-card p-3 flex items-center gap-3">
      <div className="flex-shrink-0">
        <ProgressRing percentage={pct} size={48} strokeWidth={4} color={done?'#34C759':'#AF52DE'}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold text-primary truncate">{milestone.title}</p>
          <button onClick={onDelete} className="w-5 h-5 flex items-center justify-center text-tertiary hover:text-bc-red flex-shrink-0">
            <X size={10}/>
          </button>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 mt-1">
            <input type="number" value={val} onChange={e=>setVal(e.target.value)}
              className="bc-input !py-0.5 !px-2 !text-xs flex-1" autoFocus
              onKeyDown={e=>e.key==='Enter'&&(onUpdate(val),setEditing(false))}/>
            <span className="text-[9px] text-tertiary">{milestone.unit}</span>
            <button onClick={()=>{onUpdate(val);setEditing(false);}}
              className="text-[10px] font-semibold text-bc-green-dark px-2 py-0.5 bg-bc-green-light rounded-[6px]">✓</button>
          </div>
        ) : (
          <button onClick={()=>setEditing(true)} className="flex items-center gap-1 mt-0.5 hover:opacity-70">
            <p className="text-[11px] text-secondary tabular-nums">{milestone.current} / {milestone.target} {milestone.unit}</p>
            <span className="text-[9px] text-bc-blue">edit</span>
          </button>
        )}
        <div className="h-1 bg-canvas rounded-full overflow-hidden mt-1.5">
          <div className="h-full rounded-full transition-[width] duration-500"
            style={{width:`${pct}%`, background: done?'#34C759':'#AF52DE'}}/>
        </div>
        {liftE1rm && (
          <a href="/records"
            className="flex items-center gap-1 mt-1 text-[9px] text-bc-blue hover:opacity-70">
            Current e1RM from logs: {liftE1rm} lbs <ArrowRight size={9}/>
          </a>
        )}
        {milestone.deadline && daysUntil(milestone.deadline) !== null && daysUntil(milestone.deadline) > 0 && (
          <p className="bc-caption mt-0.5">{daysUntil(milestone.deadline)} days remaining</p>
        )}
      </div>
    </div>
  );
}
