'use client';

/**
 * SkipInsightCard
 *
 * Renders a skip impact insight with:
 *  - Severity indicator (critical/high/medium/low)
 *  - Phase completion projection
 *  - Smart rescue suggestion with "Move it" action
 *  - Science toggle
 */

import { useState } from 'react';
import { AlertTriangle, Footprints, Dumbbell, ChevronDown, ChevronUp,
         ArrowRight, X, Calendar } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: '#FF3B30', bg: '#FFEBEE', border: '#FF3B30', label: 'At Risk' },
  high:     { color: '#FF9500', bg: '#FFF3E0', border: '#FF9500', label: 'Behind'  },
  medium:   { color: '#007AFF', bg: '#E3F2FD', border: '#007AFF', label: 'Watch'   },
  low:      { color: '#8E8E93', bg: '#F2F2F7', border: '#C7C7CC', label: 'Noted'   },
};

export default function SkipInsightCard({ insight, onDismiss, onRescue }) {
  const [showScience, setShowScience] = useState(false);

  if (!insight) return null;

  const sev    = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.low;
  const isRun  = insight.skipId && insight.action?.skipWorkout?.type === 'run';
  const TypeIcon = isRun ? Footprints : Dumbbell;
  const typeColor = isRun ? '#2E7D32' : '#1565C0';
  const typeBg    = isRun ? '#E8F5E9' : '#E3F2FD';

  return (
    <div className="bc-card-flush overflow-hidden"
      style={{ borderLeft: `4px solid ${sev.color}` }}>

      {/* Header */}
      <div className="p-4" style={{ background: sev.bg + '60' }}>
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
            style={{ background: typeBg }}>
            <TypeIcon size={16} strokeWidth={2} style={{ color: typeColor }} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Severity + type label */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: sev.color }}>
                {sev.label}
              </span>
              <span className="text-[10px] text-tertiary">·</span>
              <span className="text-[10px] text-tertiary">Skipped session</span>
            </div>

            <p className="text-sm font-semibold text-primary mb-1">{insight.title}</p>
            <p className="text-xs text-secondary leading-relaxed">{insight.description}</p>
          </div>

          {/* Dismiss */}
          <button onClick={() => onDismiss?.(insight.id)}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white/60 flex items-center
                       justify-center text-tertiary hover:text-secondary transition-colors">
            <X size={12} />
          </button>
        </div>

        {/* Phase projection bar */}
        {insight.changes?.after?.label && (
          <div className="mt-3 ml-12 space-y-1">
            {insight.changes.before?.label && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-tertiary w-14">Before:</span>
                <span className="text-[11px] text-secondary">{insight.changes.before.label}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-tertiary w-14">Now:</span>
              <span className="text-[11px] font-semibold" style={{ color: sev.color }}>
                {insight.changes.after.label}
              </span>
            </div>
          </div>
        )}

        {/* Science toggle */}
        {insight.science && (
          <>
            <button onClick={() => setShowScience(v => !v)}
              className="flex items-center gap-1 mt-3 ml-12 text-[10px] text-tertiary
                         hover:text-secondary transition-colors min-h-[28px]">
              {showScience ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {showScience ? 'Hide' : 'Why does this matter?'}
            </button>
            {showScience && (
              <div className="mt-2 ml-12 p-3 bg-white/60 rounded-[10px]">
                <p className="text-[11px] text-secondary leading-relaxed italic">
                  {insight.science}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rescue suggestion */}
      {insight.action?.rescue && (
        <div className="border-t border-border/50 bg-surface">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={12} className="text-tertiary flex-shrink-0" />
              <span className="text-[10px] text-tertiary uppercase tracking-wide font-semibold">
                Suggested rescue slot
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {insight.action.rescue.dayName}
                  <span className="text-secondary font-normal text-xs ml-1.5">
                    {insight.action.rescue.dateLabel}
                  </span>
                </p>
                {insight.action.rescue.isDoubleDip && (
                  <p className="text-[10px] text-tertiary mt-0.5">
                    Adds to existing {insight.action.rescue.existingType} session
                    · still within recovery rules
                  </p>
                )}
                {!insight.action.rescue.isDoubleDip && (
                  <p className="text-[10px] text-tertiary mt-0.5">
                    Open day · no interference conflicts
                  </p>
                )}
              </div>
              <button
                onClick={() => onRescue?.(insight)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                           text-white rounded-[10px] flex-shrink-0 transition-all
                           active:scale-95 hover:opacity-90"
                style={{ background: typeColor }}>
                Move it <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No rescue available */}
      {!insight.action?.rescue && (
        <div className="border-t border-border/50 px-4 py-2.5 bg-surface">
          <p className="text-[10px] text-tertiary">
            No suitable slot found in the next 7 days — consider adjusting your schedule.
          </p>
        </div>
      )}
    </div>
  );
}