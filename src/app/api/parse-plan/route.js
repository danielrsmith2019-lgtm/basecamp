const SYSTEM_PROMPT = `You are a training plan parser for a fitness app called BaseCamp.
Convert the provided training plan into a structured JSON object.
The output MUST be valid JSON that matches this exact schema — no markdown, no backticks, no explanation:

{
  "name": "Plan name (infer from content, e.g. '16-Week Marathon Training')",
  "description": "1-2 sentence description",
  "plan_type": "hybrid",
  "total_weeks": 12,
  "raceName": null,
  "raceDistance": null,
  "goalTime": null,
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "base",
      "phaseDescription": "Building aerobic base",
      "runs": [
        {
          "dayOfWeek": "monday",
          "runType": "easy",
          "distance": 5.0,
          "targetPace": null,
          "duration": null,
          "notes": null
        }
      ],
      "lifts": [
        {
          "dayOfWeek": "tuesday",
          "sessionName": "Upper Push",
          "muscleGroups": ["Chest", "Shoulders", "Triceps"],
          "exercises": [
            { "name": "Bench Press", "sets": 3, "reps": "8-10" },
            { "name": "Overhead Press", "sets": 3, "reps": "8-10" }
          ],
          "duration": 45
        }
      ],
      "restDays": [
        { "dayOfWeek": "sunday", "restType": "full_rest" }
      ]
    }
  ],
  "plan_insights": []
}

Rules:
- dayOfWeek must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday (lowercase)
- runType must be one of: easy, tempo, interval, long_run, recovery, race, fartlek, shakeout
- phase must be one of: base, build, peak, taper
- raceDistance must be one of: marathon, half, 10k, 5k — or null
- If distances are in km, convert to miles (divide by 1.609)
- Infer phases: early weeks = base, middle = build, hardest weeks = peak, final 1-2 = taper
- If lifting sessions are vague (e.g. "strength"), create sensible defaults: Upper Push, Lower Body, Full Body
- If no lifts mentioned, set lifts: [] for each week
- Never include commentary or markdown — start your response with { and end with }
- plan_type should be "hybrid" if both runs and lifts, "run" if run-only, "lift" if lift-only
- If a race is detected, set raceDistance, raceName, goalTime accordingly
- Expand abbreviated plans: if weeks are similar, write out all weeks explicitly`;

async function callClaude(text) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Parse this training plan:\n\n${text}` }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Claude API error:', response.status, err.slice(0, 200));
    throw new Error(`Claude API returned ${response.status}`);
  }

  const result = await response.json();
  const raw = result.content?.find(c => c.type === 'text')?.text;
  if (!raw) throw new Error('No text in Claude response');

  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const plan = JSON.parse(cleaned);

  // Sanity-check the response has the required shape
  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    throw new Error('Parsed plan has no weeks');
  }

  // Ensure weekNumbers are set correctly
  plan.weeks = plan.weeks.map((w, i) => ({
    ...w,
    weekNumber: w.weekNumber || i + 1,
    runs: (w.runs || []).map(r => ({ ...r, runType: (r.runType || 'easy').toLowerCase() })),
    lifts: w.lifts || [],
    restDays: w.restDays || [],
  }));

  if (!plan.total_weeks) plan.total_weeks = plan.weeks.length;
  if (!plan.plan_insights) plan.plan_insights = [];

  return plan;
}

export async function POST(request) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) {
      return Response.json({ error: 'No plan text provided' }, { status: 400 });
    }
    const plan = await callClaude(text.trim());
    return Response.json({ plan });
  } catch (err) {
    console.error('parse-plan error:', err.message);
    return Response.json({ error: err.message || 'Failed to parse plan' }, { status: 500 });
  }
}
