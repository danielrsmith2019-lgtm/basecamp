'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useWorkouts } from '@/lib/WorkoutContext';
import { savePlan, addWorkoutsBatch, updateUserSettings } from '@/lib/database';
import {
  X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Check, AlertTriangle, Footprints, Dumbbell, Upload,
  FileText, MessageSquare, Sparkles,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_IDX = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 };
const DAY_LABEL = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };

function getRunLabel(rt) {
  const map = { easy:'Easy Run', tempo:'Tempo', interval:'Intervals', long_run:'Long Run', recovery:'Recovery', fartlek:'Fartlek', race:'Race', shakeout:'Shakeout' };
  if (!rt) return 'Run';
  const k = rt.toLowerCase();
  return map[k] || rt.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Compute the Monday that starts week 1 of the plan,
// given that the user is currently in currentWeekNum.
function computePlanStartDate(currentWeekNum) {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysFromMonday);
  thisMonday.setHours(12, 0, 0, 0);
  const planStart = new Date(thisMonday);
  planStart.setDate(thisMonday.getDate() - (currentWeekNum - 1) * 7);
  return planStart.toLocaleDateString('en-CA');
}

// Get the 7 dates (Mon–Sun) for weekNumber, given planStartDate
function getWeekDates(weekNumber, planStartDate) {
  const base = new Date(planStartDate + 'T12:00:00');
  const ws = new Date(base);
  ws.setDate(base.getDate() + (weekNumber - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

// Initialise all past sessions to 'completed'. The user only changes what they skipped.
function initSessionMarks(plan, currentWeekNum, planStartDate) {
  const marks = {};
  const today = new Date().toLocaleDateString('en-CA');
  const base = new Date(planStartDate + 'T12:00:00');

  for (let wIdx = 0; wIdx < currentWeekNum - 1; wIdx++) {
    const week = plan.weeks[wIdx];
    if (!week) continue;
    const ws = new Date(base); ws.setDate(base.getDate() + wIdx * 7);

    (week.runs || []).forEach(run => {
      const off = DAY_IDX[run.dayOfWeek]; if (off === undefined) return;
      const d = new Date(ws); d.setDate(ws.getDate() + off);
      const ds = d.toLocaleDateString('en-CA');
      if (ds >= today) return;
      marks[`week${week.weekNumber}-${run.dayOfWeek}-run`] = {
        status: 'completed', actualDistance: null, actualPace: null,
      };
    });

    (week.lifts || []).forEach(lift => {
      const off = DAY_IDX[lift.dayOfWeek]; if (off === undefined) return;
      const d = new Date(ws); d.setDate(ws.getDate() + off);
      const ds = d.toLocaleDateString('en-CA');
      if (ds >= today) return;
      marks[`week${week.weekNumber}-${lift.dayOfWeek}-lift`] = {
        status: 'completed', duration: null, notes: null,
      };
    });
  }
  return marks;
}

function countSessions(plan) {
  return (plan.weeks || []).reduce((s, w) => s + (w.runs?.length || 0) + (w.lifts?.length || 0), 0);
}

// Build all workout entries, applying session marks for past dates
function buildImportedWorkouts(plan, planStartDate, sessionMarks, importHistory) {
  const today = new Date().toLocaleDateString('en-CA');
  const base = new Date(planStartDate + 'T12:00:00');
  const out = [];

  plan.weeks.forEach((week, wIdx) => {
    const ws = new Date(base); ws.setDate(base.getDate() + wIdx * 7);
    const restSet = new Set((week.restDays || []).map(e => typeof e === 'object' ? e.dayOfWeek : e));

    (week.runs || []).forEach(run => {
      const isRace = (run.runType || '').toLowerCase() === 'race';
      const off = DAY_IDX[run.dayOfWeek]; if (off === undefined) return;
      if (!isRace && restSet.has(run.dayOfWeek)) return;
      const d = new Date(ws); d.setDate(ws.getDate() + off);
      const ds = d.toLocaleDateString('en-CA');
      const isPast = ds < today;
      const key = `week${week.weekNumber}-${run.dayOfWeek}-run`;
      const mark = sessionMarks[key];

      let status = 'planned';
      if (isPast && importHistory) {
        status = mark?.status === 'skipped' ? 'skipped' : 'completed';
      }

      const details = {
        runType: run.runType || 'easy',
        plannedDistance: run.distance,
        targetPace: run.targetPace || '',
        duration: run.duration,
        notes: run.notes || '',
        weekNumber: week.weekNumber,
        phase: week.phase,
        dayOfWeek: run.dayOfWeek,
        isRaceDay: isRace,
        raceName: run.raceName || plan.raceName || null,
        goalTime: run.goalTime || null,
      };
      if (isPast && status === 'completed') {
        details.actualDistance = mark?.actualDistance || run.distance;
        if (mark?.actualPace) details.actualPace = mark.actualPace;
      }
      out.push({ date: ds, type: 'run', status, details });
    });

    (week.lifts || []).forEach(lift => {
      const off = DAY_IDX[lift.dayOfWeek]; if (off === undefined) return;
      if (restSet.has(lift.dayOfWeek)) return;
      const d = new Date(ws); d.setDate(ws.getDate() + off);
      const ds = d.toLocaleDateString('en-CA');
      const isPast = ds < today;
      const key = `week${week.weekNumber}-${lift.dayOfWeek}-lift`;
      const mark = sessionMarks[key];

      let status = 'planned';
      if (isPast && importHistory) {
        status = mark?.status === 'skipped' ? 'skipped' : 'completed';
      }

      const details = {
        sessionName: lift.sessionName || 'Strength Session',
        muscleGroups: lift.muscleGroups || [],
        exercises: (lift.exercises || []).map(ex => ({ name: ex.name, sets: ex.sets, reps: ex.reps, notes: '' })),
        duration: isPast && mark?.duration ? mark.duration : lift.duration,
        weekNumber: week.weekNumber,
        phase: week.phase,
        dayOfWeek: lift.dayOfWeek,
      };
      out.push({ date: ds, type: 'lift', status, details });
    });

    (week.restDays || []).forEach(entry => {
      const dayName = typeof entry === 'object' ? entry.dayOfWeek : entry;
      const restType = typeof entry === 'object' ? entry.restType : 'full_rest';
      const off = DAY_IDX[dayName]; if (off === undefined) return;
      const d = new Date(ws); d.setDate(ws.getDate() + off);
      out.push({
        date: d.toLocaleDateString('en-CA'), type: 'rest', status: 'planned',
        details: { restType, weekNumber: week.weekNumber, phase: week.phase },
      });
    });
  });

  return out;
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function PlanImportWizard({ onComplete, onClose }) {
  const { user } = useAuth();
  const { refresh, workouts: allWorkouts } = useWorkouts();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1
  const [inputTab,   setInputTab]   = useState('paste');
  const [rawInput,   setRawInput]   = useState('');
  const [parsedPlan, setParsedPlan] = useState(null);
  const [parsing,    setParsing]    = useState(false);
  const [parseError, setParseError] = useState(null);
  const [showJson,   setShowJson]   = useState(false);

  // Step 2
  const [currentWeekNum, setCurrentWeekNum] = useState(1);
  const [importHistory,  setImportHistory]  = useState(true);

  // Step 3
  const [sessionMarks,      setSessionMarks]      = useState({});
  const [expandedHistWeeks, setExpandedHistWeeks] = useState(new Set());
  const [expandedDetails,   setExpandedDetails]   = useState(new Set());

  // Activation
  const [activating, setActivating] = useState(false);
  const [importResult, setImportResult] = useState(null); // { total, history }
  const [activateError, setActivateError] = useState(null);

  // Computed plan start date
  const planStartDate = useMemo(() => computePlanStartDate(currentWeekNum), [currentWeekNum]);

  const totalWeeks = parsedPlan?.total_weeks || parsedPlan?.weeks?.length || 0;

  // ── Step 1: Parse ────────────────────────────────────────────────────────

  async function handleParse() {
    const text = rawInput.trim();
    if (!text) return;
    setParsing(true); setParseError(null);
    try {
      const res = await fetch('/api/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Parse failed');
      setParsedPlan(json.plan);
      setCurrentWeekNum(1);
      setStep(2);
    } catch (err) {
      setParseError(err.message || 'Could not parse your plan — try pasting as plain text');
    } finally {
      setParsing(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.xlsx')) {
      setParseError('Excel files: please save as .csv or .txt first, then upload or paste the content.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setRawInput(ev.target.result || '');
    reader.readAsText(file);
    setParseError(null);
  }

  // ── Step 2 → 3 transition ───────────────────────────────────────────────

  function handleCalibrateNext() {
    if (!parsedPlan) return;
    const marks = initSessionMarks(parsedPlan, currentWeekNum, planStartDate);
    setSessionMarks(marks);
    setExpandedHistWeeks(new Set());

    // Skip Step 3 if no history or no past weeks
    const hasPastWeeks = currentWeekNum > 1 && importHistory;
    setStep(hasPastWeeks ? 3 : 4);
  }

  // ── Step 3: session mark helpers ─────────────────────────────────────────

  function updateMark(key, updates) {
    setSessionMarks(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { status: 'completed' }), ...updates },
    }));
  }

  function markAllInWeek(weekNum, status) {
    setSessionMarks(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.startsWith(`week${weekNum}-`)) next[k] = { ...next[k], status };
      });
      return next;
    });
  }

  function toggleHistWeek(n) {
    setExpandedHistWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function toggleDetail(key) {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Step 5: Activate ─────────────────────────────────────────────────────

  async function handleActivate() {
    if (!user || !parsedPlan) return;
    setActivating(true); setActivateError(null);
    try {
      // 1. Save plan
      await savePlan(user.id, {
        name:        parsedPlan.name || 'Training Plan',
        description: parsedPlan.description || '',
        plan_type:   parsedPlan.plan_type || 'hybrid',
        plan_data:   parsedPlan,
        is_active:   true,
        progress:    { completed: 0, total: countSessions(parsedPlan) },
      });

      // 2. Build all workout entries
      const allEntries = buildImportedWorkouts(parsedPlan, planStartDate, sessionMarks, importHistory);

      // 3. Deduplicate against existing workouts
      const existingSet = new Set(allWorkouts.map(w => `${w.date}:${w.type}`));
      const newEntries = allEntries.filter(e => !existingSet.has(`${e.date}:${e.type}`));

      // 4. Insert
      if (newEntries.length) await addWorkoutsBatch(user.id, newEntries);

      const histCount = newEntries.filter(e => e.status === 'completed' || e.status === 'skipped').length;

      // 5. Save race info to user_settings if detected
      const raceEntry = newEntries.find(e => e.type === 'run' && e.details?.isRaceDay);
      if (raceEntry) {
        await updateUserSettings(user.id, {
          race_date:      raceEntry.date,
          race_name:      raceEntry.details.raceName || parsedPlan.raceName || parsedPlan.name || 'Race',
          race_distance:  parsedPlan.raceDistance || 'marathon',
          race_goal_time: parsedPlan.goalTime || '',
        });
      }

      // 6. Refresh
      await refresh?.();

      setImportResult({ total: newEntries.length, history: histCount });
    } catch (err) {
      console.error('Import failed:', err);
      setActivateError(err.message || 'Import failed — please try again');
    } finally {
      setActivating(false);
    }
  }

  // ── Progress dots ────────────────────────────────────────────────────────

  const totalSteps = importHistory && currentWeekNum > 1 ? 5 : 4;
  const displayStep = step > 3 && !(importHistory && currentWeekNum > 1) ? step - 1 : step;

  // ── Conflict check (Step 4) ───────────────────────────────────────────────
  const conflictCount = useMemo(() => {
    if (!parsedPlan || !planStartDate) return 0;
    const entries = buildImportedWorkouts(parsedPlan, planStartDate, sessionMarks, importHistory);
    const existingSet = new Set(allWorkouts.map(w => `${w.date}:${w.type}`));
    return entries.filter(e => existingSet.has(`${e.date}:${e.type}`)).length;
  }, [parsedPlan, planStartDate, sessionMarks, importHistory, allWorkouts]);

  // ── Mark counts (Step 3 footer) ───────────────────────────────────────────
  const markCounts = useMemo(() => {
    const counts = { completed: 0, skipped: 0, partial: 0 };
    Object.values(sessionMarks).forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
    return counts;
  }, [sessionMarks]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 border-b border-border flex-shrink-0"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 14 }}>
        <div className="flex items-center gap-3">
          {step > 1 && !importResult && !activating && (
            <button onClick={() => setStep(s => s > 2 ? s - 1 : 1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-canvas text-secondary hover:text-primary min-h-[44px] min-w-[44px]">
              <ChevronLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-[15px] font-bold text-primary">Import Existing Plan</h2>
            {!importResult && (
              <p className="text-[10px] text-tertiary mt-0.5">
                Step {displayStep} of {totalSteps}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Step dots */}
          {!importResult && (
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: i < displayStep ? '#007AFF' : '#E5E5EA' }} />
              ))}
            </div>
          )}
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary min-w-[44px] min-h-[44px]">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── SUCCESS SCREEN ── */}
      {importResult && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-bc-green-light flex items-center justify-center mb-4">
            <Check size={28} className="text-bc-green-dark" />
          </div>
          <h3 className="text-[22px] font-bold text-primary mb-2">Your plan is live!</h3>
          <p className="text-sm text-secondary mb-1">{importResult.total} sessions imported</p>
          {importResult.history > 0 && (
            <p className="text-sm text-secondary mb-6">{importResult.history} completed sessions added to history</p>
          )}
          <button onClick={onComplete}
            className="bc-btn-primary px-8 py-3 text-sm flex items-center gap-2 min-h-[44px]">
            View your plan <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── ACTIVATING SCREEN ── */}
      {activating && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 size={28} className="animate-spin text-bc-blue" />
          <p className="text-sm text-secondary">Importing your plan…</p>
        </div>
      )}

      {/* ── STEP CONTENT ── */}
      {!importResult && !activating && (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* ════ STEP 1: Input ════ */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-primary mb-1">Paste your training plan</h3>
                  <p className="text-sm text-secondary">Any format works — weekly schedule, numbered list, spreadsheet export, or free text.</p>
                </div>

                {/* Input tabs */}
                <div className="flex rounded-[10px] border border-border overflow-hidden text-xs">
                  {[
                    { id: 'paste',    icon: <FileText size={12}/>,    label: 'Paste text' },
                    { id: 'upload',   icon: <Upload size={12}/>,      label: 'Upload file' },
                    { id: 'describe', icon: <MessageSquare size={12}/>, label: 'Describe it' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => { setInputTab(tab.id); setParseError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-2.5 font-semibold transition-colors min-h-[40px] ${
                        inputTab === tab.id ? 'bg-bc-blue text-white' : 'bg-canvas text-secondary hover:bg-surface-alt'
                      }`}>
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {inputTab === 'paste' && (
                  <textarea
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    rows={10}
                    placeholder={"Paste your plan in any format. Examples:\n\nWeek 1: Mon easy 3mi, Wed tempo 5mi, Sat long 12mi\n\nOr:\nMonday: Easy 30 min\nWednesday: Tempo 5K\nFriday: Upper body strength\nSaturday: Long run 12 miles"}
                    className="bc-input resize-none text-sm"
                    style={{ fontSize: '14px' }}
                  />
                )}

                {inputTab === 'upload' && (
                  <div>
                    <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-[14px] cursor-pointer hover:border-bc-blue/50 hover:bg-bc-blue-light/20 transition-colors">
                      <Upload size={24} className="text-tertiary mb-2" />
                      <span className="text-sm font-medium text-secondary">Click to upload</span>
                      <span className="text-[10px] text-tertiary mt-0.5">.txt or .csv supported</span>
                      <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {rawInput && (
                      <div className="mt-3 p-3 bg-canvas rounded-[10px] border border-border">
                        <p className="text-[10px] text-tertiary mb-1">File loaded ({rawInput.length} chars)</p>
                        <p className="text-xs text-secondary truncate">{rawInput.slice(0, 120)}…</p>
                      </div>
                    )}
                  </div>
                )}

                {inputTab === 'describe' && (
                  <div>
                    <p className="text-xs text-secondary mb-2">Include: how many weeks total, training days per week, run types and distances, any lifting sessions.</p>
                    <textarea
                      value={rawInput}
                      onChange={e => setRawInput(e.target.value)}
                      rows={8}
                      placeholder={"Example:\n\n16-week marathon training plan. I run 5 days/week: Monday easy 4mi, Wednesday tempo 5mi, Thursday easy 4mi, Saturday long run (starts at 12mi, peaks at 22mi week 14), Sunday easy 3mi. I also lift 3x/week: upper push Tue, lower body Thu, full body Fri. Taper starts week 14. Race is a marathon."}
                      className="bc-input resize-none text-sm"
                      style={{ fontSize: '14px' }}
                    />
                  </div>
                )}

                {parseError && (
                  <div className="flex items-start gap-2 p-3 bg-bc-red-light border border-bc-red/20 rounded-[12px]">
                    <AlertTriangle size={14} className="text-bc-red-dark flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-bc-red-dark">{parseError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ════ STEP 2: Calibration ════ */}
            {step === 2 && parsedPlan && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-primary mb-1">Where are you in this plan?</h3>
                  <p className="text-sm text-secondary">Tell BaseCamp which week you're currently training in so it can place past and future sessions correctly.</p>
                </div>

                {/* Parsed summary */}
                <div className="bc-card p-4 bg-bc-indigo-light/30 border-bc-indigo/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-bc-indigo" />
                    <p className="text-sm font-semibold text-primary">{parsedPlan.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-secondary">
                    <span>{totalWeeks} weeks</span>
                    <span>·</span>
                    <span>~{Math.round((parsedPlan.weeks || []).reduce((s,w)=>(s+(w.runs?.length||0)),0)/Math.max(1,totalWeeks)*10)/10} runs/wk</span>
                    {(parsedPlan.weeks||[]).some(w=>w.lifts?.length) && <>
                      <span>·</span>
                      <span>~{Math.round((parsedPlan.weeks||[]).reduce((s,w)=>(s+(w.lifts?.length||0)),0)/Math.max(1,totalWeeks)*10)/10} lifts/wk</span>
                    </>}
                    {parsedPlan.raceName && <><span>·</span><span>Race: {parsedPlan.raceName}</span></>}
                  </div>
                  <button onClick={() => setShowJson(v=>!v)}
                    className="text-[10px] text-bc-indigo mt-2 flex items-center gap-1">
                    {showJson ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                    {showJson ? 'Hide' : 'Verify'} parsed JSON
                  </button>
                  {showJson && (
                    <pre className="mt-2 text-[9px] text-secondary bg-white/60 rounded-[8px] p-2 overflow-auto max-h-32">
                      {JSON.stringify(parsedPlan, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Week stepper */}
                <div>
                  <label className="bc-caption uppercase tracking-wider block mb-3">I am currently in week</label>
                  <div className="flex items-center gap-4 justify-center">
                    <button onClick={() => setCurrentWeekNum(n => Math.max(1, n - 1))}
                      className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-secondary hover:bg-canvas text-xl min-h-[44px] min-w-[44px]">
                      −
                    </button>
                    <div className="text-center">
                      <input type="number" min="1" max={totalWeeks} value={currentWeekNum}
                        onChange={e => setCurrentWeekNum(Math.max(1, Math.min(totalWeeks, parseInt(e.target.value) || 1)))}
                        className="bc-input text-center text-2xl font-bold w-20 bc-data"
                        style={{ fontSize: '24px' }} />
                      <p className="text-xs text-tertiary mt-1">of {totalWeeks} weeks</p>
                    </div>
                    <button onClick={() => setCurrentWeekNum(n => Math.min(totalWeeks, n + 1))}
                      className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-secondary hover:bg-canvas text-xl min-h-[44px] min-w-[44px]">
                      +
                    </button>
                  </div>
                </div>

                {/* Date preview */}
                <div className="bc-card p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">Plan started</span>
                    <span className="font-semibold text-primary">{fmtDate(planStartDate)}</span>
                  </div>
                  {totalWeeks > 0 && (() => {
                    const end = new Date(planStartDate + 'T12:00:00');
                    end.setDate(end.getDate() + totalWeeks * 7 - 1);
                    return (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">Plan ends</span>
                        <span className="font-semibold text-primary">{fmtDate(end.toLocaleDateString('en-CA'))}</span>
                      </div>
                    );
                  })()}
                  {parsedPlan.raceName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-secondary">Race</span>
                      <span className="font-semibold text-bc-red">{parsedPlan.raceName}</span>
                    </div>
                  )}
                </div>

                {/* Import history toggle */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-3">Import your completed history?</p>
                  <div className="flex gap-2">
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setImportHistory(val)}
                        className={`flex-1 py-3 rounded-[12px] text-sm font-semibold transition-colors min-h-[44px] border ${
                          importHistory === val
                            ? 'bg-bc-blue text-white border-bc-blue'
                            : 'bg-canvas text-secondary border-border'
                        }`}>
                        {val ? 'Yes, mark what I\'ve done' : 'No, just future weeks'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════ STEP 3: History Marking ════ */}
            {step === 3 && parsedPlan && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-bold text-primary mb-1">
                    Mark your history (Weeks 1–{currentWeekNum - 1})
                  </h3>
                  <p className="text-sm text-secondary">
                    All sessions default to Done. Tap to change any you skipped or only partially completed.
                  </p>
                </div>

                {parsedPlan.weeks.slice(0, currentWeekNum - 1).map(week => {
                  const weekDates = getWeekDates(week.weekNumber, planStartDate);
                  const today = new Date().toLocaleDateString('en-CA');
                  const isExpanded = expandedHistWeeks.has(week.weekNumber);

                  // Collect past sessions in this week
                  const pastSessions = [];
                  (week.runs || []).forEach(run => {
                    const off = DAY_IDX[run.dayOfWeek]; if (off === undefined) return;
                    const ds = weekDates[off];
                    if (!ds || ds >= today) return;
                    pastSessions.push({ key: `week${week.weekNumber}-${run.dayOfWeek}-run`, type: 'run', run, ds });
                  });
                  (week.lifts || []).forEach(lift => {
                    const off = DAY_IDX[lift.dayOfWeek]; if (off === undefined) return;
                    const ds = weekDates[off];
                    if (!ds || ds >= today) return;
                    pastSessions.push({ key: `week${week.weekNumber}-${lift.dayOfWeek}-lift`, type: 'lift', lift, ds });
                  });
                  pastSessions.sort((a, b) => a.ds.localeCompare(b.ds));

                  if (pastSessions.length === 0) return null;

                  const wStart = weekDates[0], wEnd = weekDates[6];
                  const weekMarks = Object.entries(sessionMarks).filter(([k]) => k.startsWith(`week${week.weekNumber}-`));
                  const doneCnt = weekMarks.filter(([,m]) => m.status !== 'skipped').length;
                  const skipCnt = weekMarks.filter(([,m]) => m.status === 'skipped').length;

                  return (
                    <div key={week.weekNumber} className="bc-card-flush overflow-hidden">
                      {/* Week header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-canvas min-h-[52px]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary">
                            Week {week.weekNumber}
                            <span className="text-secondary font-normal text-[11px] ml-1.5">
                              {fmtShortDate(wStart)}–{fmtShortDate(wEnd)}
                            </span>
                          </p>
                          <p className="text-[10px] text-tertiary">
                            {doneCnt} done · {skipCnt} skipped · {pastSessions.length} sessions
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => markAllInWeek(week.weekNumber, 'completed')}
                            className="text-[10px] font-semibold text-bc-green-dark px-2 py-1 bg-bc-green-light rounded-[6px] min-h-[32px]">
                            ✓ All
                          </button>
                          <button onClick={() => markAllInWeek(week.weekNumber, 'skipped')}
                            className="text-[10px] font-semibold text-bc-red-dark px-2 py-1 bg-bc-red-light rounded-[6px] min-h-[32px]">
                            ✗ All
                          </button>
                          <button onClick={() => toggleHistWeek(week.weekNumber)}
                            className="w-8 h-8 flex items-center justify-center text-tertiary">
                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </button>
                        </div>
                      </div>

                      {/* Sessions */}
                      {isExpanded && (
                        <div className="border-t border-border divide-y divide-border/50">
                          {pastSessions.map(({ key, type, run, lift, ds }) => {
                            const mark = sessionMarks[key] || { status: 'completed' };
                            const isDetailExpanded = expandedDetails.has(key);
                            const showDetailFields = isDetailExpanded || mark.status === 'partial';
                            const d = new Date(ds + 'T12:00:00');
                            const dayLabel = DAY_LABEL[type === 'run' ? run?.dayOfWeek : lift?.dayOfWeek] || '';

                            return (
                              <div key={key} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {/* Session info */}
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {type === 'run'
                                      ? <Footprints size={12} className="text-run-accent flex-shrink-0" />
                                      : <Dumbbell size={12} className="text-lift-accent flex-shrink-0" />}
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-primary truncate">
                                        {type === 'run'
                                          ? `${getRunLabel(run.runType)}${run.distance ? ` · ${run.distance} mi` : ''}`
                                          : (lift.sessionName || 'Lift')}
                                      </p>
                                      <p className="text-[10px] text-tertiary">
                                        {dayLabel} {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Status toggle */}
                                  <div className="flex rounded-[8px] border border-border overflow-hidden text-[10px] flex-shrink-0">
                                    {[
                                      { val: 'completed', label: '✓', color: mark.status === 'completed' ? '#34C759' : undefined },
                                      { val: 'partial',   label: '~', color: mark.status === 'partial'   ? '#FF9500' : undefined },
                                      { val: 'skipped',   label: '✗', color: mark.status === 'skipped'   ? '#FF3B30' : undefined },
                                    ].map(({ val, label, color }) => (
                                      <button key={val}
                                        onClick={() => updateMark(key, { status: val })}
                                        className="px-2.5 py-1.5 font-bold transition-colors min-h-[36px] min-w-[36px]"
                                        style={{
                                          background: color ? `${color}22` : '#F2F2F7',
                                          color: color || '#8E8E93',
                                        }}>
                                        {label}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Detail expand (only for Done status) */}
                                  {mark.status !== 'skipped' && (
                                    <button onClick={() => toggleDetail(key)}
                                      className="w-7 h-7 flex items-center justify-center text-tertiary flex-shrink-0">
                                      {isDetailExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                    </button>
                                  )}
                                </div>

                                {/* Detail fields */}
                                {showDetailFields && mark.status !== 'skipped' && (
                                  <div className="mt-2 ml-5 grid grid-cols-2 gap-2">
                                    {type === 'run' && <>
                                      <div>
                                        <label className="bc-caption block mb-1">Actual distance (mi)</label>
                                        <input type="number" step="0.1"
                                          value={mark.actualDistance || ''}
                                          onChange={e => updateMark(key, { actualDistance: parseFloat(e.target.value) || null })}
                                          placeholder={String(run.distance || '')}
                                          className="bc-input !text-sm bc-data" style={{ fontSize: '16px' }} />
                                      </div>
                                      <div>
                                        <label className="bc-caption block mb-1">Actual pace (M:SS)</label>
                                        <input type="text"
                                          value={mark.actualPace || ''}
                                          onChange={e => updateMark(key, { actualPace: e.target.value })}
                                          placeholder={run.targetPace || 'optional'}
                                          className="bc-input !text-sm font-mono" style={{ fontSize: '16px' }} />
                                      </div>
                                    </>}
                                    {type === 'lift' && <>
                                      <div>
                                        <label className="bc-caption block mb-1">Duration (min)</label>
                                        <input type="number"
                                          value={mark.duration || ''}
                                          onChange={e => updateMark(key, { duration: parseInt(e.target.value) || null })}
                                          placeholder={String(lift.duration || '45')}
                                          className="bc-input !text-sm bc-data" style={{ fontSize: '16px' }} />
                                      </div>
                                    </>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ════ STEP 4: Preview ════ */}
            {step === 4 && parsedPlan && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-primary mb-1">Ready to import</h3>
                  <p className="text-sm text-secondary">Review what will be added to your BaseCamp.</p>
                </div>

                {/* Summary card */}
                <div className="bc-card p-4 space-y-2">
                  <p className="text-sm font-bold text-primary">{parsedPlan.name}</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-secondary">Total weeks</span>
                    <span className="font-semibold text-primary tabular-nums">{totalWeeks}</span>
                    <span className="text-secondary">Current week</span>
                    <span className="font-semibold text-primary">Week {currentWeekNum}</span>
                    <span className="text-secondary">Total sessions</span>
                    <span className="font-semibold text-primary tabular-nums">{countSessions(parsedPlan)}</span>
                    {importHistory && currentWeekNum > 1 && <>
                      <span className="text-secondary">History</span>
                      <span className="font-semibold text-primary">
                        {markCounts.completed} done · {markCounts.skipped} skipped
                      </span>
                    </>}
                    <span className="text-secondary">Plan starts</span>
                    <span className="font-semibold text-primary">{fmtDate(planStartDate)}</span>
                  </div>
                  {parsedPlan.raceName && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                      <span className="text-sm">🏁</span>
                      <span className="text-sm font-semibold text-bc-red">{parsedPlan.raceName}</span>
                      {parsedPlan.goalTime && <span className="text-xs text-tertiary">· Goal: {parsedPlan.goalTime}</span>}
                    </div>
                  )}
                </div>

                {/* Conflict warning */}
                {conflictCount > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-bc-orange-light border border-bc-orange/20 rounded-[12px]">
                    <AlertTriangle size={14} className="text-bc-orange-dark flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-bc-orange-dark">
                      You have {conflictCount} existing workouts in this date range. They'll be kept — imported sessions will be added alongside them. Duplicates can be deleted after import.
                    </p>
                  </div>
                )}

                {/* Week list */}
                <div className="space-y-1">
                  {parsedPlan.weeks.map(week => {
                    const wDates = getWeekDates(week.weekNumber, planStartDate);
                    const today = new Date().toLocaleDateString('en-CA');
                    const isCurrent = wDates[0] <= today && today <= wDates[6];
                    const isPast = wDates[6] < today;
                    const pastMarks = Object.entries(sessionMarks).filter(([k]) => k.startsWith(`week${week.weekNumber}-`));
                    const done = pastMarks.filter(([,m]) => m.status !== 'skipped').length;
                    const total = pastMarks.length;

                    return (
                      <div key={week.weekNumber}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-[10px] border ${
                          isCurrent ? 'border-bc-blue/40 bg-bc-blue-light/20' :
                          isPast    ? 'border-border bg-canvas' :
                                      'border-border'
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs font-semibold ${isCurrent ? 'text-bc-blue' : 'text-primary'}`}>
                            Week {week.weekNumber}
                            {isCurrent && <span className="ml-1 text-[10px] font-normal text-bc-blue">· Current</span>}
                          </span>
                          <span className="text-[10px] text-tertiary">
                            {fmtShortDate(wDates[0])}–{fmtShortDate(wDates[6])}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPast && total > 0 && (
                            <div className="h-1.5 w-16 bg-surface-alt rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-bc-green"
                                style={{ width: `${Math.round(done / total * 100)}%` }} />
                            </div>
                          )}
                          <span className="text-[10px] text-tertiary">
                            {week.runs?.length || 0}R · {week.lifts?.length || 0}L
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activateError && (
                  <div className="flex items-start gap-2 p-3 bg-bc-red-light border border-bc-red/20 rounded-[12px]">
                    <AlertTriangle size={14} className="text-bc-red-dark flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-bc-red-dark">{activateError}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-border px-5 pt-4 flex-shrink-0"
            style={{ paddingBottom: 'max(20px, calc(12px + env(safe-area-inset-bottom)))' }}>

            {/* Step 1 */}
            {step === 1 && (
              <button onClick={handleParse} disabled={!rawInput.trim() || parsing}
                className="bc-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 min-h-[44px]">
                {parsing ? <><Loader2 size={14} className="animate-spin"/> Parsing your plan…</> : <>Parse my plan <ChevronRight size={14}/></>}
              </button>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <button onClick={handleCalibrateNext}
                className="bc-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 min-h-[44px]">
                Continue <ChevronRight size={14} />
              </button>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-secondary">
                  <span>{markCounts.completed || 0} done</span>
                  <span>{markCounts.skipped || 0} skipped</span>
                  <span>{markCounts.partial || 0} partial</span>
                </div>
                <button onClick={() => setStep(4)}
                  className="bc-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 min-h-[44px]">
                  Continue <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <button onClick={handleActivate} disabled={activating}
                className="bc-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 min-h-[44px]"
                style={{ background: '#007AFF' }}>
                Import Plan
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
