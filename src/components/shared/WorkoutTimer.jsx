'use client';

/**
 * WorkoutTimer — Wall-clock based timer that survives tab switches.
 *
 * Key change from v1: uses localStorage startTimestamp + Date.now()
 * instead of setInterval counting. The interval only triggers re-renders,
 * not counting — so background throttling doesn't affect accuracy.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Flag, Timer } from 'lucide-react';

const MET = { run: 9.0, lift: 5.0, cardio: 7.0, other: 4.0 };
const TIMER_KEY = 'bc-workout-timer';

export function estimateCalories(elapsedSeconds, workoutType, weightLbs) {
  if (!weightLbs || elapsedSeconds < 10) return 0;
  const met = MET[workoutType] || 5.0;
  const weightKg = weightLbs * 0.453592;
  return Math.round(met * weightKg * (elapsedSeconds / 3600));
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const ACCENT = { run: '#34C759', lift: '#007AFF', cardio: '#FF9500', other: '#AF52DE' };

// ── Persist timer state to localStorage ──
function saveTimerState(state) {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(state)); } catch {}
}
function loadTimerState() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch { return null; }
}
function clearTimerState() {
  try { localStorage.removeItem(TIMER_KEY); } catch {}
}

export default function WorkoutTimer({ workoutType = 'run', userWeight = 170, onStop, compact = false }) {
  const color = ACCENT[workoutType] || '#007AFF';

  // ── Restore state from localStorage on mount ──
  const [status, setStatus] = useState(() => {
    const s = loadTimerState();
    if (s?.status === 'running') return 'running';
    if (s?.status === 'paused') return 'paused';
    return 'idle';
  });

  // elapsed = seconds. For running state, derived from wall clock.
  const [elapsed, setElapsed] = useState(() => {
    const s = loadTimerState();
    if (!s) return 0;
    if (s.status === 'running' && s.startTimestamp) {
      return Math.floor((Date.now() - s.startTimestamp) / 1000) + (s.baseElapsed || 0);
    }
    return s.baseElapsed || 0;
  });

  const [laps, setLaps] = useState(() => loadTimerState()?.laps || []);
  const [lapStart, setLapStart] = useState(0);

  const intervalRef = useRef(null);
  // startTimestamp: wall clock ms when last started
  const startTimestampRef = useRef(() => loadTimerState()?.startTimestamp || null);
  // baseElapsed: accumulated seconds before last start
  const baseElapsedRef = useRef(() => loadTimerState()?.baseElapsed || 0);

  const calories = estimateCalories(elapsed, workoutType, userWeight);

  // ── Tick — recomputes from wall clock ──
  function tick() {
    if (!startTimestampRef.current) return;
    const newElapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000) + baseElapsedRef.current;
    setElapsed(newElapsed);
  }

  // ── Re-sync when tab becomes visible again ──
  useEffect(() => {
    function onVisible() {
      if (status === 'running') tick();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  // ── Interval for live updates ──
  useEffect(() => {
    if (status === 'running') {
      tick(); // immediate sync
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [status]);

  // ── Cleanup on unmount ──
  useEffect(() => () => clearInterval(intervalRef.current), []);

  const startTimer = useCallback(() => {
    const now = Date.now();
    startTimestampRef.current = now;
    setStatus('running');
    saveTimerState({
      status: 'running',
      startTimestamp: now,
      baseElapsed: baseElapsedRef.current,
      laps,
    });
  }, [laps]);

  const pauseTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    const newBase = elapsed;
    baseElapsedRef.current = newBase;
    startTimestampRef.current = null;
    setStatus('paused');
    saveTimerState({ status: 'paused', baseElapsed: newBase, laps });
  }, [elapsed, laps]);

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setStatus('stopped');
    clearTimerState();
  }, []);

  const resetTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    startTimestampRef.current = null;
    baseElapsedRef.current = 0;
    setStatus('idle');
    setElapsed(0);
    setLaps([]);
    setLapStart(0);
    clearTimerState();
  }, []);

  const addLap = useCallback(() => {
    const lapTime = elapsed - lapStart;
    const newLaps = [...laps, { n: laps.length + 1, time: lapTime, total: elapsed }];
    setLaps(newLaps);
    setLapStart(elapsed);
    saveTimerState({
      status: 'running',
      startTimestamp: startTimestampRef.current,
      baseElapsed: baseElapsedRef.current,
      laps: newLaps,
    });
  }, [elapsed, lapStart, laps]);

  useEffect(() => {
    if (status === 'stopped') onStop?.(elapsed, calories);
  }, [status]); // eslint-disable-line

  // ── COMPACT ──
  if (compact) {
    return (
      <div className="bc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'running'
              ? <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: color }} />
              : <Timer size={14} style={{ color }} />}
            <p className="bc-caption uppercase tracking-wider">
              {status === 'running' ? 'Timer running' : status === 'paused' ? 'Paused' : status === 'stopped' ? 'Stopped' : 'Timer'}
            </p>
          </div>
          {status === 'stopped' && elapsed > 0 && (
            <span className="bc-caption text-bc-green-dark">✓ Saved</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center py-2 bg-canvas rounded-[12px]">
            <span className="text-2xl font-bold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsed)}
            </span>
            {calories > 0 && (
              <p className="bc-caption mt-0.5">~<span style={{ color }} className="font-semibold">{calories}</span> cal</p>
            )}
          </div>
          <div className="flex gap-2">
            {status === 'idle' && (
              <button onClick={startTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95" style={{ background: color }}>
                <Play size={16} color="#fff" fill="#fff" />
              </button>
            )}
            {status === 'running' && (
              <>
                <button onClick={pauseTimer} className="w-10 h-10 rounded-full flex items-center justify-center bg-canvas border border-border active:scale-95">
                  <Pause size={16} className="text-primary" />
                </button>
                <button onClick={stopTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95" style={{ background: '#FF3B30' }}>
                  <Square size={14} color="#fff" fill="#fff" />
                </button>
              </>
            )}
            {status === 'paused' && (
              <>
                <button onClick={startTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95" style={{ background: color }}>
                  <Play size={16} color="#fff" fill="#fff" />
                </button>
                <button onClick={stopTimer} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95" style={{ background: '#FF3B30' }}>
                  <Square size={14} color="#fff" fill="#fff" />
                </button>
              </>
            )}
            {status === 'stopped' && (
              <button onClick={resetTimer} className="w-10 h-10 rounded-full flex items-center justify-center bg-canvas border border-border active:scale-95">
                <RotateCcw size={16} className="text-secondary" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FULL SCREEN ──
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={stopTimer} style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Square size={18} color="rgba(255,255,255,0.6)" />
      </button>

      {/* Background tab-sync indicator */}
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <div style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⏱ Syncs across tabs
          </span>
        </div>
      </div>

      <div style={{ padding: '6px 16px', borderRadius: 100, marginBottom: 32, background: `${color}22`, border: `1px solid ${color}44` }}>
        <span style={{ color, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {workoutType} in progress
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontFamily: 'monospace',
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

      {laps.length > 0 && (
        <div style={{ width: '100%', maxWidth: 320, padding: '0 24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Laps</p>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {[...laps].reverse().map(lap => (
              <div key={lap.n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Lap {lap.n}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: 13 }}>{formatTime(lap.time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}