/**
 * skipIntelligence.js
 *
 * Analyses skipped workouts and generates:
 *  1. Phase-level impact score (how much this skip hurts goal completion)
 *  2. Weekly adherence trajectory (are you still on track?)
 *  3. Smart rescue suggestions (which open day to move the session to)
 *
 * Recovery rules (interference effect science):
 *  - Runs can move to: planned run days, off-lifting days, unscheduled days
 *  - Runs CANNOT move to: full rest days, days already at 2+ sessions
 *  - Lifts can move to: planned lift days, off-running days, unscheduled days
 *  - Lifts CANNOT move to: full rest days, leg-heavy days before long runs
 *  - Max sessions per day: 2 (one run + one lift), never 2 runs or 2 lifts
 */

// ── Constants ─────────────────────────────────────────
const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

// How many days ahead to search for a rescue slot
const RESCUE_WINDOW_DAYS = 7;

// Phase impact thresholds
const IMPACT = {
  CRITICAL: 0.20,  // missing ≥20% of phase sessions → critical
  HIGH:     0.12,  // ≥12% → high
  MEDIUM:   0.06,  // ≥6%  → medium
};


// ── Main export ────────────────────────────────────────

/**
 * analyzeSkips(workouts)
 *
 * Returns an array of skip insight objects, one per meaningful skipped session.
 * Each insight includes impact analysis + a rescue suggestion.
 */
export function analyzeSkips(workouts) {
  if (!workouts || workouts.length === 0) return [];

  const today     = new Date().toLocaleDateString('en-CA');
  const skipped   = workouts.filter(w =>
    w.status === 'skipped' &&
    w.date   <= today &&
    w.type   !== 'rest'
  );

  if (skipped.length === 0) return [];

  // Build a lookup of what's already scheduled per date
  const scheduleByDate = buildScheduleMap(workouts);

  // Build phase maps for context
  const phaseMaps = buildPhaseMaps(workouts);

  const insights = [];

  for (const skip of skipped) {
    const impact  = computeImpact(skip, workouts, phaseMaps);
    const rescue  = findRescueSlot(skip, workouts, scheduleByDate, today);
    const insight = buildInsight(skip, impact, rescue);
    if (insight) insights.push(insight);
  }

  // Sort: critical first, then by date descending (most recent skip first)
  insights.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 };
    const sevDiff = (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    return b.skipDate.localeCompare(a.skipDate);
  });

  // Cap at 3 insights so dashboard isn't overwhelmed
  return insights.slice(0, 3);
}


/**
 * computeWeeklySkipRate(workouts)
 *
 * Returns stats used by the dashboard KPI section:
 *   { skipRate, skippedThisWeek, plannedThisWeek, onTrack, phaseRisk }
 */
export function computeWeeklySkipRate(workouts) {
  const now     = new Date();
  const dow     = now.getDay();
  const monday  = new Date(now);
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
  monday.setHours(0,0,0,0);
  const mondayStr = monday.toLocaleDateString('en-CA');
  const todayStr  = now.toLocaleDateString('en-CA');

  const thisWeek = workouts.filter(w =>
    w.date >= mondayStr && w.date <= todayStr && w.type !== 'rest'
  );

  const planned  = thisWeek.filter(w => w.status !== 'skipped').length;
  const skipped  = thisWeek.filter(w => w.status === 'skipped').length;
  const completed = thisWeek.filter(w => w.status === 'completed').length;

  const total      = planned + skipped;
  const skipRate   = total > 0 ? skipped / total : 0;
  const adherence  = total > 0 ? completed / total : 1;

  // Phase risk: project forward — if skip rate holds, will you complete the phase?
  const phaseMaps = buildPhaseMaps(workouts);
  const currentPhase = detectCurrentPhase(workouts, todayStr);
  let phaseRisk = null;

  if (currentPhase && phaseMaps[currentPhase]) {
    const { total: phTotal, completed: phDone, remaining } = phaseMaps[currentPhase];
    const projectedCompletion = phTotal > 0
      ? ((phDone + remaining * adherence) / phTotal) * 100
      : 100;
    phaseRisk = projectedCompletion < 80
      ? { phase: currentPhase, projected: Math.round(projectedCompletion), threshold: 80 }
      : null;
  }

  return {
    skipRate:        Math.round(skipRate * 100),
    skippedThisWeek: skipped,
    plannedThisWeek: total,
    completedThisWeek: completed,
    adherence:       Math.round(adherence * 100),
    onTrack:         skipRate < 0.15,
    phaseRisk,
  };
}


// ── Internal helpers ───────────────────────────────────

function buildScheduleMap(workouts) {
  const map = {};
  workouts.forEach(w => {
    if (!map[w.date]) map[w.date] = [];
    map[w.date].push(w);
  });
  return map;
}

function buildPhaseMaps(workouts) {
  // Returns { [phase]: { total, completed, skipped, remaining } }
  const phases = {};
  workouts.filter(w => w.type !== 'rest').forEach(w => {
    const phase = w.details?.phase;
    if (!phase) return;
    if (!phases[phase]) phases[phase] = { total: 0, completed: 0, skipped: 0, remaining: 0 };
    phases[phase].total++;
    if (w.status === 'completed') phases[phase].completed++;
    else if (w.status === 'skipped') phases[phase].skipped++;
    else phases[phase].remaining++;
  });
  return phases;
}

function detectCurrentPhase(workouts, todayStr) {
  const todayWorkouts = workouts.filter(w => {
    const diff = Math.abs(
      new Date(w.date+'T12:00:00') - new Date(todayStr+'T12:00:00')
    ) / 86400000;
    return diff <= 3; // within 3 days of today
  });
  const counts = {};
  todayWorkouts.forEach(w => {
    const p = w.details?.phase;
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  return Object.keys(counts).sort((a,b) => counts[b]-counts[a])[0] || null;
}

function computeImpact(skip, allWorkouts, phaseMaps) {
  const phase      = skip.details?.phase;
  const phaseData  = phase ? phaseMaps[phase] : null;
  const weekNumber = skip.details?.weekNumber;

  // Phase-level: what % of remaining phase sessions does this skip represent?
  let phaseImpactPct = 0;
  let projectedPhaseCompletion = null;

  if (phaseData && phaseData.total > 0) {
    phaseImpactPct = 1 / phaseData.total;

    // Project: if remaining sessions complete at current rate, what % do we hit?
    const currentAdherence = phaseData.total > 0
      ? phaseData.completed / Math.max(1, phaseData.completed + phaseData.skipped)
      : 1;
    const projected = ((phaseData.completed + phaseData.remaining * currentAdherence) / phaseData.total) * 100;
    projectedPhaseCompletion = Math.round(projected);
  }

  // Weekly: how many sessions skipped vs planned this week?
  const skipDate = skip.date;
  const d = new Date(skipDate + 'T12:00:00');
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const mondayStr = monday.toLocaleDateString('en-CA');
  const sundayStr = sunday.toLocaleDateString('en-CA');

  const weekWorkouts = allWorkouts.filter(w =>
    w.date >= mondayStr && w.date <= sundayStr && w.type !== 'rest'
  );
  const weekSkipped   = weekWorkouts.filter(w => w.status === 'skipped').length;
  const weekTotal     = weekWorkouts.filter(w => w.status !== 'rest').length;
  const weekSkipRate  = weekTotal > 0 ? weekSkipped / weekTotal : 0;

  // Severity
  let severity = 'low';
  if (phaseImpactPct >= IMPACT.CRITICAL || weekSkipRate >= 0.5)       severity = 'critical';
  else if (phaseImpactPct >= IMPACT.HIGH || weekSkipRate >= 0.33)     severity = 'high';
  else if (phaseImpactPct >= IMPACT.MEDIUM || weekSkipRate >= 0.20)   severity = 'medium';

  return {
    severity,
    phase,
    weekNumber,
    phaseImpactPct:          Math.round(phaseImpactPct * 100),
    projectedPhaseCompletion,
    weekSkipRate:            Math.round(weekSkipRate * 100),
    weekSkipped,
    weekTotal,
  };
}

function findRescueSlot(skip, allWorkouts, scheduleByDate, today) {
  const skipType = skip.type; // 'run' or 'lift'

  // Build set of dates that are full-rest
  const fullRestDates = new Set(
    allWorkouts
      .filter(w => w.type === 'rest' && w.details?.restType === 'full_rest')
      .map(w => w.date)
  );

  // Iterate next RESCUE_WINDOW_DAYS looking for a valid slot
  for (let i = 1; i <= RESCUE_WINDOW_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA');

    // Never suggest a full rest day
    if (fullRestDates.has(dateStr)) continue;

    const dayWorkouts = scheduleByDate[dateStr] || [];
    const dayRuns     = dayWorkouts.filter(w => w.type === 'run');
    const dayLifts    = dayWorkouts.filter(w => w.type === 'lift');
    const dayRests    = dayWorkouts.filter(w => w.type === 'rest');
    const isOffRun    = dayRests.some(w => w.details?.restType === 'off_running');
    const isOffLift   = dayRests.some(w => w.details?.restType === 'off_lifting');
    const sessionCount = dayRuns.length + dayLifts.length;

    // Already has 2 sessions — too loaded
    if (sessionCount >= 2) continue;

    // Already has same type — don't double up
    if (skipType === 'run'  && dayRuns.length  > 0) continue;
    if (skipType === 'lift' && dayLifts.length > 0) continue;

    // Runs can't go on off-running rest days (obvious)
    if (skipType === 'run'  && isOffRun)  continue;
    // Lifts can't go on off-lifting rest days
    if (skipType === 'lift' && isOffLift) continue;

    // Don't add a hard lift session the day before a long run
    if (skipType === 'lift') {
      const tomorrow = new Date(d);
      tomorrow.setDate(d.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
      const tomorrowRuns = (scheduleByDate[tomorrowStr] || [])
        .filter(w => w.type === 'run' && w.details?.runType === 'long_run');
      if (tomorrowRuns.length > 0) continue;
    }

    // Valid slot found
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existingSession = dayWorkouts.find(w => w.type === 'run' || w.type === 'lift');

    return {
      date:        dateStr,
      dayName,
      dateLabel,
      label:       `${dayName}, ${dateLabel}`,
      isDoubleDip: !!existingSession, // true if adding to an existing session day
      existingType: existingSession?.type || null,
      daysFromNow: i,
    };
  }

  return null; // no valid slot found in window
}

function buildInsight(skip, impact, rescue) {
  const { severity, phase, weekNumber, phaseImpactPct,
          projectedPhaseCompletion, weekSkipRate, weekSkipped, weekTotal } = impact;

  const typeLabel = skip.type === 'run' ? 'run' : 'lift session';
  const typeCap   = skip.type === 'run' ? 'Run'  : 'Lift session';
  const skipDate  = new Date(skip.date + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const sessionName = skip.type === 'run'
    ? (skip.details?.runDescription || skip.details?.runType || 'Run')
    : (skip.details?.sessionName || 'Lift session');

  // Build title
  let title = '';
  if (severity === 'critical') title = `Skipped ${typeLabel} putting ${phase || 'plan'} at risk`;
  else if (severity === 'high') title = `${weekSkipped} skipped this week — ${phase || 'phase'} tracking low`;
  else title = `Skipped: ${sessionName}`;

  // Build description
  let description = `You skipped your ${skipDate} ${typeLabel}`;
  if (sessionName && sessionName !== 'Run') description += ` (${sessionName})`;
  description += '.';

  if (phase && phaseImpactPct > 0) {
    description += ` This session was ${phaseImpactPct}% of your ${phase} phase.`;
  }

  if (projectedPhaseCompletion !== null && projectedPhaseCompletion < 90) {
    description += ` At your current pace, you're projected to complete ${projectedPhaseCompletion}% of the ${phase} phase.`;
  }

  if (weekSkipRate >= 20) {
    description += ` You've skipped ${weekSkipRate}% of sessions this week.`;
  }

  // Science
  let science = null;
  if (skip.type === 'run') {
    science = 'Missing runs compounds in endurance training. Each skipped aerobic session reduces the adaptive stimulus for that week\'s target. For marathon prep, consistent weekly volume is more important than any single session.';
  } else {
    science = 'Resistance training adaptations require consistent stimulus. A missed session delays progressive overload by a full microcycle. If you can make it up within 48-72 hours on an appropriate day, most adaptation is preserved.';
  }

  // Rescue action
  let action = null;
  if (rescue) {
    action = {
      label:  rescue.isDoubleDip
        ? `Add to ${rescue.dayName} (${rescue.dateLabel})`
        : `Move to ${rescue.dayName} (${rescue.dateLabel})`,
      rescue,
      skipId: skip.id,
      skipWorkout: skip,
    };
  }

  return {
    id:        `skip-${skip.id}`,
    type:      'skip_impact',
    severity,
    skipDate:  skip.date,
    skipId:    skip.id,
    title,
    description,
    science,
    action,
    // for the "changes" display in PlanAdaptationCard
    changes: projectedPhaseCompletion !== null ? {
      before: { label: `Current: ${Math.round((impact.phaseData?.completed || 0) / Math.max(1, impact.phaseData?.total || 1) * 100)}% phase complete` },
      after:  { label: projectedPhaseCompletion < 80
        ? `Projected: ${projectedPhaseCompletion}% — below 80% target`
        : `Projected: ${projectedPhaseCompletion}% — on track` },
    } : null,
  };
}