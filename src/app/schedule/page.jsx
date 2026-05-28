'use client';

import { useState, useMemo } from 'react';
import DayTimeline from '@/components/shared/DayTimeline';
import CalendarView from '@/components/shared/CalendarView';
import WorkoutDetailModal from '@/components/shared/WorkoutDetailModal';
import LogForm from '@/components/shared/LogForm';
import { useWorkouts } from '@/lib/WorkoutContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SchedulePage() {
  const { workouts, saveWorkout, isLoaded } = useWorkouts();
  const [viewMode,        setViewMode]        = useState('list');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showNewForm,     setShowNewForm]      = useState(false);
  const [showPast,        setShowPast]         = useState(false);

  const today = new Date().toLocaleDateString('en-CA');

  const { pastDates, weekGroups } = useMemo(() => {
    const map = {};
    [...workouts]
      .sort((a,b) => a.date.localeCompare(b.date))
      .forEach(w => {
        if (!map[w.date]) map[w.date] = [];
        map[w.date].push(w);
      });

    const allDates = Object.entries(map);
    const past     = allDates.filter(([d]) => d < today);
    const upcoming = allDates.filter(([d]) => d >= today);

    // Group by Mon–Sun week
    const weekMap = {};
    upcoming.forEach(([date, dayWorkouts]) => {
      const d = new Date(date + 'T12:00:00');
      const dow = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      const key = mon.toLocaleDateString('en-CA');
      if (!weekMap[key]) weekMap[key] = { monday: mon, days: [] };
      weekMap[key].days.push([date, dayWorkouts]);
    });

    const wg = Object.entries(weekMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key, { monday, days }]) => {
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const phaseCounts = {};
        days.forEach(([,wks]) => wks.forEach(w => {
          const p = w.details?.phase;
          if (p) phaseCounts[p] = (phaseCounts[p]||0) + 1;
        }));
        const phase      = Object.keys(phaseCounts).sort((a,b)=>phaseCounts[b]-phaseCounts[a])[0] || null;
        const weekNumber = days[0]?.[1]?.[0]?.details?.weekNumber || null;
        const isCurrent  = monday.toLocaleDateString('en-CA') <= today && today <= sunday.toLocaleDateString('en-CA');
        const label      = monday.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + '–' +
                           sunday.toLocaleDateString('en-US',{month:'short',day:'numeric'});
        return { key, monday, days, phase, weekNumber, isCurrent, label };
      });

    return { pastDates: past, weekGroups: wg };
  }, [workouts, today]);

  function handleSave(data) {
    saveWorkout(data);
    setSelectedWorkout(null);
    setShowNewForm(false);
  }

  if (!isLoaded) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-tertiary text-sm">Loading...</p>
    </div>
  );

  const PHASE_COLORS = {
    base:'#2E7D32', foundation:'#2E7D32',
    build:'#1565C0', development:'#1565C0',
    peak:'#6A1B9A', performance:'#6A1B9A',
    taper:'#00838F', deload:'#4527A0',
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="bc-caption uppercase tracking-wider">Training Schedule</h2>
        <button onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-bc-blue text-white text-xs font-semibold rounded-[10px] hover:opacity-90 active:scale-95 transition-all min-h-[44px]">
          + Log Workout
        </button>
      </div>

      {/* ── List / Calendar toggle ── */}
      <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-[12px] w-fit mb-5">
        {['list','calendar'].map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`px-4 py-1.5 rounded-[8px] text-xs font-semibold transition-all capitalize ${viewMode===m ? 'bg-white shadow-sm text-primary' : 'text-tertiary hover:text-secondary'}`}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {viewMode === 'list' && (
        <div>
          {/* Past workouts */}
          {pastDates.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowPast(v => !v)}
                className="flex items-center gap-2 text-xs text-tertiary hover:text-secondary transition-colors mb-3 min-h-[44px]">
                {showPast ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                {showPast ? 'Hide' : 'Show'} past workouts
                <span className="text-[10px]">({pastDates.length} day{pastDates.length!==1?'s':''})</span>
              </button>
              {showPast && (
                <div className="space-y-5 mb-6 pb-6 border-b border-border">
                  {pastDates.map(([date, dw]) => (
                    <DayTimeline key={date} date={date} workouts={dw||[]} onWorkoutClick={setSelectedWorkout}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming — week-grouped with phase header */}
          <div className="space-y-7">
            {weekGroups.length > 0 ? weekGroups.map(wg => (
              <div key={wg.key}>
                {/* Week / phase header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/60">
                  {wg.isCurrent && (
                    <span className="text-xs font-bold text-bc-blue">This Week</span>
                  )}
                  <span className={`text-[11px] ${wg.isCurrent ? 'text-secondary' : 'text-tertiary'}`}>
                    {wg.label}
                  </span>
                  {wg.weekNumber && (
                    <span className="text-[10px] text-tertiary">· Wk {wg.weekNumber}</span>
                  )}
                  {wg.phase && (
                    <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full"
                      style={{ color: PHASE_COLORS[wg.phase]||'#8E8E93', background: (PHASE_COLORS[wg.phase]||'#8E8E93') + '18' }}>
                      {wg.phase.charAt(0).toUpperCase() + wg.phase.slice(1)}
                    </span>
                  )}
                </div>
                <div className="space-y-5">
                  {wg.days.map(([date, dw]) => (
                    <DayTimeline
                      key={date}
                      date={date}
                      workouts={dw||[]}
                      onWorkoutClick={setSelectedWorkout}
                      isToday={date === today}
                    />
                  ))}
                </div>
              </div>
            )) : (
              <div className="bc-card bc-empty">
                <p className="bc-empty-title">No upcoming workouts.</p>
                <p className="bc-empty-text">Generate a plan or log a workout to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <CalendarView workouts={workouts} onWorkoutClick={setSelectedWorkout}/>
      )}

      <WorkoutDetailModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} onSave={handleSave}/>
      {showNewForm && <LogForm workout={null} onSave={handleSave} onClose={() => setShowNewForm(false)}/>}
    </div>
  );
}