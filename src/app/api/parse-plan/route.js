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
- CRITICAL: output strict JSON only. Every property name MUST use double quotes.
  Never use unquoted keys. Start your response with { and end with }
- plan_type should be "hybrid" if both runs and lifts, "run" if run-only, "lift" if lift-only
- If a race is detected, set raceDistance, raceName, goalTime accordingly
- Expand abbreviated plans: if weeks are similar, write out all weeks explicitly`;

// Robust JSON extractor that survives common Claude formatting drift.
//
// Root cause of all failures seen so far: the 4 000-token limit puts
// Claude under context pressure near the end of a long plan, causing it
// to drop commas or quotes around position 11 000-11 500 (≈ 70% through
// a 16-week plan). Raising max_tokens to 8 000 eliminates most cases;
// the cleanup passes below handle the residual formatting drift.
//
// Cleanup passes applied before JSON.parse:
//  1. Strip markdown fences
//  2. Extract outermost { … } block
//  3. Remove JS-style comments
//  4. Remove trailing commas  (,} or ,])
//  5. Insert missing commas between adjacent objects/arrays  (}{ → },{)
//  6. Insert missing commas between adjacent strings with whitespace
//     "x" \n "y" → "x",\n"y"   (Fix 4, safe: "x" "y" is never valid)
//  7. Insert missing commas between adjacent strings with NO whitespace
//     "Chest""Shoulders" → "Chest","Shoulders"
//     Detects word-char at end of first string + "" + word-char at start of next.
//     Safe: empty strings ("") are never valid in our schema output.
//
// On first-pass failure a second pass also quotes unquoted property names.
function parseClaudeJSON(rawText) {
  let s = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Extract outermost { … }
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('No JSON object found in Claude response');
  s = s.slice(start, end + 1);

  // Remove JS-style comments
  s = s.replace(/\/\/[^\n]*/g, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');

  // Fix 4: trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // Fix 5: missing comma between adjacent } or ] and { or [
  // \s* matches zero or more whitespace so this catches same-line }{  too.
  // Already-commaed sequences (},\n{) don't match because , is not \s.
  s = s.replace(/([}\]])(\s*)([{[])/g, '$1,$2$3');

  // Fix 6: missing comma between adjacent strings separated by whitespace
  // "value1"\n  "value2" → "value1",\n  "value2"
  // Already-commaed ("x", "y") don't match because , is not \s.
  s = s.replace(/"(\s+)"/g, '",$1"');

  // Fix 7: missing comma between adjacent strings with NO whitespace
  // "Chest""Shoulders" → "Chest","Shoulders"
  // Matches: a word/digit char at end of first string + "" + word/digit at start of next.
  // Does NOT match: "key": "" (empty string — preceded by space/colon, not a word char)
  // Does NOT match: ["", "x"] (empty string — preceded by [ which is not \w)
  s = s.replace(/([a-zA-Z0-9_])""([a-zA-Z0-9_{\[])/g, '$1","$2');

  // ── Pass 1: strict parse ──
  try {
    return JSON.parse(s);
  } catch (e1) {
    // ── Pass 2: quote bare property-name identifiers ──
    // Lines whose first non-whitespace content is an identifier then a colon
    // are unquoted keys. Already-quoted keys start with " so [a-zA-Z_$] skips them.
    const patched = s.replace(
      /^(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/gm,
      '$1"$2"$3'
    );
    try {
      return JSON.parse(patched);
    } catch (e2) {
      console.error('JSON parse pass 1:', e1.message);
      console.error('JSON parse pass 2:', e2.message);
      console.error('Raw (first 500 chars):', rawText.slice(0, 500));
      throw new Error(`Could not parse Claude response as JSON: ${e1.message}`);
    }
  }
}

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
      max_tokens: 30000,
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

  const plan = parseClaudeJSON(raw);

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
