'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { estimateCaloriesBurned } from '@/utils/nutrition';

export default function PostWorkoutPrompt({ workout, userWeight = 170, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const burned = estimateCaloriesBurned(workout, userWeight);
  const isRun  = workout.type === 'run';
  const dist   = workout.details?.actualDistance || 0;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div className="bc-card border-l-4 border-bc-orange mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-bc-orange-light flex items-center
                          justify-center flex-shrink-0 text-base">
            🔥
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">
              Great {isRun ? `${dist} mi run` : 'session'}!
            </p>
            <p className="text-xs text-secondary mt-0.5 leading-relaxed">
              You burned approximately{' '}
              <span className="bc-data font-semibold text-bc-orange-dark">{burned} cal</span>.
              Consider a meal with{' '}
              <span className="font-semibold text-primary">30g+ protein</span>{' '}
              within 60 minutes to support recovery.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
                🍗 Chicken + rice
              </span>
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
                🥛 Protein shake
              </span>
              <span className="bc-pill bg-bc-orange-light text-bc-orange-dark text-[10px]">
                🥚 Eggs + toast
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="w-6 h-6 rounded-full bg-canvas flex items-center justify-center
                     text-tertiary hover:text-primary transition-colors flex-shrink-0">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}