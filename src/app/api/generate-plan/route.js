// app/api/generate-plan/route.js
//
// Generates science-based hybrid training plans via Claude API.
// Produces plan_insights explaining the reasoning behind every major decision.

export async function POST(request) {
  try {
    const input = await request.json();

    if (!input.availableDays || input.availableDays.length < 2) {
      return Response.json({ error: 'At least 2 training days required.' }, { status: 400 });
    }
    if (!input.fullRestDays || input.fullRestDays.length < 1) {
      return Response.json({ error: 'At least 1 full rest day required.' }, { status: 400 });
    }

    let totalWeeks = 12;
    if (input.raceType !== 'none' && input.raceDate) {
      const now = new Date();
      const race = new Date(input.raceDate);
      const diffWeeks = Math.ceil((race - now) / (7 * 24 * 60 * 60 * 1000));
      totalWeeks = Math.max(4, Math.min(diffWeeks, 24));
    }

    const runsPerWeek = input.runsPerWeek || 3;
    const liftsPerWeek = input.liftsPerWeek || 3;

    const liftingScheme = {
      strength: '3-5 reps, 4-5 sets, 2-3 min rest, RPE 8-9',
      hypertrophy: '8-12 reps, 3-4 sets, 60-90s rest, RPE 7-8',
      maintenance: '6-8 reps, 3 sets, 90s rest, RPE 6-7',
    }[input.liftingGoal] || '8-12 reps, 3-4 sets';

    // Calculate realistic peak mileage targets based on race type
    const currentMileage = Number(input.weeklyMileage) || 0;
    const peakMileage = {
      marathon: Math.max(currentMileage * 2.5, 40),      // Marathon peak: 40-55 mi/week
      half_marathon: Math.max(currentMileage * 2, 30),    // Half peak: 30-40 mi/week
      none: Math.max(currentMileage * 1.5, 20),           // General: moderate increase
    }[input.raceType] || 20;

    const planStyle = input.planStyle || 'mileage';

    const systemPrompt = buildSystemPrompt(input, totalWeeks, runsPerWeek, liftsPerWeek, liftingScheme, peakMileage, planStyle);

    if (totalWeeks <= 8) {
      return await generateDirectPlan(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek);
    } else {
      return await generateFromTemplates(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek);
    }

  } catch (err) {
    console.error('Plan generation error:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}


// ── SHORT PLANS (≤8 weeks) ──
async function generateDirectPlan(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek) {
  const userMessage = `Generate a ${totalWeeks}-week hybrid training plan. Return ONLY valid JSON.

Use this exact structure:
{
  "name": "plan name",
  "description": "1-2 sentence summary",
  "plan_type": "hybrid",
  "total_weeks": ${totalWeeks},
  "plan_insights": [
    { "category": "scheduling", "title": "Why your long run is on ${input.longRunDay || 'saturday'}", "explanation": "..." },
    { "category": "interference", "title": "How we protect your hard runs", "explanation": "..." },
    { "category": "periodization", "title": "Your phase structure", "explanation": "..." },
    { "category": "recovery", "title": "Rest day strategy", "explanation": "..." },
    { "category": "progression", "title": "How volume builds week to week", "explanation": "..." }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "base",
      "totalMileage": 15,
      "runs": [
        { "dayOfWeek": "tuesday", "runType": "easy", "distance": 4, "targetPace": "9:00-9:30", "duration": 36, "notes": "Easy effort" }
      ],
      "lifts": [
        {
          "dayOfWeek": "monday",
          "sessionName": "Upper Body",
          "muscleGroups": ["chest", "shoulders"],
          "duration": 45,
          "exercises": [
            { "name": "Bench Press", "sets": 4, "reps": "8-10", "notes": "" }
          ]
        }
      ],
      "restDays": [
        { "dayOfWeek": "sunday", "restType": "full_rest" },
        { "dayOfWeek": "thursday", "restType": "off_running" }
      ]
    }
  ]
}

Generate 5-7 plan_insights that explain WHY you made specific decisions. Be specific to this user's inputs, not generic. Reference the science.`;

  const plan = await callClaude(systemPrompt, userMessage);
  if (!plan) {
    return Response.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });
  }

  plan.generated_at = new Date().toISOString();
  plan.input = input;
  return Response.json(plan);
}


// ── LONG PLANS (>8 weeks) ──
async function generateFromTemplates(systemPrompt, input, totalWeeks, runsPerWeek, liftsPerWeek) {
  const phases = buildPhases(input.raceType, totalWeeks);

  const userMessage = `Generate a ${totalWeeks}-week hybrid training plan using PHASE TEMPLATES.

Phases:
${phases.map(p => `- ${p.name}: weeks ${p.startWeek}-${p.endWeek} (${p.endWeek - p.startWeek + 1} weeks)`).join('\n')}

Return ONLY valid JSON:
{
  "name": "plan name",
  "description": "1-2 sentence summary",
  "plan_type": "hybrid",
  "total_weeks": ${totalWeeks},
  "plan_insights": [
    { "category": "scheduling", "title": "Why your long run is on ${input.longRunDay || 'saturday'}", "explanation": "..." },
    { "category": "interference", "title": "How we protect your hard runs", "explanation": "..." },
    { "category": "periodization", "title": "Your ${phases.length}-phase structure", "explanation": "..." },
    { "category": "recovery", "title": "Rest day strategy", "explanation": "..." },
    { "category": "progression", "title": "How volume builds across ${totalWeeks} weeks", "explanation": "..." },
    { "category": "deload", "title": "Deload week strategy", "explanation": "..." }
  ],
  "phase_templates": [
    {
      "phase": "${phases[0].name}",
      "startWeek": ${phases[0].startWeek},
      "endWeek": ${phases[0].endWeek},
      "template_week": {
        "totalMileage": 15,
        "runs": [
          { "dayOfWeek": "tuesday", "runType": "easy", "distance": 4, "targetPace": "9:00-9:30", "duration": 36, "notes": "Easy effort" }
        ],
        "lifts": [
          {
            "dayOfWeek": "monday",
            "sessionName": "Upper Body",
            "muscleGroups": ["chest", "shoulders"],
            "duration": 45,
            "exercises": [
              { "name": "Bench Press", "sets": 4, "reps": "8-10", "notes": "" }
            ]
          }
        ],
        "restDays": [
          { "dayOfWeek": "sunday", "restType": "full_rest" }
        ]
      },
      "progression": {
        "mileage_increase_per_week": 1.5,
        "long_run_increase_per_week": 1,
        "lifting_note": "Add 5 lbs to compounds weekly"
      }
    }
  ]
}

Rules:
- Each template: exactly ${runsPerWeek} runs, ${liftsPerWeek} lifts.
- Every day of the week must appear once across runs, lifts, restDays.
- Max 4 exercises per lift. Notes under 8 words.
- Generate 5-7 plan_insights specific to this user. Reference exercise science.`;

  const templateData = await callClaude(systemPrompt, userMessage);
  if (!templateData || !templateData.phase_templates) {
    return Response.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });
  }

  const expandedWeeks = expandTemplates(templateData.phase_templates, totalWeeks);

  const plan = {
    name: templateData.name || 'Hybrid Training Plan',
    description: templateData.description || '',
    plan_type: templateData.plan_type || 'hybrid',
    total_weeks: totalWeeks,
    plan_insights: templateData.plan_insights || [],
    weeks: expandedWeeks,
    generated_at: new Date().toISOString(),
    input: input,
  };

  return Response.json(plan);
}


// ── System Prompt ──
function buildSystemPrompt(input, totalWeeks, runsPerWeek, liftsPerWeek, liftingScheme, peakMileage, planStyle) {
  const longRunDay = input.longRunDay || 'saturday';
  const fullRestDays = input.fullRestDays || ['sunday'];
  const dayBefore = getDayBefore(longRunDay);
  const currentMileage = Number(input.weeklyMileage) || 0;
  const isMileageBased = planStyle === 'mileage';

  return `You are an expert exercise physiologist and CSCS-certified strength & conditioning coach. You build REAL training plans — the kind a coach would charge $200/month for. Not generic templates.

PLAN STYLE: ${isMileageBased
  ? 'MILEAGE-BASED — Every run must have a specific distance in miles. Paces should be specific ranges (e.g., "8:15-8:30/mi"). This is a numbers-driven plan.'
  : 'TIME-BASED — Runs are prescribed by duration and effort level, not distance. Example: "45 min easy" or "30 min with 6x3 min at tempo effort, 2 min jog recovery." Include duration in minutes for every run.'}

MILEAGE TARGETS — THIS IS CRITICAL:
- Current weekly mileage: ${currentMileage} mi/week
- Target peak weekly mileage: ${peakMileage} mi/week
- The plan MUST progress from ${currentMileage} to ${peakMileage} mi/week over the training period.
- Week 1 should start at ${currentMileage} mi. Peak week should hit ${peakMileage} mi.
- This means increasing roughly ${((peakMileage - currentMileage) / (totalWeeks * 0.7)).toFixed(1)} mi/week on average during build phases.
- The long run should build from ${Math.max(Math.round(currentMileage * 0.3), 4)} mi to ${Math.round(peakMileage * 0.35)} mi at peak.
${input.raceType === 'marathon' ? '- The longest long run should be 20-22 miles, 2-3 weeks before race day.' : ''}
${input.raceType === 'half_marathon' ? '- The longest long run should be 12-14 miles, 2-3 weeks before race day.' : ''}

SCIENCE-BASED PRINCIPLES — NEVER VIOLATE:

1. CONCURRENT TRAINING & INTERFERENCE EFFECT (Hickson 1980, Wilson et al. 2012):
   - Never schedule heavy lower-body compounds (squats, deadlifts, lunges, leg press) within 24 hours BEFORE a tempo, interval, threshold, or long run.
   - Upper body lifting before a run is acceptable. Lower body after running is acceptable (run first, lift second — Murlasits et al. 2018).
   - The day before the long run (${dayBefore}) must be full rest, active recovery, or upper-body only.

2. POLARIZED TRAINING DISTRIBUTION (Seiler 2010, Stöggl & Sperlich 2015):
   - 80% of running at easy/conversational pace (RPE 3-4). 20% at tempo/threshold/intervals (RPE 6-9).
   - No "moderate" gray zone runs (RPE 5).

3. PROGRESSIVE OVERLOAD (Kraemer & Ratamess 2004):
   - Lifting: ${liftingScheme}. Progress load 2.5-5%/week compounds, 5-10% accessories.
   - Running: Follow the calculated mileage progression above. The 10% rule is a guideline, not a ceiling — experienced runners can progress faster in base phase.

4. PERIODIZATION (Bompa & Haff 2009):
   - Deload every 4th week: reduce running volume 30-40%, reduce lifting volume 30%, maintain intensity.
   - Deload weeks are mandatory for connective tissue adaptation.

5. REST DAY TYPES — use these exact values:
   - "full_rest": Zero training. Complete recovery. At least 1x/week minimum.
   - "off_running": No running. Upper body lifting or mobility work okay.
   - "off_lifting": No lifting. Easy run or cardio okay.
   - "active_recovery": Very light movement only — walk, stretch, foam roll. RPE 1-2.

6. LONG RUN: MUST be on ${longRunDay}. The day before (${dayBefore}) must be full_rest, active_recovery, or off_running. The day after should be full_rest or active_recovery.

7. FULL REST DAYS: ${fullRestDays.join(', ')} — these are non-negotiable. No training.

SCHEDULE:
- Training days: ${input.availableDays.join(', ')}
- Full rest days: ${fullRestDays.join(', ')}
- Runs/week: exactly ${runsPerWeek}
- Lifts/week: exactly ${liftsPerWeek}
- Long run day: ${longRunDay}
- Max time/session: ${input.maxMinutesPerSession} minutes

EQUIPMENT: ${
  input.equipment === 'full_gym' ? 'Full gym — barbells, dumbbells, cables, machines' :
  input.equipment === 'home_basic' ? 'Dumbbells and pull-up bar only' :
  'Bodyweight only'
}

USER:
- Goal: ${input.raceType === 'marathon' ? 'Marathon' : input.raceType === 'half_marathon' ? 'Half Marathon' : 'General Fitness'}
${input.targetTime ? `- Target: ${input.targetTime}` : ''}
- Current: ${currentMileage} mi/week → Peak: ${peakMileage} mi/week
- Lifting: ${input.liftingExperience} / ${input.liftingGoal}
- Duration: ${totalWeeks} weeks

PLAN INSIGHTS: Include 5-7 insights explaining WHY. Reference the science. Categories: scheduling, interference, periodization, recovery, progression, deload, nutrition_note. Be specific to THIS user.

OUTPUT:
- ONLY valid JSON. No markdown, no backticks.
- Notes under 8 words. Max 4 exercises per lift.
- Real exercise names. Every day appears exactly once across runs, lifts, restDays.
- restDays format: [{ "dayOfWeek": "...", "restType": "full_rest|off_running|off_lifting|active_recovery" }]
${isMileageBased ? '- Every run MUST have a "distance" field in miles.' : '- Every run MUST have a "duration" field in minutes.'}`;
}


// ── Helper: get the day before a given day ──
function getDayBefore(day) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const idx = days.indexOf(day);
  return days[(idx - 1 + 7) % 7];
}


// ── Phase builder ──
function buildPhases(raceType, totalWeeks) {
  if (raceType === 'none') {
    const p1 = Math.max(Math.floor(totalWeeks * 0.33), 1);
    const p2 = Math.max(Math.floor(totalWeeks * 0.66), p1 + 1);
    return [
      { name: 'foundation', startWeek: 1, endWeek: p1 },
      { name: 'development', startWeek: p1 + 1, endWeek: p2 },
      { name: 'performance', startWeek: p2 + 1, endWeek: totalWeeks },
    ];
  }
  const base = Math.max(Math.floor(totalWeeks * 0.35), 1);
  const build = Math.max(Math.floor(totalWeeks * 0.7), base + 1);
  const peak = Math.max(totalWeeks - 2, build + 1);
  return [
    { name: 'base', startWeek: 1, endWeek: base },
    { name: 'build', startWeek: base + 1, endWeek: build },
    { name: 'peak', startWeek: build + 1, endWeek: peak },
    { name: 'taper', startWeek: peak + 1, endWeek: totalWeeks },
  ];
}


// ── Template expander ──
function expandTemplates(phaseTemplates, totalWeeks) {
  const weeks = [];

  for (const phase of phaseTemplates) {
    const template = phase.template_week;
    const progression = phase.progression || {};

    for (let w = phase.startWeek; w <= Math.min(phase.endWeek, totalWeeks); w++) {
      const weekOffset = w - phase.startWeek;
      const isDeload = w % 4 === 0;

      const week = JSON.parse(JSON.stringify(template));
      const mileageInc = progression.mileage_increase_per_week || 0;
      const longRunInc = progression.long_run_increase_per_week || 0;

      if (!isDeload) {
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
          ...r, distance: Math.round((r.distance || 0) * 0.65 * 10) / 10, notes: 'Deload — easy effort',
        }));
        week.lifts = (week.lifts || []).map(l => ({
          ...l, exercises: (l.exercises || []).map(ex => ({
            ...ex, sets: Math.max(Math.round((ex.sets || 3) * 0.7), 2), notes: 'Deload — reduce weight 20%',
          })),
        }));
        week.totalMileage = Math.round((week.runs || []).reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10;
      }

      weeks.push({ weekNumber: w, phase: isDeload ? 'deload' : phase.phase, ...week });
    }
  }
  return weeks;
}


// ── Claude API caller ──
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
  const text = result.content?.find(c => c.type === 'text')?.text;
  if (!text) { console.error('No text in response'); return null; }

  try {
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (err) {
    console.error('JSON parse failed:', err.message);
    console.error('Raw:', text.substring(0, 2000));
    return null;
  }
}