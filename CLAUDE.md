@AGENTS.md

# BaseCamp — App Summary

## Purpose

BaseCamp is a unified fitness tracking OS for athletes who combine running and lifting. The core insight is the "interference effect" — how running affects lifting recovery and vice versa. Most apps handle only one modality; BaseCamp tracks all of them together and surfaces cross-training conflicts intelligently.

## Pages & Features

| Route | Purpose |
|---|---|
| `/` | Dashboard: today's plan, readiness score, KPI grid, training load trends, PRs, AI insights |
| `/schedule` | Calendar/list view of all planned and completed sessions |
| `/plans` | AI-generated multi-week training plans (base → build → peak → taper); inline editing |
| `/log` | History of completed workouts with filters, quick stats, and new-log entry |
| `/nutrition` | Daily meal logging with a food database, macro tracking, weekly calorie chart |
| `/goals` | Race goals, weekly targets (miles, volume, days), custom milestones with progress rings |
| `/records` | All-time PRs for runs (1K–marathon) and lifts (estimated 1RM per movement) |
| `/settings` | User profile, calorie/protein targets, experience level, primary goal |

## Data Model

Every workout — run, lift, cardio, or rest — is a single `workouts` table row with a `type` field and a `details` JSONB column for type-specific data (pace/distance for runs, exercises/sets/volume for lifts, etc.). Plans are stored as JSON and converted to individual workout rows when activated.

Key workout types:
- **Run**: runType (Easy/Tempo/Intervals/Long/Race), plannedDistance, targetPace, actualDistance, actualPace, rpe
- **Lift**: sessionName, muscleGroups, exercises[] → sets[] (weight, reps, rpe)
- **Cardio**: activityType, duration, distance, heartRate, caloriesBurned
- **Rest**: restType (Full Rest / Active Recovery / Deload)

## Intelligence Layer

- **Readiness Score** (0–100): daily check-in on sleep, energy, soreness → recommends session swaps
- **Cross-Training Insights**: detects leg day + hard run conflicts, volume spikes (>15% week-over-week), pace creep, overtraining signals
- **Skip Intelligence**: tracks skipped workouts and surfaces reschedule suggestions
- **Adaptive Planning**: background engine proposes plan adjustments based on adherence and recovery
- **PR Detection**: auto-detects new PRs after every logged session

## Tech Stack

- **Framework**: Next.js (React 19)
- **Database & Auth**: Supabase (PostgreSQL with JSONB, OAuth/email auth)
- **UI**: Tailwind CSS 4, Lucide icons, Recharts
- **AI**: Claude API via `/api/generate-plan` for plan generation and natural-language plan editing
- **State**: WorkoutContext (React context + Supabase sync)
- **Sharing**: html2canvas → social image generation with deep links to `basecamp.fit/workout/{id}`

## Key Files

- `src/app/page.jsx` — dashboard (main entry point, most complexity)
- `src/components/LogForm.jsx` — universal workout log/edit form
- `src/utils/insights.js` — cross-training conflict detection
- `src/utils/adaptation.js` — adaptive planning engine
- `src/utils/readiness.js` — readiness score calculation
- `src/utils/prDetection.js` — PR detection across run and lift history
- `src/lib/supabase.js` — database client and queries
