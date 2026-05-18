'use client';

/**
 * WorkoutTimer
 *
 * Two modes:
 *   - Full-screen: launched from LogForm header, dark overlay with big digits
 *   - Compact:     embedded inside LogForm after timer is stopped, shows summary
 *
 * Props:
 *   workoutType      'run' | 'lift' | 'cardio' | 'other'
 *   userWeight       lbs (default 170)
 *   onStop           (elapsedSeconds, calories) => void  — fires when user hits Stop
 *   compact          boolean — compact summary mode
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Flag, Timer } from 'lucide-react';

// MET values — metabolic equivalent of task
const MET = { run: 9.0, lift: 5.0, cardio: 7.0, other: 4.0 };

export function estimateCalories(elapsedSeconds, workoutType, weightLbs) {
  if (!weightLbs || elapsedSeconds < 10) return 0;
  const met = MET[workoutType] || 5.0;
  const weightKg = weightLbs * 0.453592;
  return Math.round(met * weightKg * (elapsedSeconds / 3600));
}

export function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const ACCENT = {
  run:    '#34C759',
  lift:   '#007AFF',
  cardio: '#FF9500',
  other:  '#AF52DE',
};

export default function WorkoutTimer({
  workoutType = 'run',
  userWeight  = 170,
  onStop,
  compact     = false,
}) {
  const [status,   setStatus]   = useState('idle');   // idle | running | paused | stopped
  const [elapsed,  setElapsed]  = useState(0);
  const [laps,     setLaps]     = useState([]);
  const [lapStart, setLapStart] = useState(0);
  const intervalRef = useRef(null);
  const color = ACCENT[workoutType] || '#007AFF';
  const calories = estimateCalories(elapsed, workoutType, userWeight);

  const startTimer = useCallback(() => {
    setStatus('running');
    intervalRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    setStatus('paused');
    clearInterval(intervalRef.current);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setStatus('stopped');
  }, []);

  const resetTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setStatus('idle');
    setElapsed(0);
    setLaps([]);
    setLapStart(0);
  }, []);

  const addLap = useCallback(() => {
    const lapTime = elapsed - lapStart;
    setLaps(p => [...p, { n: p.length + 1, time: lapTime, total: elapsed }]);
    setLapStart(elapsed);
  }, [elapsed, lapStart]);

  // Fire onStop when status transitions to stopped
  useEffect(() => {
    if (status === 'stopped') onStop?.(elapsed, calories);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // ── COMPACT (summary after timer stopped, embedded in LogForm) ──
  if (compact) {
    return (
      <div className="bc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'running'
              ? <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 0 3px ${color}30`, animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <Timer size={14} style={{ color }} />
            }
            <p className="bc-caption uppercase tracking-wider">
              {status === 'running' ? 'Timer running — log freely' : status === 'paused' ? 'Paused' : status === 'stopped' ? 'Timer stopped' : 'Workout Timer'}
            </p>
          </div>
          {status === 'stopped' && elapsed > 0 && (
            <span className="bc-caption text-bc-green-dark">✓ Duration saved</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Time display */}
          <div className="flex-1 text-center py-2 bg-canvas rounded-[12px]">
            <span className="bc-data text-2xl font-bold text-primary tabular-nums">{formatTime(elapsed)}</span>
            {calories > 0 && (
              <p className="bc-caption mt-0.5">~<span style={{ color }} className="font-semibold">{calories}</span> cal</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {status === 'idle' && (
              <button onClick={startTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all" style={{ background: color }}>
                <Play size={16} color="#fff" fill="#fff" />
              </button>
            )}
            {status === 'running' && (
              <>
                <button onClick={pauseTimer} className="w-10 h-10 rounded-full flex items-center justify-center bg-canvas border border-border active:scale-95 transition-all">
                  <Pause size={16} className="text-primary" />
                </button>
                <button onClick={stopTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all" style={{ background: '#FF3B30' }}>
                  <Square size={14} color="#fff" fill="#fff" />
                </button>
              </>
            )}
            {status === 'paused' && (
              <>
                <button onClick={startTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all" style={{ background: color }}>
                  <Play size={16} color="#fff" fill="#fff" />
                </button>
                <button onClick={stopTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all" style={{ background: '#FF3B30' }}>
                  <Square size={14} color="#fff" fill="#fff" />
                </button>
              </>
            )}
            {status === 'stopped' && (
              <div className="flex gap-2">
                <button onClick={resetTimer} className="w-10 h-10 rounded-full flex items-center justify-center bg-canvas border border-border active:scale-95 transition-all" title="Reset timer">
                  <RotateCcw size={16} className="text-secondary" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FULL SCREEN ──
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Close = stop */}
      <button onClick={stopTimer} style={{
        position: 'absolute', top: 20, right: 20,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Square size={18} color="rgba(255,255,255,0.6)" />
      </button>

      {/* Badge */}
      <div style={{ padding: '6px 16px', borderRadius: 100, marginBottom: 32, background: `${color}22`, border: `1px solid ${color}44` }}>
        <span style={{ color, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {workoutType} in progress
        </span>
      </div>

      {/* Big time */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 'clamp(56px, 15vw, 88px)',
          fontWeight: 700,
          color: status === 'running' ? color : 'rgba(255,255,255,0.85)',
          lineHeight: 1, letterSpacing: '-0.02em',
          transition: 'color 0.3s ease',
        }}>
          {formatTime(elapsed)}
        </div>
        {calories > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 12 }}>
            ~<span style={{ color, fontWeight: 600 }}>{calories}</span> cal burned
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 40 }}>
        {status === 'running' && (
          <>
            <button onClick={addLap} style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flag size={20} color="rgba(255,255,255,0.6)" />
            </button>
            <button onClick={pauseTimer} style={{ width: 72, height: 72, borderRadius: '50%', background: color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pause size={28} color="#fff" />
            </button>
            <button onClick={stopTimer} style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Square size={20} color="#FF3B30" fill="#FF3B30" />
            </button>
          </>
        )}
        {(status === 'idle' || status === 'paused') && (
          <>
            <button onClick={resetTimer} style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={20} color="rgba(255,255,255,0.6)" />
            </button>
            <button onClick={startTimer} style={{ width: 72, height: 72, borderRadius: '50%', background: color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={28} color="#fff" fill="#fff" />
            </button>
            <div style={{ width: 56, height: 56 }} />
          </>
        )}
        {status === 'stopped' && (
          <button onClick={resetTimer} style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={20} color="rgba(255,255,255,0.6)" />
          </button>
        )}
      </div>

      {/* Laps */}
      {laps.length > 0 && (
        <div style={{ width: '100%', maxWidth: 320, padding: '0 24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Laps</p>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {[...laps].reverse().map(lap => (
              <div key={lap.n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Lap {lap.n}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{formatTime(lap.time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}