'use client';

/**
 * RunCard — Displays a single run workout as a styled card.
 * Ported from STRIDE's RunCard.jsx.
 * 
 * This is the CANONICAL card pattern for BASECAMP.
 * LiftCard, CardioCard, etc. should follow this same anatomy:
 *   → Left accent border (colored by phase or activity type)
 *   → Row 1: emoji + type + date
 *   → Row 2: badges (phase + status)
 *   → Row 3: planned data in font-mono
 *   → Row 4: actual data + comparison (if completed)
 */

import {
  formatDate,
  getRunTypeEmoji,
  getPhaseColors,
  getStatusInfo,
  comparePaces,
} from '@/utils/runUtils';

export default function RunCard({ workout, onClick }) {
  const { date, status, details } = workout;
  const {
    runType,
    runDescription,
    phase,
    plannedDistance,
    targetPace,
    actualDistance,
    actualPace,
    actualTime,
    rpe,
    notes,
  } = details;

  const phaseColors = getPhaseColors(phase);
  const statusInfo = getStatusInfo(status);
  const paceComparison = status === 'completed' ? comparePaces(actualPace, targetPace) : null;
  const emoji = getRunTypeEmoji(runType);

  // Rest days get a simpler card
  const isRest = runType === 'REST' || runType === 'Rest' || runType === 'Rest/Lift';

  return (
    <div
      onClick={() => onClick?.(workout)}
      className={`
        stride-card stride-accent-left p-4 cursor-pointer
        ${phaseColors.border}
        ${isRest ? 'opacity-60' : ''}
      `}
    >
      {/* ── Row 1: Emoji + Run Type + Date ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="font-semibold text-primary">{runType}</span>
        </div>
        <span className="text-sm text-secondary">{formatDate(date)}</span>
      </div>

      {/* ── Row 2: Phase Badge + Status Badge ── */}
      <div className="flex items-center gap-2 mb-3">
        {phase && (
          <span className={`stride-badge ${phaseColors.bg} ${phaseColors.text}`}>
            {phase.replace(/Phase \d+: /, '')}
          </span>
        )}
        <span className={`stride-badge ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.emoji} {statusInfo.label}
        </span>
      </div>

      {/* ── Row 3: Planned Stats ── */}
      {!isRest && (
        <div className="flex items-center gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted uppercase tracking-wide">Dist</span>
            <span className="stride-data text-sm text-primary">
              {plannedDistance} mi
            </span>
          </div>
          {targetPace && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted uppercase tracking-wide">Pace</span>
              <span className="stride-data text-sm text-primary">
                {targetPace}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Row 3.5: Run description (if exists) ── */}
      {runDescription && runDescription !== runType && (
        <p className="text-xs text-secondary mt-1 mb-1">{runDescription}</p>
      )}

      {/* ── Row 4: Actual Stats (completed runs only) ── */}
      {status === 'completed' && !isRest && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-4 flex-wrap">
            {actualDistance != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted uppercase tracking-wide">Actual</span>
                <span className="stride-data text-sm text-primary">
                  {actualDistance} mi
                </span>
              </div>
            )}
            {actualPace && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted uppercase tracking-wide">Pace</span>
                <span className="stride-data text-sm text-primary">
                  {actualPace}
                </span>
              </div>
            )}
            {actualTime && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted uppercase tracking-wide">Time</span>
                <span className="stride-data text-sm text-secondary">
                  {actualTime}
                </span>
              </div>
            )}
            {paceComparison && (
              <span className={`stride-badge ${paceComparison.color} bg-transparent text-xs`}>
                {paceComparison.label}
              </span>
            )}
            {rpe != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted uppercase tracking-wide">RPE</span>
                <span className="stride-data text-sm text-primary">{rpe}</span>
              </div>
            )}
          </div>
          {notes && (
            <p className="text-xs text-secondary mt-2 italic">{notes}</p>
          )}
        </div>
      )}

      {/* ── Skipped note ── */}
      {status === 'skipped' && notes && (
        <p className="text-xs text-status-skipped mt-2 italic">{notes}</p>
      )}
    </div>
  );
}