'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Navigation from './Navigation';
import { WorkoutProvider, useWorkouts } from '@/lib/WorkoutContext';
import { Trophy } from 'lucide-react';

const AUTH_ROUTES      = ['/login', '/signup'];
const STANDALONE_ROUTES = ['/running', '/lifting'];

export default function LayoutShell({ children }) {
  return (
    <WorkoutProvider>
      <ShellContent>{children}</ShellContent>
    </WorkoutProvider>
  );
}

function ShellContent({ children }) {
  const pathname = usePathname();
  const { workouts, newPR, clearNewPR } = useWorkouts();

  if (AUTH_ROUTES.includes(pathname)) return <>{children}</>;
  if (STANDALONE_ROUTES.some(r => pathname.startsWith(r))) return <>{children}</>;

  return (
    <>
      <Header workouts={workouts} />
      <Navigation />
      <main className="pt-14 md:pl-56 md:pb-0 bg-canvas"
        style={{
          minHeight: '100dvh',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)',
        }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
          {children}
        </div>
      </main>
      {newPR && <PRCelebration pr={newPR} onClose={clearNewPR} />}
    </>
  );
}

function PRCelebration({ pr, onClose }) {
  return (
    <>
      <ConfettiOverlay />
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[99] animate-fade-in">
        <div className="bc-card border-2 border-bc-green px-6 py-4
                        flex items-center gap-4 min-w-[300px] shadow-xl">
          <div className="w-10 h-10 rounded-[12px] bg-bc-green-light flex items-center justify-center flex-shrink-0">
            <Trophy size={22} className="text-bc-green-dark" strokeWidth={2} />
          </div>
          <div>
            <p className="bc-caption uppercase text-bc-green-dark font-semibold">
              New Personal Record!
            </p>
            <p className="text-sm font-bold text-primary mt-0.5">{pr.label}</p>
            <p className="text-lg font-bold text-primary"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {pr.value}
            </p>
            {pr.previousValue && (
              <p className="text-xs text-secondary mt-0.5">
                Previous: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pr.previousValue}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                       text-secondary hover:text-primary text-lg ml-auto transition-colors">
            ×
          </button>
        </div>
      </div>
      <AutoDismiss onDismiss={onClose} delay={5000} />
    </>
  );
}

function AutoDismiss({ onDismiss, delay }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, delay);
    return () => clearTimeout(timer);
  }, [onDismiss, delay]);
  return null;
}

function ConfettiOverlay() {
  const COLORS = ['#34C759','#007AFF','#AF52DE','#FF9500','#5AC8FA','#FF2D55','#FFCC00'];
  const particles = Array.from({ length: 30 }, (_, i) => {
    const x     = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const color = COLORS[i % COLORS.length];
    const size  = 4 + Math.random() * 6;
    return (
      <div key={i} className="absolute rounded-sm" style={{
        left: `${x}%`, top: '-10px',
        width: `${size}px`, height: `${size * 1.5}px`,
        backgroundColor: color,
        animation: `confetti-drop 2.5s ease-out ${delay}s forwards`,
        transform: `rotate(${Math.random() * 360}deg)`,
        opacity: 0,
      }} />
    );
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles}
      <style jsx>{`
        @keyframes confetti-drop {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
      `}</style>
    </div>
  );
}