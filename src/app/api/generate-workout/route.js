import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are BaseCamp's AI workout generator. Generate a single focused workout session.

Return ONLY valid JSON — no markdown, no comments, no explanation outside the JSON.

LIFT workout schema:
{
  "workoutType": "lift",
  "sessionName": "descriptive name like 'Upper Push – Chest Focus'",
  "muscleGroups": ["Chest", "Shoulders", "Triceps"],
  "estimatedDuration": 60,
  "sections": [
    {
      "label": "Warm-up",
      "exercises": [
        {
          "name": "exercise name",
          "muscleGroup": "string",
          "sets": 2,
          "reps": "15",
          "rest": "60s",
          "note": "coaching cue or null",
          "supersetWith": "name of paired exercise or null"
        }
      ]
    },
    {
      "label": "Main Work",
      "exercises": [...]
    },
    {
      "label": "Finisher",
      "exercises": [...]
    }
  ]
}

RUN workout schema:
{
  "workoutType": "run",
  "sessionName": "string",
  "runType": "Easy Run|Tempo|Intervals|Long Run",
  "estimatedDistance": 4.5,
  "estimatedDuration": 40,
  "sections": [
    { "label": "Warm-up", "content": "description string" },
    { "label": "Main Effort", "content": "description string", "intervals": [{ "reps": 4, "distance": "400m", "effort": "5K pace", "recovery": "90s jog" }] },
    { "label": "Cool-down", "content": "description string" }
  ]
}

CARDIO workout schema:
{
  "workoutType": "cardio",
  "sessionName": "string",
  "activityType": "Cycling|Rowing|Elliptical|Swimming",
  "estimatedDuration": 30,
  "sections": [
    { "label": "Warm-up", "content": "string" },
    { "label": "Main Work", "content": "string" },
    { "label": "Cool-down", "content": "string" }
  ]
}

Rules:
- Warm-up: 2-3 exercises/activities. Prepare joints and elevate heart rate.
- Main Work: 3-6 exercises for lifts. Lead with the compound movement.
- Finisher: 1-2 exercises. High-rep burnout or conditioning.
- Use supersets to pair agonist/antagonist or push/pull exercises where appropriate.
- Reps by intensity — Light: "15-20", Moderate: "8-12", Heavy: "3-6"
- Rest by intensity — Light: "45s", Moderate: "90s", Heavy: "3 min"
- Coaching notes: brief, actionable (e.g. "Drive elbows down" or "Pause at bottom")
- Consider recent training to avoid repeating the same session two days in a row
- Return complete, valid JSON only.`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { workoutType, subtype, duration, equipment, intensity, focusNote, recentSummary, loadLevel } = body;

    const userMessage = buildPrompt({ workoutType, subtype, duration, equipment, intensity, focusNote, recentSummary, loadLevel });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: userMessage }],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText.substring(0, 300));
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }

    const apiResult = await response.json();
    const text = apiResult.content?.find(c => c.type === 'text')?.text;
    if (!text) return NextResponse.json({ error: 'No response from model' }, { status: 500 });

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    } catch (err) {
      console.error('JSON parse failed. Raw (first 500):', text.substring(0, 500));
      return NextResponse.json({ error: 'Invalid response format — try again' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('generate-workout error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

function buildPrompt({ workoutType, subtype, duration, equipment, intensity, focusNote, recentSummary, loadLevel }) {
  const equipStr = (equipment || ['Full gym']).join(', ');

  const typeDesc =
    workoutType === 'surprise' ? 'Surprise workout — pick the most creative and effective option. Can be lift, run, or cardio.' :
    workoutType === 'run'      ? 'Running workout' :
    workoutType === 'cardio'   ? 'Cardio workout (non-running)' :
    subtype === 'legs'         ? 'Lower body lift — quads, hamstrings, glutes, calves' :
    subtype === 'upper_push'   ? 'Upper body push — chest, shoulders, triceps' :
    subtype === 'upper_pull'   ? 'Upper body pull — back, biceps, rear delts' :
    subtype === 'full_body'    ? 'Full body lift — all major muscle groups' :
                                 'Lift workout';

  return `Generate a ${duration}-minute ${intensity.toLowerCase()} ${typeDesc}.

Equipment available: ${equipStr}
${focusNote ? `Coach note from athlete: "${focusNote}"` : ''}

Athlete context:
- Last 5 sessions: ${recentSummary || 'none recorded'}
- Current training load: ${loadLevel || 'Moderate'}${loadLevel === 'High' ? ' — consider a lighter session or deload focus' : ''}

Return only valid JSON matching the schema.`;
}
