// ══════════════════════════════════════════════════════════
// ENFORCE DAY ASSIGNMENTS SERVER-SIDE
// Even if Claude drifts, this corrects the output to match
// what the user explicitly selected in the wizard.
// ══════════════════════════════════════════════════════════

function enforceDayAssignments(plan, input) {
  const assignments = input.dayAssignments || {};
  const fullRestDays = new Set(input.fullRestDays || []);
  if (Object.keys(assignments).length === 0) return plan; // nothing to enforce

  const processWeek = (week) => {
    const runs     = week.runs     || [];
    const lifts    = week.lifts    || [];
    const restDays = week.restDays || [];

    // Build maps of what's currently assigned per day
    const runDays  = new Set(runs.map(r => r.dayOfWeek));
    const liftDays = new Set(lifts.map(l => l.dayOfWeek));

    let newRuns  = [...runs];
    let newLifts = [...lifts];

    for (const [day, type] of Object.entries(assignments)) {
      if (fullRestDays.has(day)) continue; // never override full rest

      if (type === 'run') {
        // Remove any lifts on this day
        newLifts = newLifts.filter(l => l.dayOfWeek !== day);
        // Make sure there's a run here (if runs exist in the week)
        // Don't force add — just don't remove
      }
      if (type === 'lift') {
        // Remove any runs on this day
        newRuns = newRuns.filter(r => r.dayOfWeek !== day);
        // Don't remove lifts
      }
      if (type === 'both') {
        // Must have both — don't remove either
        // If missing one, we can't add it without details, so just leave as-is
        // The prompt enforcement should handle this
      }
    }

    // Also enforce: runs must not appear on lift-only days, lifts must not appear on run-only days
    // (catches any days not in assignments but where Claude put wrong type)
    // Only enforce for days that HAVE explicit assignments
    return {
      ...week,
      runs:     newRuns,
      lifts:    newLifts,
      restDays: week.restDays,
    };
  };

  // Apply to direct weeks
  if (plan.weeks) {
    plan.weeks = plan.weeks.map(processWeek);
  }
  // Apply to phase templates
  if (plan.phase_templates) {
    plan.phase_templates = plan.phase_templates.map(pt => ({
      ...pt,
      template_week: processWeek(pt.template_week || {}),
    }));
  }

  return plan;
}


// ══════════════════════════════════════════════════════════
// SCHEDULE CONFLICT ANALYSIS
// Checks the enforced schedule for interference issues and
// appends specific, actionable insights the user can act on.
// These appear in "Why your plan is built this way" on the
// plan page — the user decides whether to adjust.
// ══════════════════════════════════════════════════════════

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function getDayIndex(day) { return DAY_ORDER.indexOf(day); }

function getDayAfter(day) {
  return DAY_ORDER[(getDayIndex(day) + 1) % 7];
}

function analyzeScheduleConflicts(plan, input) {
  const assignments  = input.dayAssignments || {};
  const longRunDay   = input.longRunDay || 'saturday';
  const planType     = input.planType || 'hybrid';
  const suggestions  = [];

  if (planType === 'running' || Object.keys(assignments).length === 0) return suggestions;

  // Get the actual week structure (first non-deload week)
  const sampleWeek = plan.weeks?.find(w => w.phase !== 'deload' && w.phase !== 'taper') ||
                     plan.phase_templates?.[0]?.template_week ||
                     plan.weeks?.[0];

  if (!sampleWeek) return suggestions;

  const liftDays = (sampleWeek.lifts || []).map(l => l.dayOfWeek);
  const runDays  = (sampleWeek.runs  || []).map(r => r.dayOfWeek);

  // ── Check 1: Lower body lift the day before a hard run or long run ──
  const LEG_SESSIONS = ['Lower Body', 'Legs', 'Lower', 'Squat', 'Deadlift'];

  for (const lift of (sampleWeek.lifts || [])) {
    const isLegSession = LEG_SESSIONS.some(k =>
      (lift.sessionName || '').toLowerCase().includes(k.toLowerCase()) ||
      (lift.muscleGroups || []).some(g =>
        ['quads','hamstrings','glutes','calves','legs'].includes(g.toLowerCase())
      )
    );
    if (!isLegSession) continue;

    const dayAfter = getDayAfter(lift.dayOfWeek);
    const runAfter = (sampleWeek.runs || []).find(r => r.dayOfWeek === dayAfter);

    if (runAfter) {
      const isHardRun = ['tempo','interval','long_run'].includes(runAfter.runType);
      const isLongRun = runAfter.dayOfWeek === longRunDay || runAfter.runType === 'long_run';

      if (isLongRun) {
        suggestions.push({
          category: 'scheduling',
          severity: 'warning',
          title: `⚠ Lower body lift before long run (${cap(lift.dayOfWeek)} → ${cap(dayAfter)})`,
          explanation: `You've placed your ${lift.sessionName || 'lower body'} session on ${cap(lift.dayOfWeek)}, the day before your long run on ${cap(dayAfter)}. Research (Hickson 1980, Murlasits 2018) shows heavy lower-body compounds like squats and deadlifts create 24-48h of muscular fatigue that directly degrades long run quality. **Suggested fix:** Move ${cap(lift.dayOfWeek)} to an upper body session (push or pull), or swap the lower body lift to the day after your long run instead.`,
          actionable: true,
          action: `Move lower body lift to ${cap(getDayAfter(dayAfter))} or make ${cap(lift.dayOfWeek)} upper body only`,
        });
      } else if (isHardRun) {
        suggestions.push({
          category: 'interference',
          severity: 'suggestion',
          title: `Consider rearranging ${cap(lift.dayOfWeek)} lift before ${runAfter.runType} run`,
          explanation: `Your ${lift.sessionName || 'lower body'} lift on ${cap(lift.dayOfWeek)} precedes a ${runAfter.runType} run on ${cap(dayAfter)}. For easy runs this is fine, but hard runs need fresh legs. **Suggested fix:** Swap the order — run first on ${cap(dayAfter)}, or make the lift an upper body session if you keep the current day order.`,
          actionable: true,
          action: `Swap order or make ${cap(lift.dayOfWeek)} lift upper body only`,
        });
      }
    }
  }

  // ── Check 2: Both run and lift on same day — check ordering recommendation ──
  const bothDays = Object.entries(assignments)
    .filter(([_, t]) => t === 'both')
    .map(([d]) => d);

  for (const day of bothDays) {
    suggestions.push({
      category: 'scheduling',
      severity: 'info',
      title: `Double session on ${cap(day)} — run first recommended`,
      explanation: `You've scheduled both a run and lift on ${cap(day)}. Research (Murlasits 2018) consistently shows running before lifting preserves run quality better than the reverse — lifting pre-exhausts the legs and raises cortisol, which impairs endurance. If time allows, separate the sessions by 4-6 hours. If back-to-back, always run first.`,
      actionable: false,
      action: null,
    });
  }

  // ── Check 3: No rest day between two hard days ──
  const hardDays = [longRunDay, ...Object.entries(assignments)
    .filter(([_, t]) => t === 'both').map(([d]) => d)];

  for (let i = 0; i < hardDays.length; i++) {
    for (let j = i + 1; j < hardDays.length; j++) {
      const diff = Math.abs(getDayIndex(hardDays[i]) - getDayIndex(hardDays[j]));
      if (diff === 1 || diff === 6) { // adjacent days
        suggestions.push({
          category: 'recovery',
          severity: 'suggestion',
          title: `Back-to-back hard days (${cap(hardDays[i])} + ${cap(hardDays[j])})`,
          explanation: `Your long run on ${cap(longRunDay)} and double session on ${cap(hardDays[j])} are on consecutive days. This stacks fatigue and raises injury risk. **Suggested fix:** Place an easy run or full rest day between them, or move one of the sessions earlier in the week.`,
          actionable: true,
          action: `Add recovery day between ${cap(hardDays[i])} and ${cap(hardDays[j])}`,
        });
      }
    }
  }

  // ── Check 4: Too few rest days for training load ──
  const restDayCount = (input.fullRestDays || []).length +
    Object.values(assignments).filter(t => t === 'run' || t === 'lift').length === 0 ? 1 : 0;
  const trainingDays = (input.availableDays || []).length;

  if (trainingDays >= 6 && (input.fullRestDays || []).length < 2) {
    suggestions.push({
      category: 'recovery',
      severity: 'suggestion',
      title: 'Consider a second rest day for your training load',
      explanation: `You're training ${trainingDays} days per week. With only ${(input.fullRestDays || []).length} full rest day, connective tissue recovery may lag behind muscular recovery — tendons and ligaments adapt 2-3x slower than muscles (Magnusson & Kjaer 2003). A second rest or active recovery day, especially mid-week, would reduce overuse injury risk without meaningfully impacting fitness gains.`,
      actionable: true,
      action: 'Add a mid-week active recovery or full rest day',
    });
  }

  return suggestions;
}

function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// app/api/generate-plan/route.js
//
// Generates science-based training plans via Claude API.
// Supports hybrid, running-only, and lifting-only plans.
// Driven by specific user goals from the upgraded PlanWizard.

export async function POST(request) {
  try {
    const input = await request.json();

    const planType = input.planType || 'hybrid';

    // Validation varies by plan type
    if (planType !== 'lifting') {
      if (!input.availableDays || input.availableDays.length < 2) {
        return Response.json({ error: 'At least 2 training days required.' }, { status: 400 });
      }
    }
    if (!input.fullRestDays || input.fullRestDays.length < 1) {
      return Response.json({ error: 'At least 1 full rest day required.' }, { status: 400 });
    }

    // ── Compute total weeks ──
    let totalWeeks = input.planDuration || 12;
    if ((input.runningGoal === 'race') && input.raceDate) {
      const now = new Date();
      const race = new Date(input.raceDate);
      const diffWeeks = Math.ceil((race - now) / (7 * 24 * 60 * 60 * 1000));
      totalWeeks = Math.max(4, Math.min(diffWeeks, 24));
    }
    // Legacy support: old wizard used raceType + raceDate
    if (input.raceType && input.raceType !== 'none' && input.raceDate && !input.runningGoal) {
      const now = new Date();
      const race = new Date(input.raceDate);
      const diffWeeks = Math.ceil((race - now) / (7 * 24 * 60 * 60 * 1000));
      totalWeeks = Math.max(4, Math.min(diffWeeks, 24));
    }

    const runsPerWeek  = planType === 'lifting' ? 0 : (input.runsPerWeek  || 3);
    const liftsPerWeek = planType === 'running' ? 0 : (input.liftsPerWeek || 3);

    // ── Lifting scheme based on goal ──
    const liftingScheme = {
      strength:     '3-5 reps, 4-5 sets, 2-3 min rest, RPE 8-9. Focus: progressive overload on compound movements',
      hypertrophy:  '8-12 reps, 3-4 sets, 60-90s rest, RPE 7-8. Focus: muscle tension and metabolic stress',
      powerlifting: '1-5 reps, 4-6 sets, 3-5 min rest, RPE 8-10. Focus: squat/bench/deadlift specificity',
      athletic:     '4-8 reps, 3-4 sets, 90s rest, RPE 7-8. Focus: power, explosiveness, functional patterns',
      maintenance:  '6-8 reps, 3 sets, 90s rest, RPE 6-7. Minimal interference with running volume',
    }[input.liftingGoal] || '8-12 reps, 3-4 sets, RPE 7-8';

    // ── Compute peak mileage ──
    const currentMileage = Number(input.weeklyMileage) || 0;
    const raceDistance = input.raceDistance || input.raceType || 'none';
    const runningGoal = input.runningGoal || (input.raceType !== 'none' ? 'race' : 'general_fitness');

    const peakMileage = (() => {
      if (planType === 'lifting') return 0;
      if (runningGoal === 'race') {
        return {
          marathon:      Math.max(currentMileage * 2.5, 40),
          half_marathon: Math.max(currentMileage * 2,   30),
          '5k':          Math.max(currentMileage * 1.5, 20),
          '10k':         Math.max(currentMileage * 1.75, 25),
          ultra:         Math.max(currentMileage * 3,   55),
        }[raceDistance] || Math.max(currentMileage * 1.5, 20);
      }
      if (runningGoal === 'base_building') {
        return Number(input.targetWeeklyMileage) || Math.max(currentMileage * 2, 30);
      }
      if (runningGoal === 'speed') return Math.max(currentMileage * 1.3, 25);
      if (runningGoal === 'weight_loss') return Math.max(currentMileage * 1.5, 25);
      return Math.max(currentMileage * 1.5, 20);
    })();

    const planStyle = input.planStyle || 'mileage';

    const systemPrompt = buildSystemPrompt(input, totalWeeks, runsPerWeek, liftsPerWeek, liftingScheme, peakMileage, planStyle, planType, runningGoal);

    if (totalWeeks <= 8) {
      return await generateDirectPlan(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek, planType);
    } else {
      return await generateFromTemplates(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek, planType);
    }

  } catch (err) {
    console.error('Plan generation error:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}


// ══════════════════════════════════════════════════════════
// GENERATION FUNCTIONS
// ══════════════════════════════════════════════════════════

async function generateDirectPlan(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek, planType) {
  const runLine  = runsPerWeek  > 0 ? `exactly ${runsPerWeek} runs,`  : 'NO runs (lifting-only plan),';
  const liftLine = liftsPerWeek > 0 ? `exactly ${liftsPerWeek} lifts` : 'NO lifts (running-only plan)';

  const userMessage = `Generate a ${totalWeeks}-week ${planType} training plan. Return ONLY valid JSON.

{
  "name": "plan name",
  "description": "1-2 sentence summary",
  "plan_type": "${planType}",
  "total_weeks": ${totalWeeks},
  "plan_insights": [
    { "category": "scheduling", "title": "...", "explanation": "..." },
    { "category": "interference", "title": "...", "explanation": "..." },
    { "category": "periodization", "title": "...", "explanation": "..." },
    { "category": "recovery", "title": "...", "explanation": "..." },
    { "category": "progression", "title": "...", "explanation": "..." }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "base",
      "totalMileage": 15,
      "runs": [
        { "dayOfWeek": "tuesday", "runType": "easy", "distance": 4, "targetPace": "9:00-9:30", "duration": 40, "notes": "Easy effort, conversational" }
      ],
      "lifts": [
        {
          "dayOfWeek": "monday",
          "sessionName": "Upper Push",
          "muscleGroups": ["chest", "shoulders", "triceps"],
          "duration": 50,
          "exercises": [
            { "name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "notes": "" }
          ]
        }
      ],
      "restDays": [
        { "dayOfWeek": "sunday", "restType": "full_rest" }
      ]
    }
  ]
}

Each week: ${runLine} ${liftLine}. Every day of the week must appear exactly once across runs, lifts, restDays.
Generate 5-7 plan_insights specific to this user. Be concrete, reference the science.`;

  const plan = await callClaude(systemPrompt, userMessage);
  if (!plan) return Response.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });

  plan.generated_at = new Date().toISOString();
  plan.input = input;
  // Enforce user's day assignments — override any Claude violations
  enforceDayAssignments(plan, input);
  // Append schedule conflict suggestions to plan_insights
  const conflicts = analyzeScheduleConflicts(plan, input);
  if (conflicts.length > 0) {
    plan.plan_insights = [...(plan.plan_insights || []), ...conflicts];
    plan.schedule_suggestions = conflicts; // also expose separately for the UI
  }
  return Response.json(plan);
}


async function generateFromTemplates(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek, planType) {
  const phases = buildPhases(input.runningGoal || input.raceType || 'none', input.liftingGoal, totalWeeks, planType);
  const runLine  = runsPerWeek  > 0 ? `exactly ${runsPerWeek} runs,`  : 'NO runs,';
  const liftLine = liftsPerWeek > 0 ? `exactly ${liftsPerWeek} lifts` : 'NO lifts';

  const userMessage = `Generate a ${totalWeeks}-week ${planType} training plan using PHASE TEMPLATES.

Phases:
${phases.map(p => `- ${p.name}: weeks ${p.startWeek}-${p.endWeek} (${p.endWeek - p.startWeek + 1} weeks)`).join('\n')}

Return ONLY valid JSON:
{
  "name": "plan name",
  "description": "1-2 sentence summary",
  "plan_type": "${planType}",
  "total_weeks": ${totalWeeks},
  "plan_insights": [
    { "category": "scheduling",    "title": "...", "explanation": "..." },
    { "category": "interference",  "title": "...", "explanation": "..." },
    { "category": "periodization", "title": "Your ${phases.length}-phase structure", "explanation": "..." },
    { "category": "recovery",      "title": "...", "explanation": "..." },
    { "category": "progression",   "title": "How volume builds across ${totalWeeks} weeks", "explanation": "..." },
    { "category": "deload",        "title": "...", "explanation": "..." }
  ],
  "phase_templates": [
    {
      "phase": "${phases[0].name}",
      "startWeek": ${phases[0].startWeek},
      "endWeek": ${phases[0].endWeek},
      "template_week": {
        "totalMileage": 15,
        "runs": [ { "dayOfWeek": "tuesday", "runType": "easy", "distance": 4, "targetPace": "9:00-9:30", "duration": 40, "notes": "" } ],
        "lifts": [ { "dayOfWeek": "monday", "sessionName": "Upper Push", "muscleGroups": ["chest"], "duration": 50, "exercises": [ { "name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "notes": "" } ] } ],
        "restDays": [ { "dayOfWeek": "sunday", "restType": "full_rest" } ]
      },
      "progression": {
        "mileage_increase_per_week": 1.5,
        "long_run_increase_per_week": 1,
        "lifting_note": "Add 5 lbs to compounds weekly"
      }
    }
  ]
}

Each template: ${runLine} ${liftLine}. Every day of the week must appear exactly once.
Generate 5-7 plan_insights specific to this user. Reference exercise science.`;

  const templateData = await callClaude(systemPrompt, userMessage);
  if (!templateData || !templateData.phase_templates) {
    return Response.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });
  }

  const expandedWeeks = expandTemplates(templateData.phase_templates, totalWeeks);

  const expandedPlan = {
    name: templateData.name || 'Training Plan',
    description: templateData.description || '',
    plan_type: planType,
    total_weeks: totalWeeks,
    plan_insights: templateData.plan_insights || [],
    weeks: expandedWeeks,
    generated_at: new Date().toISOString(),
    input,
  };

  // Enforce user's day assignments — override any Claude violations
  enforceDayAssignments(expandedPlan, input);
  // Append schedule conflict suggestions to plan_insights
  const conflicts = analyzeScheduleConflicts(expandedPlan, input);
  if (conflicts.length > 0) {
    expandedPlan.plan_insights = [...(expandedPlan.plan_insights || []), ...conflicts];
    expandedPlan.schedule_suggestions = conflicts;
  }
  return Response.json(expandedPlan);
}


// ══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════

function buildSystemPrompt(input, totalWeeks, runsPerWeek, liftsPerWeek, liftingScheme, peakMileage, planStyle, planType, runningGoal) {
  const longRunDay   = input.longRunDay  || 'saturday';
  const fullRestDays = input.fullRestDays || ['sunday'];
  const dayBefore    = getDayBefore(longRunDay);
  const currentMileage = Number(input.weeklyMileage) || 0;
  const isMileageBased = planStyle === 'mileage';
  const raceDistance = input.raceDistance || input.raceType || 'none';

  // ── Goal-specific context ──
  const goalContext = (() => {
    if (planType === 'running') {
      const goalMap = {
        race:            `RACE PREP — ${raceDistance.replace('_', ' ')}${input.targetTime ? `, targeting ${input.targetTime}` : ''}${input.raceDate ? `, on ${input.raceDate}` : ''}`,
        base_building:   `BASE BUILDING — safely build from ${currentMileage} to ${input.targetWeeklyMileage || peakMileage} mi/week`,
        speed:           `SPEED & PERFORMANCE — develop VO2max, lactate threshold, running economy`,
        general_fitness: `GENERAL FITNESS — build sustainable running habit and aerobic base`,
        weight_loss:     `WEIGHT LOSS — maximize calorie burn and fat adaptation via aerobic work`,
      };
      return goalMap[runningGoal] || goalMap.general_fitness;
    }
    if (planType === 'lifting') {
      const liftGoalMap = {
        strength:     `STRENGTH — maximize force production, heavy compound movements, low reps`,
        hypertrophy:  `HYPERTROPHY — maximize muscle growth${input.liftingFocus?.length ? `, focus on: ${input.liftingFocus.join(', ')}` : ''}`,
        powerlifting: `POWERLIFTING — maximize squat${input.targetSquat ? ` (target: ${input.targetSquat} lbs)` : ''}, bench${input.targetBench ? ` (target: ${input.targetBench} lbs)` : ''}, deadlift${input.targetDeadlift ? ` (target: ${input.targetDeadlift} lbs)` : ''}`,
        athletic:     `ATHLETIC PERFORMANCE — power, speed, functional strength`,
        maintenance:  `MAINTENANCE — preserve muscle and strength with minimal volume`,
      };
      return liftGoalMap[input.liftingGoal] || liftGoalMap.hypertrophy;
    }
    // Hybrid
    return [
      `RUNNING: ${(() => {
        const m = { race: `race prep (${raceDistance})`, base_building: 'base building', speed: 'speed', general_fitness: 'general fitness', weight_loss: 'weight loss' };
        return m[runningGoal] || 'general fitness';
      })()}`,
      `LIFTING: ${input.liftingGoal || 'hypertrophy'}`,
    ].join(' + ');
  })();

  // ── Current fitness context ──
  const fitnessContext = [
    planType !== 'lifting' && `Running: ${currentMileage} mi/week${input.longestRecentRun ? `, longest recent run ${input.longestRecentRun} mi` : ''}${input.recentRaceTime ? `, recent race: ${input.recentRaceTime}` : ''}`,
    planType !== 'running' && `Lifting: ${input.liftingExperience || 'intermediate'}${input.currentBenchMax ? `, bench 1RM ${input.currentBenchMax} lbs` : ''}${input.currentSquatMax ? `, squat 1RM ${input.currentSquatMax} lbs` : ''}${input.currentDeadliftMax ? `, deadlift 1RM ${input.currentDeadliftMax} lbs` : ''}`,
  ].filter(Boolean).join('\n- ');

  // ── Mileage section (only for running/hybrid) ──
  const mileageSection = planType !== 'lifting' ? `
MILEAGE PROGRESSION — CRITICAL:
- Start: ${currentMileage} mi/week → Peak: ${peakMileage} mi/week
- Week 1 begins at ${currentMileage} mi. Peak week reaches ${peakMileage} mi.
- Average increase: ~${((peakMileage - currentMileage) / (totalWeeks * 0.7)).toFixed(1)} mi/week during build phases.
- Long run: starts at ${Math.max(Math.round(currentMileage * 0.3), 4)} mi → peaks at ${Math.round(peakMileage * 0.35)} mi.
${raceDistance === 'marathon'      ? '- Longest long run: 20-22 miles, 2-3 weeks before race day.' : ''}
${raceDistance === 'half_marathon' ? '- Longest long run: 12-14 miles, 2-3 weeks before race day.' : ''}
${raceDistance === '10k'           ? '- Include one race-pace workout per week in build/peak phases.' : ''}
${raceDistance === '5k'            ? '- Heavy VO2max and interval work. Shorter long runs (8-10 mi max).' : ''}
${runningGoal === 'speed'          ? '- Increase intensity work: 2x threshold or interval sessions per week in peak phase.' : ''}
${runningGoal === 'base_building'  ? '- 90%+ of runs at easy/aerobic pace. Build aerobic base before adding intensity.' : ''}
${input.raceDate ? `RACE DAY: ${input.raceDate} — The final week of the plan is race week. The last day of the plan should include a "race" type run on ${input.raceDate}. Taper appropriately in the 2-3 weeks before race day.` : ''}
` : '';

  // ── Running-specific workout types ──
  const runTypes = (() => {
    if (planType === 'lifting') return '';
    const types = {
      race: `
RUN TYPES for race prep:
- easy: 70-75% max HR, conversational, RPE 3-4. Use for all base runs.
- long_run: 65-70% max HR, easy effort. The backbone of endurance development.
- tempo: Lactate threshold pace (~1hr race effort). 20-40 min continuous or cruise intervals.
- interval: VO2max work. 3-5 min repeats at ~5K pace. Full recovery between reps.
- recovery: 60-65% max HR, very easy. Day after hard workout only.`,
      speed: `
RUN TYPES for speed development:
- interval: Primary weapon. 200m-1600m repeats at 5K-10K pace, full recovery.
- tempo: Threshold work 2x/week. 20-40 min at comfortably hard effort.
- easy: Majority of runs. Builds aerobic base that supports speed work.
- long_run: Weekly long run at easy pace. Builds durability.`,
      base_building: `
RUN TYPES for base building:
- easy: 80-90% of all mileage. Conversational pace. No gray zone.
- long_run: Weekly long run at easy pace. Increase 1-2 miles per week.
- strides: 4-6x 20-second accelerations after easy runs. Maintain neuromuscular sharpness.`,
      general_fitness: `
RUN TYPES for general fitness:
- easy: Most runs. Build the habit and aerobic base.
- long_run: One per week, builds endurance.
- tempo: 1x per week in later phases. 20-30 min at comfortably hard effort.`,
    };
    return types[runningGoal] || types.general_fitness;
  })();

  // ── Lifting-specific section ──
  const liftingSection = planType !== 'running' ? `
LIFTING SCHEME (${input.liftingGoal}): ${liftingScheme}
${input.currentBenchMax  ? `Current bench 1RM: ${input.currentBenchMax} lbs → use 70-85% for working sets` : ''}
${input.currentSquatMax  ? `Current squat 1RM: ${input.currentSquatMax} lbs → use 70-85% for working sets` : ''}
${input.currentDeadliftMax ? `Current deadlift 1RM: ${input.currentDeadliftMax} lbs → use 70-80% for working sets` : ''}
${input.targetBench    ? `Bench target: ${input.targetBench} lbs — structure progressions to hit this` : ''}
${input.targetSquat    ? `Squat target: ${input.targetSquat} lbs — structure progressions to hit this` : ''}
${input.targetDeadlift ? `Deadlift target: ${input.targetDeadlift} lbs — structure progressions to hit this` : ''}
${input.liftingFocus?.length ? `Muscle focus areas: ${input.liftingFocus.join(', ')} — prioritize these in exercise selection` : ''}

LIFTING SPLIT: ${input.liftingSplit || 'interference_safe'} — build sessions around this structure:
${input.liftingSplit === 'interference_safe' ? 'Upper Push / Upper Pull / Lower Body — designed for hybrid athletes to minimize interference with running.' : ''}
${input.liftingSplit === 'ppl' ? 'Push (chest/shoulders/triceps) / Pull (back/biceps) / Legs (quads/hamstrings/glutes)' : ''}
${input.liftingSplit === 'upper_lower' ? 'Upper A / Lower A / Upper B / Lower B — alternate upper and lower body' : ''}
${input.liftingSplit === 'full_body' ? 'Full Body A / Full Body B / Full Body C — all major muscle groups each session' : ''}
${input.liftingSplit === 'bro_split' ? 'Chest / Back / Legs / Shoulders / Arms — one muscle group per session' : ''}
${input.liftingSplit === 'strength_focused' ? 'Squat Day / Bench Day / Deadlift Day / Accessory Day — powerlifting-style' : ''}
EVERY LIFT SESSION must follow this split exactly — name sessions accordingly.
` : '';

  return `You are an expert exercise physiologist and CSCS-certified coach. Build REAL, specific training plans — not generic templates.

PLAN TYPE: ${planType.toUpperCase()}
GOAL: ${goalContext}
DURATION: ${totalWeeks} weeks

ATHLETE CURRENT FITNESS:
- ${fitnessContext}
${mileageSection}${runTypes}${liftingSection}
PLAN STYLE: ${isMileageBased
    ? 'MILEAGE-BASED — every run has a specific distance in miles and a pace range.'
    : 'TIME-BASED — runs are prescribed by duration and effort, not distance.'}

SCIENCE PRINCIPLES — NEVER VIOLATE:

1. CONCURRENT TRAINING & INTERFERENCE EFFECT (Hickson 1980, Wilson et al. 2012):
   ${planType === 'running' ? '- Running-only plan: no interference concerns.' :
     planType === 'lifting' ? '- Lifting-only plan: no interference concerns.' :
     `- Never schedule heavy lower-body compounds within 24 hours BEFORE tempo, interval, or long runs.
   - Upper body before a run is fine. Lower body AFTER running is fine (run first — Murlasits 2018).
   - Day before long run (${dayBefore}): full rest, active recovery, or upper body only.`}

2. POLARIZED TRAINING (Seiler 2010):
   ${planType !== 'lifting' ? '- 80% easy/aerobic (RPE 3-4). 20% hard (RPE 7-9). NOTHING in the gray zone (RPE 5-6).' : '- Not applicable.'}

3. PROGRESSIVE OVERLOAD (Kraemer & Ratamess 2004):
   ${planType !== 'lifting' ? `- Running: build to ${peakMileage} mi/week as described above.` : ''}
   ${planType !== 'running' ? `- Lifting: ${liftingScheme}. Progress 2.5-5% weekly on compounds.` : ''}

4. DELOAD (Bompa & Haff 2009):
   - Every 4th week: reduce volume 30-40%, maintain intensity. Mandatory for connective tissue.

5. REST DAY TYPES:
   - "full_rest": zero training
   - "off_running": no running, lifting OK
   - "off_lifting": no lifting, running OK
   - "active_recovery": walk/stretch/foam roll only (RPE 1-2)

${planType !== 'lifting' ? `6. LONG RUN on ${longRunDay}. Day before (${dayBefore}): full_rest, active_recovery, or upper body only. Day after: full_rest or active_recovery.` : ''}

SCHEDULE — USER-DEFINED, NON-NEGOTIABLE:
- Available days: ${input.availableDays?.join(', ') || 'all days'}
- Full rest days: ${fullRestDays.join(', ')} — ABSOLUTE, never put any workout here
${planType !== 'lifting' ? `- Runs/week: exactly ${runsPerWeek}` : ''}
${planType !== 'running' ? `- Lifts/week: exactly ${liftsPerWeek}` : ''}
${planType !== 'lifting' ? `- Long run day: ${longRunDay}` : ''}
- Max session length: ${input.maxMinutesPerSession || 60} minutes
${Object.keys(input.dayAssignments || {}).length > 0 ? `
DAY ASSIGNMENTS — THE USER EXPLICITLY CHOSE THESE — YOU MUST FOLLOW THEM EXACTLY:
${Object.entries(input.dayAssignments || {}).map(([day, type]) =>
  `- ${day}: ${type === 'run' ? 'RUN ONLY — no lift sessions on this day' :
               type === 'lift' ? 'LIFT ONLY — no run sessions on this day' :
               'BOTH run AND lift — schedule one of each on this day'}`
).join('\n')}
Any day NOT listed above that is a training day: AI may assign run or lift based on exercise science.
VIOLATION of day assignments is not permitted under any circumstances.` : ''}

EQUIPMENT: ${
    input.equipment === 'full_gym'   ? 'Full gym (barbells, dumbbells, cables, machines)' :
    input.equipment === 'home_basic' ? 'Home gym (dumbbells + pull-up bar only)' :
    'Bodyweight only — no equipment'
  }

OUTPUT RULES:
- ONLY valid JSON. No markdown, no backticks, no explanation.
- Every day of the week appears exactly once across runs, lifts, restDays.
- restDays format: [{ "dayOfWeek": "...", "restType": "full_rest|off_running|off_lifting|active_recovery" }]
- Max 4-5 exercises per lift session. Notes under 8 words.
- Real exercise names only. Specific sets/reps.
- ${isMileageBased ? 'Every run MUST have a "distance" field in miles.' : 'Every run MUST have a "duration" field in minutes.'}
- plan_insights: 5-7 insights, specific to THIS athlete's inputs, referencing the science. Not generic filler.`;
}


// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function getDayBefore(day) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days[(days.indexOf(day) - 1 + 7) % 7];
}

function buildPhases(runningGoal, liftingGoal, totalWeeks, planType) {
  // Lifting-only: strength periodization
  if (planType === 'lifting') {
    if (liftingGoal === 'powerlifting' || liftingGoal === 'strength') {
      const acc  = Math.max(Math.floor(totalWeeks * 0.35), 2);
      const int  = Math.max(Math.floor(totalWeeks * 0.65), acc + 1);
      const peak = Math.max(totalWeeks - 1, int + 1);
      return [
        { name: 'accumulation', startWeek: 1,        endWeek: acc  },
        { name: 'intensification', startWeek: acc + 1, endWeek: int  },
        { name: 'peak',          startWeek: int + 1,  endWeek: peak },
        { name: 'deload',        startWeek: peak + 1, endWeek: totalWeeks },
      ];
    }
    const p1 = Math.max(Math.floor(totalWeeks * 0.4), 2);
    const p2 = Math.max(Math.floor(totalWeeks * 0.75), p1 + 1);
    return [
      { name: 'foundation', startWeek: 1,       endWeek: p1 },
      { name: 'development', startWeek: p1 + 1,  endWeek: p2 },
      { name: 'performance', startWeek: p2 + 1,  endWeek: totalWeeks },
    ];
  }

  // Running-only: goal-specific phases
  if (planType === 'running') {
    if (runningGoal === 'race') {
      const base  = Math.max(Math.floor(totalWeeks * 0.35), 2);
      const build = Math.max(Math.floor(totalWeeks * 0.70), base + 1);
      const peak  = Math.max(totalWeeks - 2, build + 1);
      return [
        { name: 'base',  startWeek: 1,        endWeek: base  },
        { name: 'build', startWeek: base + 1,  endWeek: build },
        { name: 'peak',  startWeek: build + 1, endWeek: peak  },
        { name: 'taper', startWeek: peak + 1,  endWeek: totalWeeks },
      ];
    }
    if (runningGoal === 'speed') {
      const base  = Math.max(Math.floor(totalWeeks * 0.25), 2);
      const dev   = Math.max(Math.floor(totalWeeks * 0.65), base + 1);
      return [
        { name: 'base',        startWeek: 1,       endWeek: base },
        { name: 'development', startWeek: base + 1, endWeek: dev  },
        { name: 'performance', startWeek: dev + 1,  endWeek: totalWeeks },
      ];
    }
    // base_building, general_fitness, weight_loss
    const p1 = Math.max(Math.floor(totalWeeks * 0.4), 2);
    const p2 = Math.max(Math.floor(totalWeeks * 0.75), p1 + 1);
    return [
      { name: 'foundation',  startWeek: 1,       endWeek: p1 },
      { name: 'development', startWeek: p1 + 1,  endWeek: p2 },
      { name: 'performance', startWeek: p2 + 1,  endWeek: totalWeeks },
    ];
  }

  // Hybrid: default race-based or general
  if (runningGoal === 'race') {
    const base  = Math.max(Math.floor(totalWeeks * 0.35), 2);
    const build = Math.max(Math.floor(totalWeeks * 0.70), base + 1);
    const peak  = Math.max(totalWeeks - 2, build + 1);
    return [
      { name: 'base',  startWeek: 1,        endWeek: base  },
      { name: 'build', startWeek: base + 1,  endWeek: build },
      { name: 'peak',  startWeek: build + 1, endWeek: peak  },
      { name: 'taper', startWeek: peak + 1,  endWeek: totalWeeks },
    ];
  }
  const p1 = Math.max(Math.floor(totalWeeks * 0.33), 2);
  const p2 = Math.max(Math.floor(totalWeeks * 0.66), p1 + 1);
  return [
    { name: 'foundation',  startWeek: 1,       endWeek: p1 },
    { name: 'development', startWeek: p1 + 1,  endWeek: p2 },
    { name: 'performance', startWeek: p2 + 1,  endWeek: totalWeeks },
  ];
}

function expandTemplates(phaseTemplates, totalWeeks) {
  const weeks = [];

  for (const phase of phaseTemplates) {
    const template   = phase.template_week;
    const progression = phase.progression || {};

    for (let w = phase.startWeek; w <= Math.min(phase.endWeek, totalWeeks); w++) {
      const weekOffset = w - phase.startWeek;
      const isDeload   = w % 4 === 0;
      const week       = JSON.parse(JSON.stringify(template));

      if (!isDeload) {
        const mileageInc = progression.mileage_increase_per_week || 0;
        const longRunInc = progression.long_run_increase_per_week || 0;
        week.runs = (week.runs || []).map(run => {
          let dist = run.distance || 0;
          if (run.runType === 'long_run') {
            dist += longRunInc * weekOffset;
          } else {
            const others = (week.runs || []).filter(r => r.runType !== 'long_run').length;
            if (others > 0) dist += ((mileageInc - longRunInc) / others) * weekOffset;
          }
          return { ...run, distance: Math.round(Math.max(dist, 1) * 10) / 10 };
        });
        week.totalMileage = Math.round((week.runs || []).reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10;
      } else {
        week.runs = (week.runs || []).map(r => ({
          ...r,
          distance: Math.round((r.distance || 0) * 0.65 * 10) / 10,
          notes: 'Deload — easy effort only',
        }));
        week.lifts = (week.lifts || []).map(l => ({
          ...l,
          exercises: (l.exercises || []).map(ex => ({
            ...ex,
            sets: Math.max(Math.round((ex.sets || 3) * 0.7), 2),
            notes: 'Deload — reduce weight 20%',
          })),
        }));
        week.totalMileage = Math.round((week.runs || []).reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10;
      }

      weeks.push({ weekNumber: w, phase: isDeload ? 'deload' : phase.phase, ...week });
    }
  }

  return weeks;
}

async function callClaude(systemPrompt, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Claude API error:', response.status, errText.substring(0, 500));
    return null;
  }

  const result = await response.json();
  const text   = result.content?.find(c => c.type === 'text')?.text;
  if (!text) { console.error('No text in response'); return null; }

  try {
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (err) {
    console.error('JSON parse failed:', err.message);
    console.error('Raw response (first 2000 chars):', text.substring(0, 2000));
    return null;
  }
}