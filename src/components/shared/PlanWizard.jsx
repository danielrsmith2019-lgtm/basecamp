'use client';

/**
 * PlanWizard — Smart multi-step plan builder.
 * Step 0: Plan Type | Step 1: Goal | Step 2: Fitness | Step 3: Schedule
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Loader2, Sparkles, Footprints, Dumbbell, Zap } from 'lucide-react';
import { useWorkouts } from '@/lib/WorkoutContext';
import { getUserTrainingProfile } from '@/utils/trainingProfile';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LIFTING_SPLITS = [
  { value: 'interference_safe', label: 'Interference-Safe Split',  desc: 'Upper Push / Upper Pull / Lower. Separates leg-heavy sessions from hard runs.', bestFor: 'Hybrid athletes — recommended', days: 3 },
  { value: 'ppl',               label: 'Push / Pull / Legs',        desc: 'Chest+shoulders+triceps / Back+biceps / Legs. Classic 3-day.', bestFor: 'Hypertrophy, intermediate+', days: 3 },
  { value: 'upper_lower',       label: 'Upper / Lower',             desc: 'Alternates upper and lower body. High frequency per muscle group.', bestFor: 'Strength, any level', days: 4 },
  { value: 'full_body',         label: 'Full Body',                 desc: 'Every session hits all major muscle groups. Best for 2-3 days/week.', bestFor: 'Beginners, maintenance', days: 3 },
  { value: 'bro_split',         label: 'Body Part Split',           desc: 'One muscle group per day: Chest / Back / Legs / Shoulders / Arms.', bestFor: 'Hypertrophy, 5 days/week', days: 5 },
  { value: 'strength_focused',  label: 'Strength / Powerlifting',   desc: 'Built around squat, bench, deadlift with accessory work. Heavy, low-rep.', bestFor: 'Strength & powerlifting goals', days: 4 },
];

const DAY_TYPE_OPTIONS = [
  { value: 'run',  label: 'Run',  color: 'text-run-accent',  bg: 'bg-run-bg',          border: 'border-run-accent',  Icon: Footprints },
  { value: 'lift', label: 'Lift', color: 'text-lift-accent', bg: 'bg-lift-bg',          border: 'border-lift-accent', Icon: Dumbbell   },
  { value: 'both', label: 'Both', color: 'text-bc-indigo',   bg: 'bg-bc-indigo-light',  border: 'border-bc-indigo',   Icon: Zap        },
];

function buildTrainingContext(workouts) {
  if (!workouts || workouts.length === 0) {
    return { avgWeeklyMiles:0, maxWeeklyMiles:0, longestRun:0, lastLongRunDate:null,
      lastLongRunDistance:null, recentPaces:[], avgLiftsPerWeek:0, adherence:null,
      totalRunsLogged:0, totalLiftsLogged:0, hasTrainingHistory:false };
  }
  const today = new Date().toLocaleDateString('en-CA');
  const completed = workouts.filter(w => w.status === 'completed');
  const runs  = completed.filter(w => w.type === 'run');
  const lifts = completed.filter(w => w.type === 'lift');
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentRuns = runs.filter(w => new Date(w.date + 'T00:00:00') >= fourWeeksAgo);
  const weeklyMiles = {};
  recentRuns.forEach(w => {
    const d = new Date(w.date + 'T00:00:00'), dow = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    const key = mon.toLocaleDateString('en-CA');
    weeklyMiles[key] = (weeklyMiles[key] || 0) + (w.details?.actualDistance || 0);
  });
  const weeklyMileValues = Object.values(weeklyMiles);
  const avgWeeklyMiles = weeklyMileValues.length > 0
    ? weeklyMileValues.reduce((a, b) => a + b, 0) / weeklyMileValues.length : 0;
  const maxWeeklyMiles = Math.max(0, ...weeklyMileValues);
  const longestRun = runs.reduce((max, w) => Math.max(max, w.details?.actualDistance || 0), 0);
  const lastLongRun = runs
    .filter(w => (w.details?.actualDistance || 0) >= 8)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const recentPaces = recentRuns.filter(w => w.details?.actualPace).slice(0, 5).map(w => w.details.actualPace);
  const recentLifts = lifts.filter(w => new Date(w.date + 'T00:00:00') >= fourWeeksAgo);
  const pastPlanned   = workouts.filter(w => w.date <= today && w.type !== 'rest');
  const pastCompleted = pastPlanned.filter(w => w.status === 'completed');
  const adherence = pastPlanned.length > 0
    ? Math.round((pastCompleted.length / pastPlanned.length) * 100) : null;
  return {
    avgWeeklyMiles:       Math.round(avgWeeklyMiles * 10) / 10,
    maxWeeklyMiles:       Math.round(maxWeeklyMiles * 10) / 10,
    longestRun:           Math.round(longestRun * 10) / 10,
    lastLongRunDate:      lastLongRun?.date || null,
    lastLongRunDistance:  lastLongRun?.details?.actualDistance || null,
    recentPaces,
    avgLiftsPerWeek:      Math.round((recentLifts.length / 4) * 10) / 10,
    adherence,
    totalRunsLogged:      runs.length,
    totalLiftsLogged:     lifts.length,
    hasTrainingHistory:   completed.length >= 3,
  };
}

function normalizePlanJSON(plan) {
  if (!plan?.weeks) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map(week => ({
      ...week,
      runs:     Array.isArray(week.runs)     ? week.runs     : [],
      lifts:    Array.isArray(week.lifts)    ? week.lifts    : [],
      restDays: Array.isArray(week.restDays) ? week.restDays : [],
    })),
  };
}

const INITIAL_STATE = {
  planType: null,
  runningGoal: 'general_fitness',
  raceDistance: '',
  targetTime: '',
  raceDate: '',
  targetWeeklyMileage: '',
  planStyle: 'mileage',
  liftingGoal: 'hypertrophy',
  liftingSplit: 'interference_safe',
  liftingFocus: [],
  weeklyMileage: '',
  longestRecentRun: '',
  recentRaceTime: '',
  liftingExperience: 'intermediate',
  currentBenchMax: '',
  currentSquatMax: '',
  currentDeadliftMax: '',
  targetBench: '',
  targetSquat: '',
  targetDeadlift: '',
  availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  dayAssignments: {}, // { monday: 'run', tuesday: 'lift', wednesday: 'both', ... }
  longRunDay: 'saturday',
  fullRestDays: ['sunday'],
  maxMinutesPerSession: 60,
  equipment: 'full_gym',
  planDuration: 12,
};

export default function PlanWizard({ onComplete, onCancel }) {
  const { workouts } = useWorkouts();
  const trainingProfile = useMemo(() => getUserTrainingProfile(workouts), [workouts]);
  const trainingContext = useMemo(() => buildTrainingContext(workouts), [workouts]);

  const defaultPlanType = trainingProfile.primaryType === 'runner' ? 'running'
    : trainingProfile.primaryType === 'lifter' ? 'lifting'
    : null;

  const [showProfileStep, setShowProfileStep] = useState(trainingProfile.primaryType === 'new');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...INITIAL_STATE, planType: defaultPlanType });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const hasPrefilledRef = useRef(false);

  // Pre-fill fitness fields from actual workout logs if user hasn't entered values yet
  useEffect(() => {
    if (trainingContext.hasTrainingHistory && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      setForm(prev => ({
        ...prev,
        weeklyMileage:    prev.weeklyMileage    || (trainingContext.avgWeeklyMiles > 0 ? String(trainingContext.avgWeeklyMiles) : ''),
        longestRecentRun: prev.longestRecentRun || (trainingContext.longestRun      > 0 ? String(trainingContext.longestRun)      : ''),
      }));
    }
  }, [trainingContext.hasTrainingHistory, trainingContext.avgWeeklyMiles, trainingContext.longestRun]);

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  function toggleArrayItem(field, value) {
    setForm(prev => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }

  function toggleDay(day) {
    setForm(prev => {
      const isSelected = prev.availableDays.includes(day);
      const newAssignments = { ...prev.dayAssignments };
      if (isSelected) delete newAssignments[day];
      return {
        ...prev,
        availableDays:  isSelected ? prev.availableDays.filter(d => d !== day) : [...prev.availableDays, day],
        fullRestDays:   isSelected ? prev.fullRestDays : prev.fullRestDays.filter(d => d !== day),
        dayAssignments: newAssignments,
      };
    });
  }

  function toggleFullRestDay(day) {
    setForm(prev => {
      const isRest = prev.fullRestDays.includes(day);
      const newAssignments = { ...prev.dayAssignments };
      if (!isRest) delete newAssignments[day];
      return {
        ...prev,
        fullRestDays:   isRest ? prev.fullRestDays.filter(d => d !== day) : [...prev.fullRestDays, day],
        availableDays:  isRest ? prev.availableDays : prev.availableDays.filter(d => d !== day),
        longRunDay:     !isRest && prev.longRunDay === day ? '' : prev.longRunDay,
        dayAssignments: newAssignments,
      };
    });
  }

  function setDayAssignment(day, type) {
    setForm(prev => {
      const newAssignments = { ...prev.dayAssignments };
      if (type === null) delete newAssignments[day];
      else newAssignments[day] = type;
      return { ...prev, dayAssignments: newAssignments };
    });
  }

  // Derive counts from dayAssignments for API
  function getComputedCounts() {
    const vals = Object.values(form.dayAssignments);
    const runs  = vals.filter(v => v === 'run'  || v === 'both').length;
    const lifts = vals.filter(v => v === 'lift' || v === 'both').length;
    // Fall back to available days if nothing assigned
    return {
      runsPerWeek:  runs  || Math.round(form.availableDays.length * 0.5),
      liftsPerWeek: lifts || Math.round(form.availableDays.length * 0.5),
    };
  }

  function canAdvance() {
    if (step === 0) return form.planType !== null;
    if (step === 1) {
      if ((form.planType === 'running' || form.planType === 'hybrid') && form.runningGoal === 'race') {
        if (!form.raceDate || !form.raceDistance) return false;
      }
      return true;
    }
    if (step === 2) {
      if (form.planType === 'running' || form.planType === 'hybrid') return form.weeklyMileage !== '';
      return true;
    }
    if (step === 3) return form.availableDays.length >= 2 && form.fullRestDays.length >= 1;
    return true;
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { runsPerWeek, liftsPerWeek } = getComputedCounts();
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, runsPerWeek, liftsPerWeek, trainingContext }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Plan generation failed');
      }
      const planData = await res.json();
      onComplete(normalizePlanJSON(planData));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // Timeout reset: if generation hangs for 30s, unblock the button
  useEffect(() => {
    if (!generating) return;
    const t = setTimeout(() => {
      setGenerating(false);
      setError('Generation timed out — please try again.');
    }, 30000);
    return () => clearTimeout(t);
  }, [generating]);

  function getGenerateBlocker() {
    if (!form.planType) return 'Select a plan type above';
    if ((form.planType === 'running' || form.planType === 'hybrid') && form.runningGoal === 'race') {
      if (!form.raceDate || !form.raceDistance) return 'Complete race details in the Goal step';
    }
    if (form.availableDays.length < 2) return 'Select at least 2 training days';
    if (form.fullRestDays.length < 1) return 'Select at least 1 full rest day';
    return null;
  }

  if (generating) {
    return (
      <div className="bc-card p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-[20px] bg-bc-indigo-light flex items-center justify-center">
            <Loader2 size={28} className="text-bc-indigo animate-spin" />
          </div>
          <div>
            <p className="text-primary font-semibold text-[17px]">Building Your Plan</p>
            <p className="text-secondary text-sm mt-1 max-w-xs">
              Applying exercise science, scheduling around interference effects, building progressive overload…
            </p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-bc-indigo"
                style={{ animation: `pulse 1.4s ease-in-out ${i*0.2}s infinite`, opacity: 0.3 }} />
            ))}
          </div>
          <style jsx>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
        </div>
      </div>
    );
  }

  // Profile selection for new users — shown before step 0
  if (showProfileStep) {
    return (
      <div className="bc-card-flush">
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <h3 className="text-[17px] font-semibold text-primary mb-1">What best describes your training?</h3>
            <p className="text-sm text-secondary">This helps BaseCamp build the right plan for you.</p>
          </div>
          <div className="space-y-3">
            {[
              { value: 'running', label: "I'm a runner",    desc: 'Pure running plan — race prep, mileage building, speed work.',     Icon: Footprints, color: 'text-run-accent',  bg: 'bg-run-bg',          border: 'border-run-accent',  activeBg: 'bg-run-bg' },
              { value: 'lifting', label: 'I lift weights',   desc: 'Pure strength plan — hypertrophy, powerlifting, or athletic.',      Icon: Dumbbell,   color: 'text-lift-accent', bg: 'bg-lift-bg',          border: 'border-lift-accent', activeBg: 'bg-lift-bg' },
              { value: 'hybrid',  label: 'I do both',        desc: 'Hybrid plan — runs and lifts scheduled to minimize interference.',  Icon: Zap,         color: 'text-bc-indigo',   bg: 'bg-bc-indigo-light',  border: 'border-bc-indigo',   activeBg: 'bg-bc-indigo-light/40' },
            ].map(opt => (
              <button key={opt.value}
                onClick={() => {
                  update('planType', opt.value);
                  setShowProfileStep(false);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-[16px] border-2 text-left transition-all border-border bg-canvas hover:border-border-strong`}>
                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 ${opt.bg}`}>
                  <opt.Icon size={24} className={opt.color} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary">{opt.label}</p>
                  <p className="text-xs text-secondary mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button onClick={onCancel} className="px-4 py-2.5 text-secondary text-sm hover:text-primary transition-colors min-h-[44px]">Cancel</button>
            <button onClick={() => setShowProfileStep(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-bc-blue text-white text-sm font-semibold rounded-[10px] transition-all active:scale-95 min-h-[44px]">
              Skip <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepLabels =
    form.planType === 'running' ? ['Type','Running Goal','Fitness','Schedule'] :
    form.planType === 'lifting' ? ['Type','Lifting Goal','Fitness','Schedule'] :
    ['Type','Goals','Fitness','Schedule'];

  return (
    <div className="bc-card-flush">
      {/* ── Progress bar ── */}
      <div className="flex border-b border-border overflow-x-auto">
        {stepLabels.map((label, i) => (
          <button key={i} onClick={() => i < step && setStep(i)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium
                        transition-colors whitespace-nowrap px-2
              ${step===i ? 'text-bc-blue border-b-2 border-bc-blue bg-bc-blue-light/40'
                : step>i ? 'text-bc-green-dark cursor-pointer hover:bg-canvas'
                : 'text-tertiary cursor-default'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
              ${step>i  ? 'bg-bc-green-light text-bc-green-dark'
                : step===i ? 'bg-bc-blue-light text-bc-blue'
                : 'bg-canvas text-tertiary'}`}>
              {step>i ? '✓' : i+1}
            </div>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">

        {/* ══ STEP 0: PLAN TYPE ══ */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-primary mb-1">What kind of plan do you want?</h3>
              <p className="text-sm text-secondary">This determines how your training week is structured.</p>
            </div>
            <div className="space-y-3">
              {[
                { value:'hybrid',  label:'Hybrid Training', desc:'Run AND lift. Scientifically scheduled to minimize the interference effect.', Icon:Zap,        color:'text-bc-indigo',  bg:'bg-bc-indigo-light', border:'border-bc-indigo',  activeBg:'bg-bc-indigo-light/40' },
                { value:'running', label:'Running Only',    desc:'Pure running plan. Race prep, base building, speed work, or general endurance.', Icon:Footprints, color:'text-run-accent', bg:'bg-run-bg',          border:'border-run-accent', activeBg:'bg-run-bg' },
                { value:'lifting', label:'Lifting Only',    desc:'Pure strength plan. Powerlifting, hypertrophy, athletic performance.',           Icon:Dumbbell,   color:'text-lift-accent', bg:'bg-lift-bg',         border:'border-lift-accent', activeBg:'bg-lift-bg' },
              ].map(opt => {
                const selected = form.planType === opt.value;
                return (
                  <button key={opt.value} onClick={() => update('planType', opt.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-[16px] border-2 text-left transition-all
                      ${selected ? `${opt.activeBg} ${opt.border}` : 'border-border bg-canvas hover:border-border-strong'}`}>
                    <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 ${opt.bg}`}>
                      <opt.Icon size={24} className={opt.color} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary">{opt.label}</p>
                      <p className="text-xs text-secondary mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                    {selected && <span className={`text-xs font-bold flex-shrink-0 ${opt.color}`}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP 1: GOAL ══ */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-primary mb-1">
                {form.planType === 'lifting' ? "What's your lifting goal?" : 'What are you training for?'}
              </h3>
              <p className="text-sm text-secondary">Be specific — this drives every decision in your plan.</p>
            </div>

            {(form.planType === 'running' || form.planType === 'hybrid') && (
              <div className="space-y-4">
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-2">Primary Running Goal</label>
                  <div className="space-y-2">
                    {[
                      { value:'race',            label:'Race Prep',           desc:'Train for a specific race with a target time.' },
                      { value:'base_building',   label:'Base Building',       desc:'Safely increase weekly mileage over time.' },
                      { value:'speed',           label:'Speed & Performance', desc:'Get faster. Tempo runs, intervals, VO2 max work.' },
                      { value:'general_fitness', label:'General Fitness',     desc:'Stay consistent and healthy. No specific target.' },
                      { value:'weight_loss',     label:'Weight Loss',         desc:'Maximize calorie burn while building endurance.' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => update('runningGoal', opt.value)}
                        className={`w-full p-3.5 rounded-[14px] border text-left transition-all
                          ${form.runningGoal===opt.value ? 'border-run-accent bg-run-bg' : 'border-border bg-canvas hover:border-border-strong'}`}>
                        <p className="text-sm font-semibold text-primary">{opt.label}</p>
                        <p className="text-xs text-secondary mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Race inputs — FIX: fully vertical stack, no grid overflow ── */}
                {form.runningGoal === 'race' && (
                  <div className="space-y-3 p-4 bg-run-bg rounded-[14px] border border-run-accent/20">
                    {/* Distance grid — 3 cols is safe at any width */}
                    <div>
                      <label className="bc-caption uppercase tracking-wider block mb-2">Race Distance *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value:'5k',            label:'5K' },
                          { value:'10k',           label:'10K' },
                          { value:'half_marathon', label:'Half' },
                          { value:'marathon',      label:'Marathon' },
                          { value:'ultra',         label:'Ultra' },
                          { value:'custom',        label:'Custom' },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => update('raceDistance', opt.value)}
                            className={`py-2.5 rounded-[10px] border text-sm font-medium transition-all
                              ${form.raceDistance===opt.value
                                ? 'border-run-accent bg-run-accent text-white'
                                : 'border-border bg-surface text-primary hover:border-run-accent/50'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Race date */}
                    <div className="p-3 bg-white/60 rounded-[12px] border border-run-accent/30">
                      <label className="bc-caption uppercase tracking-wider block mb-1.5 text-run-accent">
                        Race Day * — appears in your plan calendar
                      </label>
                      <div style={{ width: '100%', overflow: 'hidden' }}>
                        <input
                          type="date"
                          value={form.raceDate}
                          onChange={e => update('raceDate', e.target.value)}
                          min={new Date().toLocaleDateString('en-CA')}
                          style={{
                            fontSize: '16px',
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            display: 'block',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(60,60,67,0.12)',
                            background: '#fff',
                            color: '#1C1C1E',
                            WebkitAppearance: 'none',
                          }}
                        />
                      </div>
                      <p className="bc-caption mt-1">Plan length auto-calculates from today to race day</p>
                    </div>

                    {/* Target time — full width */}
                    <div>
                      <label className="bc-caption uppercase tracking-wider block mb-1.5">Target Finish Time (optional)</label>
                      <input
                        type="text"
                        value={form.targetTime}
                        onChange={e => update('targetTime', e.target.value)}
                        placeholder={form.raceDistance==='marathon' ? '3:59:00' : '1:45:00'}
                        className="bc-input"
                        style={{ fontSize: '16px' }}
                      />
                      <p className="bc-caption mt-1">H:MM:SS — used to set pace zones</p>
                    </div>
                  </div>
                )}

                {form.runningGoal === 'base_building' && (
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-1.5">Target Weekly Mileage</label>
                    <input type="number" value={form.targetWeeklyMileage}
                      onChange={e => update('targetWeeklyMileage', e.target.value)}
                      placeholder="40" className="bc-input" style={{ fontSize: '16px' }} />
                    <p className="bc-caption mt-1">Miles per week to reach by end of plan</p>
                  </div>
                )}

                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-2">Plan Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value:'mileage', label:'Mileage-Based', desc:'"Run 6 miles at 8:30 pace"' },
                      { value:'time',    label:'Time-Based',    desc:'"Run 45 min easy"' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => update('planStyle', opt.value)}
                        className={`p-3 rounded-[14px] border text-left transition-all
                          ${form.planStyle===opt.value ? 'border-bc-teal bg-bc-teal-light/40' : 'border-border bg-canvas hover:border-border-strong'}`}>
                        <p className="text-xs font-semibold text-primary">{opt.label}</p>
                        <p className="bc-caption mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(form.planType === 'lifting' || form.planType === 'hybrid') && (
              <div className={form.planType==='hybrid' ? 'pt-4 border-t border-border space-y-4' : 'space-y-4'}>
                {form.planType==='hybrid' && (
                  <label className="bc-caption uppercase tracking-wider block">Lifting Goal</label>
                )}
                <div className="space-y-2">
                  {[
                    { value:'strength',     label:'Strength',             desc:'Heavy lifts, low reps (3-5). Maximize force production.' },
                    { value:'hypertrophy',  label:'Hypertrophy',          desc:'Moderate weight, 8-12 reps. Build muscle mass.' },
                    { value:'powerlifting', label:'Powerlifting',         desc:'Maximize squat, bench, deadlift. Competition-focused.' },
                    { value:'athletic',     label:'Athletic Performance', desc:'Functional strength, power, agility. Complements running.' },
                    { value:'maintenance',  label:'Maintenance',          desc:'Keep current strength while prioritizing another goal.' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => update('liftingGoal', opt.value)}
                      className={`w-full p-3.5 rounded-[14px] border text-left transition-all
                        ${form.liftingGoal===opt.value ? 'border-lift-accent bg-lift-bg' : 'border-border bg-canvas hover:border-border-strong'}`}>
                      <p className="text-sm font-semibold text-primary">{opt.label}</p>
                      <p className="text-xs text-secondary mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-2">
                    Lifting Split
                    {form.planType==='hybrid' && (
                      <span className="ml-1 normal-case font-normal text-bc-indigo"> — interference-safe recommended</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    {LIFTING_SPLITS.map(split => {
                      const selected = form.liftingSplit === split.value;
                      return (
                        <button key={split.value} onClick={() => update('liftingSplit', split.value)}
                          className={`w-full p-3.5 rounded-[14px] border text-left transition-all
                            ${selected ? 'border-lift-accent bg-lift-bg' : 'border-border bg-canvas hover:border-border-strong'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-primary">{split.label}</p>
                              <p className="text-xs text-secondary mt-0.5 leading-relaxed">{split.desc}</p>
                              <p className="bc-caption mt-1">
                                <span className="text-bc-blue">Best for:</span> {split.bestFor}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <span className="bc-caption">{split.days}d/wk</span>
                              {selected && <span className="block text-lift-accent font-bold text-xs mt-0.5">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(form.liftingGoal==='strength' || form.liftingGoal==='powerlifting') && (
                  <div className="p-4 bg-lift-bg rounded-[14px] border border-lift-accent/20">
                    <p className="text-xs font-semibold text-lift-accent mb-3">Strength Targets (optional)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { field:'targetBench',    label:'Bench (lbs)',    placeholder:'225' },
                        { field:'targetSquat',    label:'Squat (lbs)',    placeholder:'315' },
                        { field:'targetDeadlift', label:'Deadlift (lbs)', placeholder:'405' },
                      ].map(t => (
                        <div key={t.field}>
                          <label className="bc-caption block mb-1">{t.label}</label>
                          <input type="number" value={form[t.field]||''}
                            onChange={e => update(t.field, e.target.value)}
                            placeholder={t.placeholder} className="bc-input !py-2"
                            style={{ fontSize: '16px' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {form.liftingGoal==='hypertrophy' && (
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-2">Muscle Focus (optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {['Chest','Back','Legs','Shoulders','Arms','Core'].map(m => (
                        <button key={m} onClick={() => toggleArrayItem('liftingFocus', m)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                            ${form.liftingFocus?.includes(m)
                              ? 'bg-lift-accent text-white border-lift-accent'
                              : 'border-border text-secondary hover:border-lift-accent/50'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Plan Duration</label>
              <select value={form.planDuration} onChange={e => update('planDuration', Number(e.target.value))}
                className="bc-input cursor-pointer">
                {[4,6,8,10,12,16,20,24].map(w => <option key={w} value={w}>{w} weeks</option>)}
              </select>
              {form.runningGoal==='race' && form.raceDate && (
                <p className="bc-caption mt-1 text-run-accent">← Auto-calculated from race day</p>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 2: FITNESS ══ */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-primary mb-1">Where are you right now?</h3>
              <p className="text-sm text-secondary">Honest answers = better plan.</p>
            </div>

            {/* "We noticed" training summary — shown when user has logged workouts */}
            {trainingContext.hasTrainingHistory && (
              <div className="p-3 rounded-[14px] border border-bc-blue/30 bg-bc-blue-light/30">
                <p className="text-xs font-semibold text-bc-blue mb-2">Based on your recent training:</p>
                {trainingContext.avgWeeklyMiles > 0 && (
                  <p className="text-xs text-bc-blue-dark">• Your average week is {trainingContext.avgWeeklyMiles} miles</p>
                )}
                {trainingContext.longestRun > 0 && (
                  <p className="text-xs text-bc-blue-dark">• Your longest run is {trainingContext.longestRun} miles</p>
                )}
                {trainingContext.avgLiftsPerWeek > 0 && (
                  <p className="text-xs text-bc-blue-dark">• You lift {trainingContext.avgLiftsPerWeek}× per week on average</p>
                )}
                {trainingContext.adherence !== null && (
                  <p className="text-xs text-bc-blue-dark">• {trainingContext.adherence}% of planned sessions completed</p>
                )}
                <p className="text-xs text-tertiary mt-2">Your plan will continue from where you are — not from scratch.</p>
              </div>
            )}

            {(form.planType==='running' || form.planType==='hybrid') && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-run-accent uppercase tracking-wider">Running</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-1.5">Weekly Mileage *</label>
                    <input type="number" value={form.weeklyMileage}
                      onChange={e => update('weeklyMileage', e.target.value)}
                      placeholder="20" className="bc-input" style={{ fontSize: '16px' }} />
                    <p className="bc-caption mt-1">Current miles/week</p>
                  </div>
                  <div>
                    <label className="bc-caption uppercase tracking-wider block mb-1.5">Longest Recent Run</label>
                    <input type="number" value={form.longestRecentRun}
                      onChange={e => update('longestRecentRun', e.target.value)}
                      placeholder="10" className="bc-input" style={{ fontSize: '16px' }} />
                    <p className="bc-caption mt-1">Miles</p>
                  </div>
                </div>
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-1.5">Recent Race Time (optional)</label>
                  <input type="text" value={form.recentRaceTime}
                    onChange={e => update('recentRaceTime', e.target.value)}
                    placeholder="e.g. 2:05 half, 22:00 5K" className="bc-input"
                    style={{ fontSize: '16px' }} />
                  <p className="bc-caption mt-1">Helps calibrate pace zones</p>
                </div>
              </div>
            )}

            {(form.planType==='lifting' || form.planType==='hybrid') && (
              <div className={`space-y-4 ${form.planType==='hybrid' ? 'pt-4 border-t border-border' : ''}`}>
                <p className="text-xs font-semibold text-lift-accent uppercase tracking-wider">Lifting</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value:'beginner',     label:'Beginner',     desc:'< 6 months' },
                    { value:'intermediate', label:'Intermediate', desc:'6mo – 2yrs' },
                    { value:'advanced',     label:'Advanced',     desc:'2+ years' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => update('liftingExperience', opt.value)}
                      className={`p-3 rounded-[14px] border text-center transition-all
                        ${form.liftingExperience===opt.value ? 'border-lift-accent bg-lift-bg' : 'border-border bg-canvas hover:border-border-strong'}`}>
                      <p className="text-xs font-semibold text-primary">{opt.label}</p>
                      <p className="bc-caption mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { field:'currentBenchMax',    label:'Bench 1RM',    placeholder:'185' },
                    { field:'currentSquatMax',    label:'Squat 1RM',    placeholder:'225' },
                    { field:'currentDeadliftMax', label:'Deadlift 1RM', placeholder:'315' },
                  ].map(t => (
                    <div key={t.field}>
                      <label className="bc-caption block mb-1.5">{t.label}</label>
                      <input type="number" value={form[t.field]||''}
                        onChange={e => update(t.field, e.target.value)}
                        placeholder={t.placeholder} className="bc-input !py-2"
                        style={{ fontSize: '16px' }} />
                      <p className="bc-caption mt-0.5">lbs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3: SCHEDULE ══ */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-primary mb-1">Design your week</h3>
              <p className="text-sm text-secondary">Choose your training days, then assign what happens each day.</p>
            </div>

            {/* Part A: Training day picker */}
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-2">Training Days</label>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day, i) => {
                  const isTraining = form.availableDays.includes(day);
                  const isFullRest = form.fullRestDays.includes(day);
                  return (
                    <button key={day}
                      onClick={() => {
                        if (isTraining) toggleDay(day);
                        else if (isFullRest) toggleFullRestDay(day);
                        else toggleDay(day);
                      }}
                      className={`py-3 rounded-[12px] text-[10px] font-medium transition-all
                                  flex flex-col items-center gap-1
                        ${isTraining  ? 'bg-bc-blue text-white'
                          : isFullRest ? 'bg-rest-bg text-rest-accent border border-rest-accent/30'
                          : 'bg-canvas border border-border text-tertiary'}`}>
                      {DAY_LABELS[i]}
                      <span className="text-[8px]">{isTraining ? 'Train' : isFullRest ? 'Rest' : '—'}</span>
                    </button>
                  );
                })}
              </div>
              {form.fullRestDays.length < 1 && (
                <p className="bc-caption text-bc-orange-dark mt-2">At least 1 full rest day required</p>
              )}
              <p className="bc-caption mt-1.5">
                {form.availableDays.length} training · {form.fullRestDays.length} rest
              </p>
            </div>

            {/* Part B: Per-day assignment */}
            {form.availableDays.length > 0 && (
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1">Day Assignment</label>
                <p className="bc-caption mb-3">
                  {form.planType === 'hybrid'
                    ? 'Tap to assign each day as Run, Lift, or Both. Leave as "Auto" to let AI decide.'
                    : form.planType === 'running'
                    ? 'All training days will be run days.'
                    : 'All training days will be lift days.'}
                </p>

                <div className="space-y-2">
                  {DAYS.filter(day => form.availableDays.includes(day)).map(day => {
                    const idx    = DAYS.indexOf(day);
                    const assign = form.dayAssignments[day] || null;

                    const options = form.planType === 'running'
                      ? DAY_TYPE_OPTIONS.filter(t => t.value === 'run')
                      : form.planType === 'lifting'
                      ? DAY_TYPE_OPTIONS.filter(t => t.value === 'lift')
                      : DAY_TYPE_OPTIONS;

                    return (
                      <div key={day} className="flex items-center gap-2">
                        {/* Day label — fixed width */}
                        <span className="text-sm font-semibold text-primary w-9 flex-shrink-0">
                          {DAY_LABELS[idx]}
                        </span>

                        {/* Type toggle buttons */}
                        <div className="flex gap-1 flex-1 flex-wrap">
                          {options.map(opt => {
                            const isSelected = assign === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setDayAssignment(day, isSelected ? null : opt.value)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs
                                            font-medium border transition-all flex-1 justify-center min-h-[36px]
                                  ${isSelected
                                    ? `${opt.bg} ${opt.border} ${opt.color}`
                                    : 'bg-canvas border-border text-tertiary hover:border-border-strong'}`}>
                                <opt.Icon size={11} strokeWidth={2} />
                                {opt.label}
                              </button>
                            );
                          })}
                          {/* Auto pill for hybrid when nothing assigned */}
                          {form.planType === 'hybrid' && !assign && (
                            <span className="flex items-center px-2.5 py-1.5 rounded-full text-[10px]
                                            text-tertiary border border-dashed border-border bg-canvas">
                              Auto
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary for hybrid */}
                {form.planType === 'hybrid' && (
                  <div className="mt-3 flex items-center gap-4 p-3 bg-canvas rounded-[12px] border border-border flex-wrap">
                    {(() => {
                      const vals  = Object.values(form.dayAssignments);
                      const runs  = vals.filter(v => v === 'run'  || v === 'both').length;
                      const lifts = vals.filter(v => v === 'lift' || v === 'both').length;
                      const unset = form.availableDays.length - Object.keys(form.dayAssignments).filter(d => form.availableDays.includes(d)).length;
                      return (
                        <>
                          <div className="flex items-center gap-1">
                            <Footprints size={12} className="text-run-accent" />
                            <span className="text-xs font-semibold text-run-accent">{runs}</span>
                            <span className="bc-caption">run{runs !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Dumbbell size={12} className="text-lift-accent" />
                            <span className="text-xs font-semibold text-lift-accent">{lifts}</span>
                            <span className="bc-caption">lift{lifts !== 1 ? 's' : ''}</span>
                          </div>
                          {unset > 0 && (
                            <span className="bc-caption text-tertiary">{unset} auto-assigned</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Long run day */}
            {(form.planType==='running' || form.planType==='hybrid') && form.availableDays.length > 0 && (
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-1.5">Long Run Day</label>
                <select value={form.longRunDay} onChange={e => update('longRunDay', e.target.value)}
                  className="bc-input cursor-pointer">
                  {form.availableDays
                    .filter(day => !form.dayAssignments[day] || ['run','both'].includes(form.dayAssignments[day]))
                    .map(day => (
                      <option key={day} value={day}>
                        {DAY_LABELS[DAYS.indexOf(day)]}{(day==='saturday'||day==='sunday') ? ' (recommended)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Max session length */}
            <div>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">Max Session Length</label>
              <select value={form.maxMinutesPerSession}
                onChange={e => update('maxMinutesPerSession', Number(e.target.value))}
                className="bc-input cursor-pointer">
                {[30,45,60,75,90,120].map(n => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </div>

            {/* Equipment */}
            {(form.planType==='lifting' || form.planType==='hybrid') && (
              <div>
                <label className="bc-caption uppercase tracking-wider block mb-2">Equipment</label>
                <div className="space-y-2">
                  {[
                    { value:'full_gym',   label:'Full Gym',        desc:'Barbells, cables, machines, dumbbells' },
                    { value:'home_basic', label:'Home — Basic',    desc:'Dumbbells + pull-up bar' },
                    { value:'bodyweight', label:'Bodyweight Only', desc:'No equipment' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => update('equipment', opt.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all
                        ${form.equipment===opt.value ? 'border-rest-accent bg-rest-bg' : 'border-border bg-canvas hover:border-border-strong'}`}>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-primary">{opt.label}</p>
                        <p className="bc-caption">{opt.desc}</p>
                      </div>
                      {form.equipment===opt.value && <span className="text-rest-accent text-xs font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-bc-red-light border border-bc-red/20 rounded-[14px]">
            <p className="text-sm font-semibold text-bc-red-dark mb-1">Plan generation failed</p>
            <p className="text-xs text-bc-red-dark/80 mb-3">{error}</p>
            <button onClick={handleGenerate}
              className="flex items-center gap-1.5 px-3 py-2 bg-bc-red text-white text-xs
                         font-semibold rounded-[10px] active:scale-95 transition-all">
              Try again
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div>
            {step > 0
              ? <button onClick={() => setStep(step-1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-secondary text-sm
                             hover:text-primary transition-colors min-h-[44px]">
                  <ChevronLeft size={14} /> Back
                </button>
              : <button onClick={onCancel}
                  className="px-4 py-2.5 text-secondary text-sm hover:text-primary
                             transition-colors min-h-[44px]">
                  Cancel
                </button>
            }
          </div>
          {step < 3
            ? <button onClick={() => setStep(step+1)} disabled={!canAdvance()}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-bc-blue hover:opacity-90
                           disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm
                           font-semibold rounded-[10px] transition-all active:scale-95 min-h-[44px]">
                Next <ChevronRight size={14} />
              </button>
            : (() => {
                const blocker = getGenerateBlocker();
                return (
                  <div className="flex flex-col items-end gap-1">
                    <button onClick={handleGenerate} disabled={!!blocker || generating}
                      className={`flex items-center gap-2 px-5 py-2.5 bg-bc-indigo hover:opacity-90
                                 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm
                                 font-semibold rounded-[10px] transition-all active:scale-95 min-h-[44px]
                                 ${blocker ? 'opacity-50' : ''}`}>
                      <Sparkles size={14} /> {generating ? 'Generating…' : 'Generate Plan'}
                    </button>
                    {blocker && (
                      <p className="text-xs text-tertiary text-right">{blocker}</p>
                    )}
                  </div>
                );
              })()
          }
        </div>
      </div>
    </div>
  );
}