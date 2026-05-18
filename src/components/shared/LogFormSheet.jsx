'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * LogFormSheet — full-screen overlay on mobile, inline on desktop.
 * 44px+ touch targets, Save anchored to bottom on mobile.
 */
export default function LogFormSheet({
  isOpen,
  onClose,
  onSave,
  workoutType = 'run',
  children,
}) {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const formContent = (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-0"
        style={{
          minHeight: '56px',
          borderBottom: isMobile
            ? '1px solid rgba(255,255,255,0.06)'
            : 'none',
        }}
      >
        <h2 className="text-lg font-bold text-white">
          Log {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}
        </h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full"
          style={{
            width: '44px',
            height: '44px',
            background: 'rgba(255,255,255,0.06)',
          }}
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Form body */}
      <div className="px-4 sm:px-0 py-4 flex flex-col gap-4">{children}</div>
    </>
  );

  // Mobile: full-screen sheet
  if (isMobile) {
    return (
      <div className="log-form-sheet" role="dialog" aria-modal="true">
        {formContent}

        {/* Anchored save button */}
        <div className="save-btn-anchor">
          <button
            onClick={onSave}
            style={{
              width: '100%',
              minHeight: '52px',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Save Workout
          </button>
        </div>
      </div>
    );
  }

  // Desktop: modal / inline
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {formContent}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.6)',
            border: 'none',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          Save Workout
        </button>
      </div>
    </div>
  );
}

/**
 * FormField — touch-friendly input wrapper
 */
export function FormField({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </span>
      <div className="form-field">{children}</div>
    </label>
  );
}