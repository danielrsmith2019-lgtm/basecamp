'use client';

/**
 * ActiveWorkoutOverlay
 *
 * Full-screen workout session launched from Plan ("Log It") or Home.
 * Uses LogForm internally — this component is a portal/overlay wrapper
 * that sits above all page content with a persistent minimize bar.
 *
 * Usage:
 *   <ActiveWorkoutOverlay workout={plannedWorkout} onSave={fn} onClose={fn}/>
 *
 * The minimize bar stays visible when minimized so the user can navigate
 * the app mid-workout and return without losing state.
 */

import { useState, useEffect } from 'react';
import LogForm from '@/components/shared/LogForm';
import { ChevronDown, ChevronUp, Timer, Dumbbell, Footprints } from 'lucide-react';
import { useWorkouts } from '@/lib/WorkoutContext';

export default function ActiveWorkoutOverlay({ workout, onSave, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const startRef = useState(() => Date.now())[0];

  // Elapsed timer — survives minimize
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startRef]);

  function fmtElapsed(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  const isLift = workout?.type === 'lift';
  const TypeIcon = isLift ? Dumbbell : Footprints;
  const typeColor = isLift ? '#007AFF' : '#34C759';
  const sessionTitle = workout?.details?.sessionName
    || workout?.details?.runDescription
    || workout?.details?.runType
    || 'Workout';

  if (minimized) {
    // ── Minimized bar — sticks to bottom above nav ──
    return (
      <div
        className="fixed bottom-[80px] left-4 right-4 z-[200] rounded-[16px] border border-border shadow-lg"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)' }}>
        <button
          onClick={() => setMinimized(false)}
          className="w-full flex items-center justify-between px-4 py-3 min-h-[56px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: typeColor + '20' }}>
              <TypeIcon size={16} style={{ color: typeColor }} strokeWidth={2}/>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-primary">{sessionTitle}</p>
              <p className="text-[10px] text-tertiary">In progress · {fmtElapsed(elapsed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1 bg-bc-orange-light rounded-[8px]">
              <Timer size={12} className="text-bc-orange-dark"/>
              <span className="text-[11px] font-bold text-bc-orange-dark" style={{fontVariantNumeric:'tabular-nums'}}>
                {fmtElapsed(elapsed)}
              </span>
            </div>
            <ChevronUp size={16} className="text-tertiary"/>
          </div>
        </button>
      </div>
    );
  }

  // ── Full screen overlay ──
  return (
    <div className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: 'rgba(255,255,255,0.99)', backdropFilter: 'blur(20px)' }}>

      {/* Overlay header */}
      <div className="flex items-center justify-between px-4 pt-safe-top pb-2 border-b border-border"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: typeColor + '20' }}>
            <TypeIcon size={16} style={{ color: typeColor }} strokeWidth={2}/>
          </div>
          <div>
            <p className="text-sm font-bold text-primary">{sessionTitle}</p>
            <div className="flex items-center gap-1">
              <Timer size={10} className="text-tertiary"/>
              <span className="text-[10px] text-tertiary" style={{fontVariantNumeric:'tabular-nums'}}>
                {fmtElapsed(elapsed)}
              </span>
            </div>
          </div>
        </div>
        {/* Minimize button */}
        <button onClick={() => setMinimized(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-canvas border border-border rounded-[8px] text-xs text-secondary hover:text-primary transition-colors min-h-[36px]">
          <ChevronDown size={12}/> Minimize
        </button>
      </div>

      {/* LogForm fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <LogForm
          workout={workout}
          onSave={data => { onSave?.(data); }}
          onClose={onClose}
          embedded  // tells LogForm to not render its own header/close button
        />
      </div>
    </div>
  );
}