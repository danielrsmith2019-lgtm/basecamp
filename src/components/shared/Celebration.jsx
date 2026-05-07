'use client';

/**
 * Celebration — Confetti burst animation for new PRs.
 * Renders 40 particles that burst from center and fade out.
 * Auto-removes itself after the animation completes.
 */

import { useEffect, useState } from 'react';

const PARTICLE_COUNT = 40;
const COLORS = ['#4ADE80', '#60A5FA', '#C084FC', '#FB923C', '#22D3EE', '#F472B6', '#FACC15'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export default function Celebration({ onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const p = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: randomBetween(-200, 200),
      y: randomBetween(-300, -50),
      rotation: randomBetween(0, 360),
      scale: randomBetween(0.5, 1.2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: randomBetween(0, 0.3),
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }));
    setParticles(p);

    const timer = setTimeout(() => {
      onComplete?.();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `confetti-fall 2s ease-out ${p.delay}s forwards`,
            transform: `translate(-50%, -50%)`,
          }}
        >
          <div
            style={{
              width: p.shape === 'circle' ? '8px' : '6px',
              height: p.shape === 'circle' ? '8px' : '10px',
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
              backgroundColor: p.color,
              transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg) scale(${p.scale})`,
              opacity: 0,
              animation: `confetti-particle 2s ease-out ${p.delay}s forwards`,
            }}
          />
        </div>
      ))}

      <style jsx>{`
        @keyframes confetti-particle {
          0% {
            opacity: 1;
            transform: translate(0px, 0px) rotate(0deg) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(${0}px, 400px) rotate(720deg) scale(0.3);
          }
        }
        @keyframes confetti-fall {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * PR announcement banner that slides in from the top.
 */
export function PRAnnouncement({ pr, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[99] animate-fade-in">
      <div className="bg-card border-2 border-phase-base rounded-card shadow-modal
                      px-6 py-4 flex items-center gap-4 min-w-[320px]">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="text-xs text-phase-base uppercase tracking-wider font-semibold">
            New Personal Record!
          </p>
          <p className="text-sm font-bold text-primary mt-0.5">{pr.label}</p>
          <p className="stride-data text-lg text-primary">{pr.value}</p>
          {pr.previousValue && (
            <p className="text-xs text-secondary mt-0.5">
              Previous: <span className="stride-data">{pr.previousValue}</span>
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-muted hover:text-primary ml-auto">×</button>
      </div>
    </div>
  );
}