// app/api/edit-plan/route.js

export async function POST(request) {
  try {
    const { prompt, plan } = await request.json();

    if (!prompt || !plan) {
      return Response.json({ error: 'Missing prompt or plan' }, { status: 400 });
    }

    const systemPrompt = `You are an expert hybrid athlete coach specialising in marathon training and strength programming.

You will receive a JSON training plan and a user's edit request.

YOUR RESPONSE MUST BE VALID JSON ONLY. No markdown, no backticks, no preamble, no trailing text.
Start your response with { and end with }.

Return this exact structure:
{
  "explanation": "2-3 sentences explaining what you changed and the science behind it",
  "suggestions": [
    {
      "id": "suggestion_1",
      "type": "reduce|increase|swap|add|remove|modify",
      "title": "Short title",
      "description": "What this change does and why",
      "science": "Training science rationale",
      "planMutations": [
        {
          "weekNumber": 1,
          "action": "update_run|update_lift|remove_run|remove_lift|add_run|add_lift|update_week_mileage",
          "runIndex": 0,
          "liftIndex": 0,
          "day": "monday",
          "changes": { "distance": 4, "targetPace": "8:30", "runType": "easy" }
        }
      ]
    }
  ]
}

Coaching rules:
- Return 1-3 targeted suggestions only
- Respect the interference effect: no lower body lift the day before a long run or tempo
- Follow the 10% weekly mileage increase rule
- Preserve periodization: base → build → peak → taper phases
- For hybrid plans: run quality > lift volume when forced to choose
- planMutations must reference real weekNumbers and valid indices from the plan
- action "update_run" with changes object updates that run's fields
- action "update_lift" updates a lift session's fields  
- Keep suggestions specific and immediately actionable`;

    // Send a compact plan summary to stay within token limits
    const planSummary = {
      name: plan.name,
      total_weeks: plan.weeks?.length,
      plan_type: plan.plan_type,
      weeks: plan.weeks?.slice(0, 12).map(w => ({  // first 12 weeks for context
        weekNumber: w.weekNumber,
        phase: w.phase,
        totalMileage: w.totalMileage,
        runs: w.runs?.map((r, i) => ({
          index: i, day: r.dayOfWeek, type: r.runType,
          distance: r.distance, pace: r.targetPace,
        })),
        lifts: w.lifts?.map((l, i) => ({
          index: i, day: l.dayOfWeek,
          name: l.sessionName, exercises: l.exercises?.length,
        })),
        restDays: w.restDays?.map(r => typeof r === 'object' ? r.dayOfWeek : r),
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
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Plan:\n${JSON.stringify(planSummary, null, 2)}\n\nEdit request: ${prompt}\n\nReturn ONLY the JSON object.`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText.substring(0, 300));
      return Response.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
    }

    const result = await response.json();
    const rawText = result.content?.find(c => c.type === 'text')?.text || '';

    // Robust JSON extraction — handles any wrapping Claude might add
    let parsed = null;
    const attempts = [
      // 1. Direct parse
      () => JSON.parse(rawText),
      // 2. Strip markdown fences
      () => JSON.parse(rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()),
      // 3. Extract first JSON object
      () => {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON object found');
        return JSON.parse(match[0]);
      },
      // 4. Find the largest JSON block
      () => {
        const matches = [...rawText.matchAll(/\{[\s\S]*?\}/g)];
        const sorted = matches.sort((a, b) => b[0].length - a[0].length);
        return JSON.parse(sorted[0][0]);
      },
    ];

    for (const attempt of attempts) {
      try { parsed = attempt(); break; } catch {}
    }

    if (!parsed) {
      // Return the raw text as explanation so user isn't left with blank error
      return Response.json({
        explanation: rawText.substring(0, 500),
        suggestions: [],
        parseError: true,
      });
    }

    // Validate structure
    if (!parsed.suggestions) parsed.suggestions = [];
    if (!parsed.explanation) parsed.explanation = 'Plan updated.';

    return Response.json(parsed);

  } catch (err) {
    console.error('Edit plan error:', err);
    return Response.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}