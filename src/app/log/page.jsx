'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDate, comparePaces } from '@/utils/runUtils';
import { formatVolume } from '@/utils/liftUtils';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import LogForm from '@/components/shared/LogForm';
import { useWorkouts } from '@/lib/WorkoutContext';
import {
  Footprints, Dumbbell, Bike, Moon, Activity,
  SlidersHorizontal, X, ChevronDown, ChevronUp,
  Plus, TrendingUp, Calendar,
} from 'lucide-react';

// useSearchParams must live in a child component wrapped in Suspense
// to avoid Next.js prerender errors during static generation
function LogPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const startId = searchParams?.get('start');
  return <LogPageContent startId={startId} router={router} />;
}

// Default export wraps the inner component in Suspense
export default function LogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-tertiary text-sm">Loading…</p>
      </div>
    }>
      <LogPageInner />
    </Suspense>
  );
}

// ── Type config ─────────────────────────────────────────
const TYPE_CONFIG = {
  run:    { Icon: Footprints, label: 'Run',    accent: '#34C759', bg: 'bg-run-bg',    text: 'text-run-accent'    },
  lift:   { Icon: Dumbbell,   label: 'Lift',   accent: '#007AFF', bg: 'bg-lift-bg',   text: 'text-lift-accent'   },
  cardio: { Icon: Bike,       label: 'Cardio', accent: '#FF9500', bg: 'bg-cardio-bg', text: 'text-cardio-accent' },
  rest:   { Icon: Moon,       label: 'Rest',   accent: '#8E8E93', bg: 'bg-rest-bg',   text: 'text-rest-accent'   },
  other:  { Icon: Activity,   label: 'Other',  accent: '#8E8E93', bg: 'bg-surface',   text: 'text-secondary'     },
};

const STATUS_CONFIG = {
  completed: { dot: 'bg-bc-green',   label: '✓' },
  planned:   { dot: 'bg-tertiary',   label: '·' },
  skipped:   { dot: 'bg-bc-red',     label: '✗' },
};

// ── Label helpers ────────────────────────────────────────
const RUN_LABELS = {
  easy:'Easy Run',tempo:'Tempo',interval:'Intervals',intervals:'Intervals',
  long_run:'Long Run',recovery:'Recovery',fartlek:'Fartlek',race:'Race',
  shakeout:'Shakeout',strides:'Strides',progression:'Progression',
  'easy run':'Easy Run','long run':'Long Run','tempo run':'Tempo',
  'speed work':'Speed Work','hill repeats':'Hill Repeats',
};
function fmtRun(t) {
  if (!t) return 'Run';
  const k = t.toLowerCase().replace(/_/g,' ');
  return RUN_LABELS[k] || t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
function fmtRest(t) {
  const m = {full_rest:'Rest Day',off_running:'No Running',off_lifting:'No Lifting',active_recovery:'Active Recovery'};
  return m[t] || m[t?.toLowerCase()] || 'Rest Day';
}

// ── ISO week key ─────────────────────────────────────────
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  const n  = 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(n).padStart(2,'0')}`;
}

// ── Main content component (receives startId + router as props) ────────────
function LogPageContent({ startId, router }) {
  const { workouts, saveWorkout, isLoaded } = useWorkouts();
  const startWorkout = startId ? workouts.find(w => w.id === startId) : null;

  const [showLogForm,      setShowLogForm]      = useState(!!startId);
  const [logFormWorkout,   setLogFormWorkout]   = useState(startWorkout || null);
  const [selectedWorkout,  setSelectedWorkout]  = useState(null);
  const [typeFilter,       setTypeFilter]       = useState('all');
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  const [showFilters,      setShowFilters]       = useState(false);
  const [showPastWeeks,    setShowPastWeeks]    = useState(false);
  const [sortDesc,         setSortDesc]         = useState(true);

  // Sync startWorkout once workouts load
  useEffect(() => {
    if (startId && workouts.length > 0 && !logFormWorkout) {
      const w = workouts.find(w => w.id === startId);
      if (w) { setLogFormWorkout(w); setShowLogForm(true); }
    }
  }, [startId, workouts]);

  // ── Filtered + sorted workouts ────────────────────────
  const filtered = useMemo(() => {
    return workouts
      .filter(w => {
        if (typeFilter !== 'all' && w.type !== typeFilter) return false;
        if (w.status === 'planned') return false; // history only shows logged sessions
        if (dateFrom && w.date < dateFrom) return false;
        if (dateTo   && w.date > dateTo)   return false;
        return true;
      })
      .sort((a, b) => sortDesc
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date));
  }, [workouts, typeFilter, dateFrom, dateTo, sortDesc]);

  // ── Group by ISO week ──────────────────────────────────
  const { currentWeekKey, weekGroups } = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const cwk   = isoWeek(today);

    const map = {};
    filtered.forEach(w => {
      const k = isoWeek(w.date);
      if (!map[k]) map[k] = [];
      map[k].push(w);
    });

    // Sort week keys: current first, then future desc, then past desc
    const keys = Object.keys(map).sort((a, b) => {
      if (a === cwk) return -1;
      if (b === cwk) return  1;
      return b.localeCompare(a);
    });

    const groups = keys.map(k => {
      const wks    = map[k];
      const done   = wks.filter(w => w.status === 'completed');
      const runs   = done.filter(w => w.type === 'run');
      const lifts  = done.filter(w => w.type === 'lift');
      const miles  = runs.reduce((s,w) => s+(w.details?.actualDistance||0), 0);
      const vol    = lifts.reduce((s,w) => s+(w.details?.totalVolume||0), 0);
      const dates  = wks.map(w => w.date).sort();
      const label  = k === cwk
        ? `This week · ${formatDate(dates[0])}`
        : `Week of ${formatDate(dates[0])}`;
      return { key:k, workouts:wks, label, miles, vol,
               runCount:runs.length, liftCount:lifts.length,
               sessionCount:done.length, isPast: k < cwk };
    });

    return { currentWeekKey:cwk, weekGroups:groups };
  }, [filtered]);

  const currentGroups = weekGroups.filter(g => !g.isPast);
  const pastGroups    = weekGroups.filter(g => g.isPast);

  // ── Stats across all filtered completed workouts ──────
  const stats = useMemo(() => {
    const done  = filtered.filter(w => w.status === 'completed');
    const runs  = done.filter(w => w.type === 'run');
    const lifts = done.filter(w => w.type === 'lift');
    return {
      total:   filtered.length,
      miles:   runs.reduce((s,w) => s+(w.details?.actualDistance||0), 0).toFixed(1),
      volume:  lifts.reduce((s,w) => s+(w.details?.totalVolume||0), 0),
      sessions:done.length,
    };
  }, [filtered]);

  function handleSave(data) {
    saveWorkout(data);
    setSelectedWorkout(null);
    setShowLogForm(false);
    setLogFormWorkout(null);
    // Clear the ?start= param without full navigation
    if (startId) router.replace('/log');
  }

  function openNewLog() {
    setLogFormWorkout(null);
    setShowLogForm(true);
  }

  const hasFilters = typeFilter !== 'all' || dateFrom || dateTo;

  if (!isLoaded) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-tertiary text-sm">Loading…</p>
    </div>
  );

  return (
    <div className="pb-24">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[15px] font-bold text-primary">Training Log</h2>
        <button onClick={openNewLog}
          className="flex items-center gap-1.5 px-4 py-2 bg-bc-blue text-white text-xs font-semibold
                     rounded-[10px] hover:opacity-90 active:scale-95 transition-all min-h-[44px]">
          <Plus size={14}/> Log Workout
        </button>
      </div>

      {/* ── Quick stats ── */}
      {stats.sessions > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label:'Sessions', value:stats.sessions,           color:'text-primary'      },
            { label:'Miles',    value:`${stats.miles} mi`,      color:'text-run-accent',  hide: stats.miles === '0.0' },
            { label:'Volume',   value:formatVolume(stats.volume),color:'text-lift-accent', hide: stats.volume === 0 },
          ].filter(s => !s.hide).map(s => (
            <div key={s.label} className="bc-card py-2.5 px-3 text-center">
              <p className={`text-[15px] font-bold ${s.color}`} style={{fontVariantNumeric:'tabular-nums'}}>{s.value}</p>
              <p className="text-[9px] text-tertiary uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter strip ── */}
      <div className="mb-4">
        {/* Type pills + filter toggle */}
        <div className="flex items-center gap-2">
          {/* Type pills */}
          <div className="flex gap-1 flex-1">
            {['all','run','lift','cardio'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all capitalize min-h-[36px] flex-1 ${
                  typeFilter === t
                    ? 'bg-bc-blue text-white'
                    : 'bg-canvas border border-border text-tertiary hover:text-secondary'
                }`}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)+'s'}
              </button>
            ))}
          </div>
          {/* Filter expand toggle */}
          <button onClick={() => setShowFilters(v => !v)}
            className={`w-9 h-9 rounded-[8px] flex items-center justify-center border transition-colors ${
              hasFilters ? 'bg-bc-blue border-bc-blue text-white' : 'bg-canvas border-border text-tertiary hover:text-secondary'
            }`}>
            <SlidersHorizontal size={14}/>
          </button>
          {/* Sort toggle */}
          <button onClick={() => setSortDesc(v => !v)}
            className="w-9 h-9 rounded-[8px] flex items-center justify-center border border-border bg-canvas text-tertiary hover:text-secondary transition-colors">
            <TrendingUp size={14} className={sortDesc ? '' : 'rotate-180'}/>
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-2 p-3 bg-canvas border border-border rounded-[12px]">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-tertiary uppercase tracking-wider block mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bc-input !py-1.5 !text-xs w-full"/>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-tertiary uppercase tracking-wider block mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bc-input !py-1.5 !text-xs w-full"/>
              </div>
              {hasFilters && (
                <button onClick={() => { setTypeFilter('all'); setDateFrom(''); setDateTo(''); }}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-bc-red hover:opacity-70 mt-4">
                  <X size={10}/> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {weekGroups.length === 0 && (
        <div className="bc-card bc-empty py-16">
          <Calendar size={32} className="text-tertiary mb-3"/>
          <p className="bc-empty-title">No workouts logged yet</p>
          <p className="bc-empty-text mb-4">Activate a plan or log your first session to get started.</p>
          <button onClick={openNewLog}
            className="flex items-center gap-1.5 px-4 py-2 bg-bc-blue text-white text-xs font-semibold rounded-[10px] active:scale-95 transition-all">
            <Plus size={12}/> Log First Workout
          </button>
        </div>
      )}

      {/* ── Current week + future ── */}
      <div className="space-y-1">
        {currentGroups.map(group => (
          <WeekGroup key={group.key} group={group} onWorkoutClick={setSelectedWorkout}/>
        ))}
      </div>

      {/* ── Past weeks toggle ── */}
      {pastGroups.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowPastWeeks(v => !v)}
            className="flex items-center justify-between w-full px-4 py-3 bc-card-flush hover:bg-canvas transition-colors min-h-[44px]">
            <div className="flex items-center gap-2">
              {showPastWeeks ? <ChevronUp size={12} className="text-tertiary"/> : <ChevronDown size={12} className="text-tertiary"/>}
              <span className="text-xs text-secondary font-semibold">
                Past weeks ({pastGroups.length})
              </span>
              {/* Completion color bars */}
              <div className="flex gap-0.5 ml-1">
                {pastGroups.slice(0,8).map(g => {
                  const rate = g.workouts.length > 0 ? g.sessionCount / g.workouts.length : 0;
                  return (
                    <span key={g.key} className="w-4 h-1.5 rounded-full"
                      style={{background: rate>=0.8?'#34C759':rate>=0.5?'#FF9500':'#FF3B30'}}/>
                  );
                })}
              </div>
            </div>
            <span className="text-[10px] text-tertiary">
              {pastGroups.reduce((s,g)=>s+g.sessionCount,0)} sessions
            </span>
          </button>

          {showPastWeeks && (
            <div className="space-y-1 mt-1">
              {pastGroups.map(group => (
                <WeekGroup key={group.key} group={group} onWorkoutClick={setSelectedWorkout} isPast/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onSave={handleSave}
      />

      {showLogForm && (
        <LogForm
          workout={logFormWorkout}
          onSave={handleSave}
          onClose={() => {
            setShowLogForm(false);
            setLogFormWorkout(null);
            if (startId) router.replace('/log');
          }}
        />
      )}
    </div>
  );
}

// ── Week group component ────────────────────────────────
function WeekGroup({ group, onWorkoutClick, isPast = false }) {
  const [expanded, setExpanded] = useState(!isPast);

  return (
    <div className="bc-card-flush">
      {/* Week header */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas transition-colors min-h-[44px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-secondary truncate">{group.label}</span>
          {group.runCount > 0 && (
            <span className="text-[10px] text-run-accent font-semibold">{group.miles}mi</span>
          )}
          {group.liftCount > 0 && (
            <span className="text-[10px] text-lift-accent font-semibold">{formatVolume(group.vol)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-tertiary">{group.sessionCount} done</span>
          {expanded ? <ChevronUp size={12} className="text-tertiary"/> : <ChevronDown size={12} className="text-tertiary"/>}
        </div>
      </button>

      {/* Workout cards */}
      {expanded && (
        <div className="border-t border-border/50">
          {[...group.workouts]
            .filter(w => w.status !== 'planned') // never show planned in log
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(w => (
              <WorkoutCard key={w.id} workout={w} onClick={() => onWorkoutClick(w)}/>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Individual workout card ─────────────────────────────
function WorkoutCard({ workout, onClick }) {
  const { date, type, status, details } = workout;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const Icon = cfg.Icon;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
  const skipped = status === 'skipped';

  // Build title and metric
  let title  = '';
  let metric = '';
  let metricColor = 'text-primary';
  let sub    = '';

  if (type === 'run') {
    title = (details.runDescription && details.runDescription !== details.runType)
      ? details.runDescription : fmtRun(details.runType);
    if (status === 'completed' && details.actualPace) {
      metric = `${details.actualDistance ?? ''} mi @ ${details.actualPace}`;
      const cmp = comparePaces(details.actualPace, details.targetPace);
      if (cmp) metricColor = cmp.color;
    } else if (details.plannedDistance) {
      metric = `${details.plannedDistance} mi planned`;
      metricColor = 'text-secondary';
    }
    if (details.phase) sub = details.phase;
  } else if (type === 'lift') {
    title = details.sessionName || 'Lift Session';
    if (details.totalVolume) {
      metric = formatVolume(details.totalVolume);
      metricColor = 'text-lift-accent';
      if (details.duration) metric += ` · ${details.duration}m`;
    } else if ((details.exercises||[]).length > 0) {
      metric = `${details.exercises.length} exercises`;
      metricColor = 'text-lift-accent';
    }
    if (details.muscleGroups?.length) sub = details.muscleGroups.slice(0,3).join(' · ');
  } else if (type === 'rest') {
    title = fmtRest(details.restType);
    metric = '';
  } else {
    title = details.activityType || 'Workout';
    metric = details.duration ? `${details.duration} min` : '';
  }

  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border/40
                  hover:bg-surface transition-colors last:border-b-0 ${skipped?'opacity-40':''}`}>
      {/* Status dot + type icon */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-8">
        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>
        <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${cfg.bg}`}>
          <Icon size={14} className={cfg.text} strokeWidth={2}/>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-primary truncate">{title}</p>
          {metric && (
            <p className={`text-sm font-bold flex-shrink-0 ${metricColor}`}
               style={{fontVariantNumeric:'tabular-nums'}}>{metric}</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-tertiary">{formatDate(date)}</span>
          {sub && <span className="text-[10px] text-tertiary">· {sub}</span>}
          {details.rpe != null && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
              details.rpe<=4 ? 'bg-run-bg text-run-accent' :
              details.rpe<=7 ? 'bg-bc-orange-light text-bc-orange-dark' :
              'bg-bc-red-light text-bc-red-dark'
            }`}>RPE {details.rpe}</span>
          )}
        </div>
        {details.notes && (
          <p className="text-[10px] text-tertiary mt-0.5 truncate italic">{details.notes}</p>
        )}
      </div>

      {/* Skipped indicator */}
      {skipped && (
        <span className="text-[10px] text-bc-red font-semibold flex-shrink-0">Skipped</span>
      )}
    </button>
  );
}