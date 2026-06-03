'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useWorkouts } from '@/lib/WorkoutContext';
import { formatDate, parsePace } from '@/utils/runUtils';
import { calculateE1RM, formatVolume } from '@/utils/liftUtils';
import ProgressRing from '@/components/shared/ProgressRing';
import {
  Flag, Footprints, Dumbbell, Flame, Check, TrendingUp,
  Plus, X, ChevronDown, ChevronUp, Calendar, Target,
  BarChart3, Star, Trophy, Zap, Clock, ArrowRight,
} from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/lib/database';
import { useAuth } from '@/lib/auth';

// ── Helpers ─────────────────────────────────────────────
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

// Milestones stay in localStorage (manually tracked, low stakes for beta)
function loadCustomMilestones() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('bc-milestones') || '[]'); } catch { return []; }
}
function saveCustomMilestones(m) {
  try { localStorage.setItem('bc-milestones', JSON.stringify(m)); } catch {}
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function GoalsPage() {
  const { workouts, isLoaded } = useWorkouts();
  const { user } = useAuth();
  const today = getLocalToday();

  const milestonesRef = useRef(null);

  const [settings,       setSettings]    = useState({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [milestones,     setMilestones]  = useState(loadCustomMilestones);
  const [showSetup,      setShowSetup]   = useState(null); // 'race'|'weekly'|'milestone'|null
  const [expandedSection, setExpandedSection] = useState({ race:true, weekly:true, milestones:true });

  // ── Race goal settings ──
  const [raceDate,      setRaceDate]      = useState('');
  const [raceName,      setRaceName]      = useState('');
  const [raceGoalTime,  setRaceGoalTime]  = useState('');
  const [raceDistance,  setRaceDistance]  = useState('marathon');

  // ── Weekly targets ──
  const [weeklyMileTarget,  setWeeklyMileTarget]  = useState('');
  const [weeklyLiftTarget,  setWeeklyLiftTarget]  = useState('');
  const [weeklyDaysTarget,  setWeeklyDaysTarget]  = useState('');

  // ── Load settings from Supabase on mount ──
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
      }
      setSettingsLoaded(true);
    }
    loadSettings();
  }, [user]);

  // ── New milestone form ──
  const [msTitle,   setMsTitle]   = useState('');
  const [msType,    setMsType]    = useState('run_distance');
  const [msTarget,  setMsTarget]  = useState('');
  const [msCurrent, setMsCurrent] = useState('');
  const [msUnit,    setMsUnit]    = useState('');

  const MILESTONE_TYPES = [
    { value:'run_distance',  label:'Longest Run',        unit:'mi',      icon:Footprints  },
    { value:'weekly_miles',  label:'Weekly Miles PR',    unit:'mi',      icon:TrendingUp  },
    { value:'lift_e1rm',     label:'Strength PR',        unit:'lbs',     icon:Dumbbell    },
    { value:'streak',        label:'Streak',             unit:'days',    icon:'🔥'         },
    { value:'race_time',     label:'Race Time',          unit:'min',     icon:Flag        },
    { value:'body_weight',   label:'Body Weight',        unit:'lbs',     icon:'⚖️'         },
    { value:'custom',        label:'Custom',             unit:'',        icon:Star        },
  ];

  // ── Computed stats ──────────────────────────────────
  const stats = useMemo(() => {
    if (!workouts.length) return null;
    const { mondayStr, sundayStr } = isoWeekBounds();
    const runs  = workouts.filter(w => w.type === 'run');
    const lifts = workouts.filter(w => w.type === 'lift');
    const cRuns  = runs.filter(w => w.status === 'completed');
    const cLifts = lifts.filter(w => w.status === 'completed');

    // This week
    const wkRuns  = cRuns.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const wkLifts = cLifts.filter(w => w.date >= mondayStr && w.date <= sundayStr);
    const wkAll   = workouts.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status === 'completed' && w.type !== 'rest');
    const wkMiles = wkRuns.reduce((s,w) => s+(w.details?.actualDistance||0), 0);
    const wkLiftSessions = wkLifts.length;
    const wkDays  = new Set(wkAll.map(w => w.date)).size;

    // Planned this week
    const wkPlannedRuns  = runs.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').length;
    const wkPlannedLifts = lifts.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').length;
    const wkPlannedMiles = runs.filter(w => w.date >= mondayStr && w.date <= sundayStr && w.status !== 'skipped').reduce((s,w) => s+(w.details?.plannedDistance||0),0);

    // Recent pace (last 3 completed long runs for race pace estimate)
    const longRuns = cRuns
      .filter(w => (w.details?.actualDistance||0) >= 8 && w.details?.actualPace)
      .sort((a,b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    const avgPaceDec = longRuns.length
      ? longRuns.map(r => parsePace(r.details.actualPace)).filter(Boolean).reduce((a,b)=>a+b,0) / longRuns.length
      : null;

    // Best week miles (for weekly PR milestone)
    const weekBuckets = {};
    cRuns.forEach(w => {
      const d = new Date(w.date+'T00:00:00'), dow = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate()+(dow===0?-6:1-dow));
      const k = mon.toLocaleDateString('en-CA');
      weekBuckets[k] = (weekBuckets[k]||0)+(w.details?.actualDistance||0);
    });
    const bestWeekMiles = Math.max(0, ...Object.values(weekBuckets));

    // Longest run ever
    const longestRun = cRuns.reduce((m,w) => Math.max(m, w.details?.actualDistance||0), 0);

    // Current streak
    const doneSet = new Set(workouts.filter(w=>w.status==='completed').map(w=>w.date));
    let streak = 0;
    if (doneSet.has(today)) streak++;
    const check = new Date(); check.setDate(check.getDate()-1);
    for (let i=0;i<365;i++){
      const ds = check.toLocaleDateString('en-CA');
      if (doneSet.has(ds)) { streak++; check.setDate(check.getDate()-1); } else break;
    }

    // Overall adherence
    const past = workouts.filter(w => w.date <= today && w.type !== 'rest');
    const done  = past.filter(w => w.status === 'completed');
    const adherencePct = past.length ? Math.round((done.length/past.length)*100) : 0;

    // Strength bests
    const strengthBests = {};
    cLifts.forEach(w => (w.details?.exercises||[]).forEach(ex => {
      if (!ex.name || !Array.isArray(ex.sets)) return;
      (ex.sets).forEach(s => {
        if (!s.completed || !s.weight || !s.reps) return;
        const e1rm = calculateE1RM(s.weight, s.reps);
        if (!strengthBests[ex.name] || e1rm > strengthBests[ex.name]) strengthBests[ex.name] = e1rm;
      });
    }));

    // Phase progress
    const phaseCounts = {};
    workouts.forEach(w => { const p = w.details?.phase; if (p) phaseCounts[p]=(phaseCounts[p]||0)+1; });
    const currentPhase = Object.keys(phaseCounts).sort((a,b)=>phaseCounts[b]-phaseCounts[a])[0]||null;
    const phaseRuns = currentPhase ? runs.filter(w=>w.details?.phase===currentPhase) : [];
    const phaseRunsDone = phaseRuns.filter(w=>w.status==='completed').length;
    const phaseRunsTotal = phaseRuns.filter(w=>w.status!=='skipped').length;

    return {
      wkMiles: parseFloat(wkMiles.toFixed(1)),
      wkLiftSessions, wkDays,
      wkPlannedMiles: parseFloat(wkPlannedMiles.toFixed(1)),
      wkPlannedRuns, wkPlannedLifts,
      avgPaceDec, longRuns,
      bestWeekMiles: parseFloat(bestWeekMiles.toFixed(1)),
      longestRun: parseFloat(longestRun.toFixed(1)),
      streak, adherencePct, strengthBests,
      currentPhase, phaseRunsDone, phaseRunsTotal,
    };
  }, [workouts, today]);

  // ── Race goal derived values ──────────────────────────
  const raceStats = useMemo(() => {
    if (!settings.race_date) return null;
    const days = daysUntil(settings.race_date);
    const weeksLeft = days !== null ? Math.ceil(days / 7) : null;

    // Parse goal time to pace per mile
    let goalPaceDec = null;
    if (settings.race_goal_time) {
      const parts = settings.race_goal_time.split(':').map(Number);
      let totalMins = 0;
      if (parts.length === 3) totalMins = parts[0]*60 + parts[1] + parts[2]/60;
      else if (parts.length === 2) totalMins = parts[0] + parts[1]/60;
      const distMiles = settings.race_distance === 'marathon' ? 26.2
        : settings.race_distance === 'half' ? 13.1
        : settings.race_distance === '10k' ? 6.2 : 3.1;
      goalPaceDec = totalMins / distMiles;
    }

    // Fitness estimate — project finish based on recent long run pace
    let projectedTime = null;
    let projectedPaceDec = null;
    if (stats?.avgPaceDec) {
      const distMiles = settings.race_distance === 'marathon' ? 26.2
        : settings.race_distance === 'half' ? 13.1
        : settings.race_distance === '10k' ? 6.2 : 3.1;
      // Riegel formula adjustment for race distance
      projectedPaceDec = stats.avgPaceDec * 1.04; // marathon adds ~4% over long run pace
      const projectedMins = projectedPaceDec * distMiles;
      const h = Math.floor(projectedMins / 60);
      const m = Math.floor(projectedMins % 60);
      const s = Math.round((projectedMins - Math.floor(projectedMins)) * 60);
      projectedTime = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    }

    // Gap between projected and goal
    let paceGapSec = null;
    if (goalPaceDec && projectedPaceDec) {
      paceGapSec = Math.round((projectedPaceDec - goalPaceDec) * 60);
    }

    // Fitness trajectory — is pace improving?
    let trajectory = null;
    if (stats?.longRuns?.length >= 2) {
      const oldest = parsePace(stats.longRuns[stats.longRuns.length-1].details.actualPace);
      const newest = parsePace(stats.longRuns[0].details.actualPace);
      if (oldest && newest) trajectory = newest < oldest ? 'improving' : newest > oldest ? 'declining' : 'steady';
    }

    return { days, weeksLeft, goalPaceDec, projectedTime, projectedPaceDec, paceGapSec, trajectory };
  }, [settings, stats]);

  // ── Save race settings to Supabase ──
  async function saveRaceGoal() {
    if (!user) return;
    const updates = {
      race_date:      raceDate,
      race_name:      raceName,
      race_goal_time: raceGoalTime,
      race_distance:  raceDistance,
    };
    await updateUserSettings(user.id, updates);
    setSettings(prev => ({ ...prev, ...updates }));
    setShowSetup(null);
  }

  // ── Save weekly targets to Supabase ──
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

  // ── Add milestone ──
  function addMilestone() {
    if (!msTarget || parseFloat(msTarget) <= 0) return;
    const typeConf = MILESTONE_TYPES.find(t => t.value === msType);
    const m = {
      id: `ms-${Date.now()}`,
      type: msType,
      title: msTitle || typeConf?.label || 'Milestone',
      target: parseFloat(msTarget),
      current: parseFloat(msCurrent) || 0,
      unit: msUnit || typeConf?.unit || '',
      createdAt: new Date().toISOString(),
    };
    const updated = [...milestones, m];
    setMilestones(updated); saveCustomMilestones(updated);
    setMsTitle(''); setMsTarget(''); setMsCurrent(''); setMsUnit(''); setMsType('run_distance');
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
              setTimeout(() => milestonesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-bc-blue text-white text-xs font-semibold rounded-[10px] hover:opacity-90 active:scale-95 transition-all min-h-[36px]">
            <Plus size={12}/> Goal
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 1: RACE / EVENT
      ══════════════════════════════════════════ */}
      <SectionHeader
        title={hasRaceGoal ? (settings.raceName || 'Race Goal') : 'Race / Event'}
        icon={<Flag size={14} className="text-run-accent"/>}
        expanded={expandedSection.race}
        onToggle={() => toggleSection('race')}
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
                  placeholder="e.g. Chicago Marathon" className="bc-input"/>
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
                  <input type="date" value={raceDate} onChange={e=>setRaceDate(e.target.value)}
                    min={today} className="bc-input"/>
                </div>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Goal Finish Time (H:MM:SS)</label>
                <input type="text" value={raceGoalTime} onChange={e=>setRaceGoalTime(e.target.value)}
                  placeholder="3:45:00" className="bc-input font-mono"/>
              </div>
              <button onClick={saveRaceGoal}
                className="bc-btn-primary w-full min-h-[44px] text-sm">
                Save Race Goal
              </button>
            </div>
          </div>
        ) : hasRaceGoal ? (
          <RaceCard settings={settings} stats={stats} raceStats={raceStats}/>
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

      {/* ══════════════════════════════════════════
          SECTION 2: THIS WEEK
      ══════════════════════════════════════════ */}
      <SectionHeader
        title="This Week"
        icon={<Calendar size={14} className="text-bc-blue"/>}
        expanded={expandedSection.weekly}
        onToggle={() => toggleSection('weekly')}
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
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Miles per week</label>
                <input type="number" value={weeklyMileTarget} onChange={e=>setWeeklyMileTarget(e.target.value)}
                  placeholder="e.g. 30" className="bc-input bc-data"/>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Lift sessions per week</label>
                <input type="number" value={weeklyLiftTarget} onChange={e=>setWeeklyLiftTarget(e.target.value)}
                  placeholder="e.g. 4" className="bc-input bc-data"/>
              </div>
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Training days per week</label>
                <input type="number" value={weeklyDaysTarget} onChange={e=>setWeeklyDaysTarget(e.target.value)}
                  placeholder="e.g. 5" className="bc-input bc-data"/>
              </div>
              <button onClick={saveWeeklyTargets}
                className="bc-btn-primary w-full min-h-[44px] text-sm">
                Save Targets
              </button>
            </div>
          </div>
        ) : (
          <WeeklySection stats={stats} settings={settings} onSetTargets={()=>setShowSetup('weekly')}/>
        )
      )}

      {/* ══════════════════════════════════════════
          SECTION 3: MILESTONES
      ══════════════════════════════════════════ */}
      <SectionHeader
        title="Milestones"
        icon={<Trophy size={14} className="text-bc-orange-dark"/>}
        expanded={expandedSection.milestones}
        onToggle={() => toggleSection('milestones')}
        action={null}
      />

      {expandedSection.milestones && (
        <>
          {/* Auto-computed milestones from workout data */}
          <AutoMilestones stats={stats}/>

          {/* Custom milestones */}
          {milestones.length > 0 && (
            <div className="space-y-2">
              {milestones.map(m => (
                <CustomMilestoneCard
                  key={m.id} milestone={m}
                  onUpdate={(v) => updateMilestone(m.id, v)}
                  onDelete={() => deleteMilestone(m.id)}
                />
              ))}
            </div>
          )}

          {/* Add milestone form */}
          {showSetup === 'milestone' ? (
            <div ref={milestonesRef} className="bc-card p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-primary">New Milestone</p>
                <button onClick={()=>setShowSetup(null)} className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center text-tertiary"><X size={12}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MILESTONE_TYPES.map(t => (
                      <button key={t.value} onClick={()=>{setMsType(t.value);setMsUnit(t.unit);}}
                        className={`flex items-center gap-2 px-3 py-2 rounded-[10px] border text-xs font-medium text-left transition-all ${msType===t.value?'border-bc-blue/50 bg-bc-blue-light/40 text-bc-blue':'border-border bg-canvas text-secondary'}`}>
                        {typeof t.icon === 'string' ? <span>{t.icon}</span> : <t.icon size={12}/>}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Name (optional)</label>
                  <input type="text" value={msTitle} onChange={e=>setMsTitle(e.target.value)}
                    placeholder={MILESTONE_TYPES.find(t=>t.value===msType)?.label || 'My milestone'}
                    className="bc-input"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-1.5">Target</label>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={msTarget} onChange={e=>setMsTarget(e.target.value)}
                        placeholder="0" className="bc-input bc-data flex-1"/>
                      <input type="text" value={msUnit} onChange={e=>setMsUnit(e.target.value)}
                        placeholder="unit" className="bc-input w-14 text-center text-xs"/>
                    </div>
                  </div>
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-1.5">Current</label>
                    <input type="number" value={msCurrent} onChange={e=>setMsCurrent(e.target.value)}
                      placeholder="0" className="bc-input bc-data"/>
                  </div>
                </div>
                <button onClick={addMilestone} disabled={!msTarget}
                  className="bc-btn-primary w-full min-h-[44px] text-sm disabled:opacity-40">
                  Add Milestone
                </button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setShowSetup('milestone')}
              className="w-full py-3 border border-dashed border-border rounded-[14px] text-xs text-tertiary hover:text-secondary hover:border-secondary transition-colors flex items-center justify-center gap-1.5">
              <Plus size={12}/> Add milestone
            </button>
          )}
        </>
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
        {expanded
          ? <ChevronUp size={12} className="text-tertiary"/>
          : <ChevronDown size={12} className="text-tertiary"/>}
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

// ── Race card ─────────────────────────────────────────────
function RaceCard({ settings, stats, raceStats }) {
  if (!raceStats) return null;
  const { days, weeksLeft, goalPaceDec, projectedTime, projectedPaceDec, paceGapSec, trajectory } = raceStats;
  const isPast = days !== null && days < 0;
  const isClose = days !== null && days <= 14;

  const distLabel = settings.race_distance === 'marathon' ? 'Marathon'
    : settings.race_distance === 'half' ? 'Half Marathon'
    : settings.race_distance === '10k' ? '10K' : '5K';

  const onTrack = paceGapSec !== null && paceGapSec <= 15;
  const statusColor = isPast ? '#8E8E93' : onTrack ? '#34C759' : paceGapSec !== null ? '#FF9500' : '#007AFF';
  const statusLabel = isPast ? 'Race Complete' : onTrack ? 'On Pace' : paceGapSec !== null ? `${paceGapSec}s/mi off goal` : 'Tracking';

  return (
    <div className="bc-card overflow-hidden">
      {/* Top banner */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: statusColor + '15', borderBottom: `1px solid ${statusColor}30` }}>
        <div>
          <p className="text-sm font-bold text-primary">{settings.raceName || distLabel}</p>
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

      {/* Pace comparison */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-border/50">
        <div className="text-center">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Goal Pace</p>
          <p className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>
            {goalPaceDec ? `${fmtPace(goalPaceDec)}/mi` : '—'}
          </p>
          {settings.raceGoalTime && (
            <p className="text-[10px] text-secondary">{settings.raceGoalTime}</p>
          )}
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Current Pace</p>
          <p className="text-sm font-bold" style={{fontVariantNumeric:'tabular-nums', color: statusColor}}>
            {stats?.avgPaceDec ? `${fmtPace(stats.avgPaceDec)}/mi` : '—'}
          </p>
          <p className="text-[10px]" style={{color: trajectory==='improving'?'#34C759':trajectory==='declining'?'#FF3B30':'#8E8E93'}}>
            {trajectory === 'improving' ? '↑ improving' : trajectory === 'declining' ? '↓ declining' : trajectory === 'steady' ? '→ steady' : 'no data'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-tertiary uppercase tracking-wider mb-1">Projected</p>
          <p className="text-sm font-bold text-primary" style={{fontVariantNumeric:'tabular-nums'}}>
            {projectedTime || '—'}
          </p>
          <p className="text-[10px]" style={{color:statusColor}}>{statusLabel}</p>
        </div>
      </div>

      {/* Weekly mileage vs race prep */}
      {stats && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-tertiary">Weekly mileage this week</p>
            <p className="text-[10px] font-semibold text-run-accent"
               style={{fontVariantNumeric:'tabular-nums'}}>
              {stats.wkMiles} mi
            </p>
          </div>
          <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-run-accent/70 transition-[width] duration-500"
              style={{ width: `${Math.min(100, stats.wkPlannedMiles > 0 ? (stats.wkMiles/stats.wkPlannedMiles)*100 : 0)}%` }}/>
          </div>
          <p className="text-[9px] text-tertiary mt-1">{stats.wkMiles} of {stats.wkPlannedMiles} mi planned this week</p>
        </div>
      )}
    </div>
  );
}

// ── Weekly section ───────────────────────────────────────
function WeeklySection({ stats, settings, onSetTargets }) {
  if (!stats) return (
    <div className="bc-card p-4 text-center">
      <p className="text-sm text-secondary">Log workouts to track weekly progress.</p>
    </div>
  );

  const { mondayStr } = isoWeekBounds();
  const now = new Date();
  const dow = now.getDay();
  const dayOfWeek = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
  const weekPct = (dayOfWeek / 7) * 100;

  const rows = [
    {
      label:   'Miles run',
      current: stats.wkMiles,
      target:  parseFloat(settings.weeklyMileTarget) || stats.wkPlannedMiles,
      unit:    'mi',
      color:   '#34C759',
      icon:    <Footprints size={14} className="text-run-accent"/>,
      sub:     `${stats.wkPlannedRuns} runs planned`,
    },
    {
      label:   'Lift sessions',
      current: stats.wkLiftSessions,
      target:  parseFloat(settings.weekly_lift_target) || stats.wkPlannedLifts,
      unit:    'sessions',
      color:   '#007AFF',
      icon:    <Dumbbell size={14} className="text-lift-accent"/>,
      sub:     `${stats.wkPlannedLifts} planned`,
    },
    {
      label:   'Training days',
      current: stats.wkDays,
      target:  parseFloat(settings.weekly_days_target) || 5,
      unit:    'days',
      color:   '#AF52DE',
      icon:    <Calendar size={14} style={{color:'#AF52DE'}}/>,
      sub:     `Day ${dayOfWeek} of 7`,
    },
  ].filter(r => r.target > 0);

  const hasTargets = !!(settings.weekly_mile_target || settings.weekly_lift_target || settings.weekly_days_target);

  return (
    <div className="bc-card overflow-hidden">
      {/* Week progress bar */}
      <div className="px-4 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-tertiary">Week progress</p>
          <p className="text-[10px] font-semibold text-secondary">
            {now.toLocaleDateString('en-US',{weekday:'short'})} · {Math.round(weekPct)}% through
          </p>
        </div>
        <div className="h-1 bg-canvas rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-tertiary/50 transition-[width] duration-500"
            style={{ width: `${weekPct}%` }}/>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {rows.map((row, i) => {
          const pct = row.target > 0 ? Math.min(100, Math.round((row.current/row.target)*100)) : 0;
          const done = pct >= 100;
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: row.color + '18' }}>
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
                    <div className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: done ? '#34C759' : row.color + 'B0' }}/>
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
          <button onClick={onSetTargets}
            className="w-full py-2 text-xs font-semibold text-bc-blue border border-bc-blue/30 rounded-[10px] active:scale-95 transition-transform">
            Set custom weekly targets
          </button>
        </div>
      )}
    </div>
  );
}

// ── Auto-computed milestones ──────────────────────────────
function AutoMilestones({ stats }) {
  if (!stats) return null;

  const items = [
    {
      label:   'Current streak',
      value:   `${stats.streak} days`,
      icon:    '🔥',
      color:   '#FF9500',
      sub:     stats.streak >= 7 ? 'Keep it up!' : `${7 - stats.streak} more for a week streak`,
    },
    {
      label:   'Longest run',
      value:   `${stats.longestRun} mi`,
      icon:    <Footprints size={14} className="text-run-accent"/>,
      color:   '#34C759',
      sub:     stats.longestRun >= 20 ? 'Marathon ready!' : stats.longestRun >= 13 ? 'Half marathon distance' : 'Keep building base',
    },
    {
      label:   'Best week',
      value:   `${stats.bestWeekMiles} mi`,
      icon:    <TrendingUp size={14} className="text-run-accent"/>,
      color:   '#34C759',
      sub:     'Peak weekly mileage',
    },
    {
      label:   'Adherence',
      value:   `${stats.adherencePct}%`,
      icon:    <Check size={14} style={{color:stats.adherencePct>=85?'#34C759':stats.adherencePct>=70?'#FF9500':'#FF3B30'}}/>,
      color:   stats.adherencePct >= 85 ? '#34C759' : stats.adherencePct >= 70 ? '#FF9500' : '#FF3B30',
      sub:     stats.adherencePct >= 85 ? 'Excellent consistency' : stats.adherencePct >= 70 ? 'Good — keep pushing' : 'Room to improve',
    },
    ...Object.entries(stats.strengthBests).slice(0,3).map(([name, e1rm]) => ({
      label:   name.length > 16 ? name.slice(0,16)+'…' : name,
      value:   `${e1rm} lbs`,
      icon:    <Dumbbell size={14} className="text-lift-accent"/>,
      color:   '#007AFF',
      sub:     'Estimated 1RM',
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
          <div className="flex items-center gap-1.5 mb-1.5">
            {typeof item.icon === 'string'
              ? <span style={{fontSize:14}}>{item.icon}</span>
              : item.icon}
            <p className="text-[10px] text-tertiary truncate">{item.label}</p>
          </div>
          <p className="text-lg font-bold" style={{ color: item.color, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', lineHeight:1 }}>
            {item.value}
          </p>
          <p className="text-[9px] text-tertiary mt-1">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Custom milestone card ─────────────────────────────────
function CustomMilestoneCard({ milestone, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(milestone.current));
  const pct = milestone.target > 0 ? Math.min(100, Math.round((milestone.current/milestone.target)*100)) : 0;
  const done = pct >= 100;

  return (
    <div className="bc-card p-3 flex items-center gap-3">
      <div className="flex-shrink-0">
        <ProgressRing percentage={pct} size={48} strokeWidth={4} color={done?'#34C759':'#AF52DE'}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold text-primary truncate">{milestone.title}</p>
          <button onClick={onDelete}
            className="w-5 h-5 flex items-center justify-center text-tertiary hover:text-bc-red flex-shrink-0">
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
          <button onClick={()=>setEditing(true)}
            className="flex items-center gap-1 mt-0.5 hover:opacity-70">
            <p className="text-[11px] text-secondary tabular-nums">
              {milestone.current} / {milestone.target} {milestone.unit}
            </p>
            <span className="text-[9px] text-bc-blue">edit</span>
          </button>
        )}
        <div className="h-1 bg-canvas rounded-full overflow-hidden mt-1.5">
          <div className="h-full rounded-full transition-[width] duration-500"
            style={{width:`${pct}%`, background: done?'#34C759':'#AF52DE'}}/>
        </div>
      </div>
    </div>
  );
}