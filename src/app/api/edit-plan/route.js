// app/api/edit-plan/route.js

export async function POST(request) {
  try {
    const { prompt, plan } = await request.json();

    if (!prompt || !plan) {
      return Response.json({ error: 'Missing prompt or plan' }, { status: 400 });
    }

    const systemPrompt = `You are an expert running coach and strength coach who helps athletes modify their training plans.

You will be given a training plan (JSON) and a user request to modify it.

Respond with ONLY valid JSON — no markdown, no backticks, no preamble:
{
  "explanation": "2-3 sentence explanation of your recommendations and the science behind them",
  "suggestions": [
    {
      "id": "suggestion_1",
      "type": "reduce|increase|swap|add|remove|modify",
      "title": "Short title of the change",
      "description": "What this change does and why",
      "changes": ["Specific change 1", "Specific change 2"],
      "science": "The training science explanation for why this change is appropriate",
      "planMutations": [
        {
          "weekNumber": 1,
          "action": "update_run|update_lift|remove_run|remove_lift|add_rest|update_week_mileage",
          "runIndex": 0,
          "liftIndex": 0,
          "changes": { "distance": 4, "targetPace": "8:30" },
          "day": "tuesday",
          "value": 35
        }
      ]
    }
  ]
}

Rules:
- Return 1-3 targeted suggestions maximum
- Each suggestion must be specific and actionable
- planMutations contains the exact data changes to apply
- Use training science: progressive overload, 10% rule, interference effect, periodization
- Consider the athlete's current phase and plan flow
- For hybrid plans, respect the interference effect between running and lifting
- Never suggest changes that violate basic periodization or would harm the athlete`;

    const planSummary = {
      name: plan.name,
      total_weeks: plan.weeks?.length,
      weeks: plan.weeks?.map(w => ({
        weekNumber: w.weekNumber,
        phase: w.phase,
        totalMileage: w.totalMileage,
        runs: w.runs?.map((r, i) => ({
          index: i, dayOfWeek: r.dayOfWeek, runType: r.runType,
          distance: r.distance, targetPace: r.targetPace,
        })),
        lifts: w.lifts?.map((l, i) => ({
          index: i, dayOfWeek: l.dayOfWeek,
          sessionName: l.sessionName, exerciseCount: l.exercises?.length,
        })),
        restDays: w.restDays,
      })),
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Training plan:\n${JSON.stringify(planSummary, null, 2)}\n\nUser request: ${prompt}\n\nRespond with ONLY the JSON object.`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText.substring(0, 300));
      return Response.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
    }

    const result = await response.json();
    const text = result.content?.find(c => c.type === 'text')?.text;

    if (!text) {
      return Response.json({ error: 'No response from AI.' }, { status: 500 });
    }

    try {
      const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return Response.json(JSON.parse(clean));
    } catch {
      return Response.json({ explanation: text, suggestions: [] });
    }

  } catch (err) {
    console.error('Edit plan error:', err);
    return Response.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}