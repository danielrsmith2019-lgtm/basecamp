/**
 * BASECAMP — Running Utilities
 * Ported from STRIDE's src/utils/runUtils.js
 * Pure functions — no style dependencies, no imports.
 */


// ═══════════════════════════════════════════════════════
// PACE FORMATTING
// ═══════════════════════════════════════════════════════

/**
 * Converts decimal minutes to M:SS display format.
 * Example: 8.5 → "8:30", 7.833 → "7:50"
 */
export function formatPace(decimalMinutes) {
  if (!decimalMinutes || isNaN(decimalMinutes)) return '--:--';
  const mins = Math.floor(decimalMinutes);
  const secs = Math.round((decimalMinutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parses a pace string (M:SS) into decimal minutes.
 * Example: "8:30" → 8.5, "7:50" → 7.833
 */
export function parsePace(paceString) {
  if (!paceString || typeof paceString !== 'string') return null;
  const parts = paceString.split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins + secs / 60;
}

/**
 * Calculates pace from total time string and distance.
 * Example: ("31:20", 4) → "7:50"
 * 
 * @param {string} timeString - Total time in "MM:SS" or "H:MM:SS" format
 * @param {number} distance - Distance in miles
 * @returns {string} Pace in M:SS format
 */
export function calculatePace(timeString, distance) {
  if (!timeString || !distance || distance === 0) return null;

  let totalMinutes;
  const parts = timeString.split(':').map(Number);

  if (parts.length === 3) {
    // H:MM:SS
    totalMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
  } else if (parts.length === 2) {
    // MM:SS
    totalMinutes = parts[0] + parts[1] / 60;
  } else {
    return null;
  }

  return formatPace(totalMinutes / distance);
}


// ═══════════════════════════════════════════════════════
// PACE COMPARISON
// ═══════════════════════════════════════════════════════

/**
 * Compares actual pace against a target pace range.
 * 
 * @param {string} actualPace - Actual pace: "7:50"
 * @param {string} targetPace - Target range: "7:30-7:50" or single pace "8:30"
 * @returns {{ label: string, color: string }} 
 *   label: "faster" | "on pace" | "slower"
 *   color: Tailwind class for the comparison color
 */
export function comparePaces(actualPace, targetPace) {
  if (!actualPace || !targetPace) return null;

  const actual = parsePace(actualPace);
  if (!actual) return null;

  // Handle pace ranges like "7:30-7:50"
  let targetLow, targetHigh;
  if (targetPace.includes('-')) {
    const [low, high] = targetPace.split('-').map(s => s.trim());
    targetLow = parsePace(low);
    targetHigh = parsePace(high);
  } else {
    targetLow = parsePace(targetPace);
    targetHigh = targetLow;
  }

  if (!targetLow || !targetHigh) return null;

  // Buffer: within 5 seconds of range is "on pace"
  const buffer = 5 / 60; // 5 seconds in decimal minutes

  if (actual < targetLow - buffer) {
    return { label: 'faster', color: 'text-faster' };
  } else if (actual > targetHigh + buffer) {
    return { label: 'slower', color: 'text-slower' };
  } else {
    return { label: 'on pace', color: 'text-onpace' };
  }
}


// ═══════════════════════════════════════════════════════
// DATE FORMATTING
// ═══════════════════════════════════════════════════════

/**
 * Formats an ISO date string to readable display format.
 * Example: "2026-05-13" → "Tue, May 13"
 */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate + 'T00:00:00'); // Force local timezone
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats an ISO date to a shorter format for calendar cells.
 * Example: "2026-05-13" → "13"
 */
export function formatDateShort(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate + 'T00:00:00').getDate().toString();
}

/**
 * Gets the day of week name from an ISO date.
 * Example: "2026-05-13" → "Wednesday"
 */
export function getDayOfWeek(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Returns today's date as an ISO string: "2026-05-06"
 */
export function getToday() {
  return new Date().toLocaleDateString('en-CA');
}


// ═══════════════════════════════════════════════════════
// RUN TYPE HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Maps run types to emoji icons.
 * These are the same emojis STRIDE used in RunCard.
 */
// Emoji icons removed — use RunTypeIcon from '@/utils/icons' instead.
// This stub prevents import errors during migration.
export function getRunTypeEmoji(runType) {
  return null; // Deprecated: use <RunTypeIcon> component
}

/**
 * Maps training phases to Tailwind color classes.
 * These reference the tokens defined in globals.css @theme.
 */
export function getPhaseColors(phase) {
  const map = {
    'Phase 1: Half Marathon': { bg: 'bg-phase-build/20',    text: 'text-phase-build',    border: 'border-phase-build' },
    'Half Marathon Build':    { bg: 'bg-phase-build/20',    text: 'text-phase-build',    border: 'border-phase-build' },
    'Phase 2: Recovery':      { bg: 'bg-phase-recovery/20', text: 'text-phase-recovery', border: 'border-phase-recovery' },
    'Recovery':               { bg: 'bg-phase-recovery/20', text: 'text-phase-recovery', border: 'border-phase-recovery' },
    'Phase 3: Base Building': { bg: 'bg-phase-base/20',    text: 'text-phase-base',     border: 'border-phase-base' },
    'Base Building':          { bg: 'bg-phase-base/20',    text: 'text-phase-base',     border: 'border-phase-base' },
    'Phase 4: Marathon Specific': { bg: 'bg-phase-peak/20', text: 'text-phase-peak',    border: 'border-phase-peak' },
    'Marathon Specific':      { bg: 'bg-phase-peak/20',    text: 'text-phase-peak',     border: 'border-phase-peak' },
    'Phase 5: Peak Training': { bg: 'bg-phase-peak/20',    text: 'text-phase-peak',     border: 'border-phase-peak' },
    'Peak Training':          { bg: 'bg-phase-peak/20',    text: 'text-phase-peak',     border: 'border-phase-peak' },
    'Phase 6: Taper':         { bg: 'bg-phase-taper/20',   text: 'text-phase-taper',    border: 'border-phase-taper' },
    'Taper':                  { bg: 'bg-phase-taper/20',   text: 'text-phase-taper',    border: 'border-phase-taper' },
  };
  return map[phase] || { bg: 'bg-muted/20', text: 'text-muted', border: 'border-muted' };
}

/**
 * Maps workout status to display info.
 */
export function getStatusInfo(status) {
  const map = {
    'completed': { label: 'Done',    emoji: '✓', bg: 'bg-status-done/20',    text: 'text-status-done' },
    'planned':   { label: 'Planned', emoji: '—', bg: 'bg-status-planned/20', text: 'text-status-planned' },
    'skipped':   { label: 'Skipped', emoji: '✗', bg: 'bg-status-skipped/20', text: 'text-status-skipped' },
  };
  return map[status] || map['planned'];
}