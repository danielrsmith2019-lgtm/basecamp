/**
 * BASECAMP — Multi-Sport PR Detection Engine
 * 
 * Scans all completed workouts and identifies personal records.
 * Running PRs: fastest pace by type, longest run, best by distance bracket.
 * Lifting PRs: estimated 1RM per exercise (Epley), best single set, highest volume session.
 * 
 * Returns PR objects that can be displayed and compared over time.
 */

import { parsePace } from '@/utils/runUtils';
import { calculateE1RM } from '@/utils/liftUtils';


// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

/**
 * Detects all PRs from the workout history.
 * Returns { running: RunningPR[], lifting: LiftingPR[], recent: PR[] }
 */
export function detectAllPRs(workouts) {
  const completedRuns = workouts.filter(w => w.type === 'run' && w.status === 'completed');
  const completedLifts = workouts.filter(w => w.type === 'lift' && w.status === 'completed');

  const running = detectRunningPRs(completedRuns);
  const lifting = detectLiftingPRs(completedLifts);

  // Combine and sort by date for "recent" list
  const all = [...running, ...lifting].sort((a, b) => b.date.localeCompare(a.date));

  return { running, lifting, recent: all.slice(0, 10) };
}


// ═══════════════════════════════════════════════════════
// RUNNING PR DETECTION
// ═══════════════════════════════════════════════════════

/**
 * @typedef {Object} RunningPR
 * @property {string} id
 * @property {string} sport - 'run'
 * @property {string} category - 'pace' | 'distance' | 'distance-bracket'
 * @property {string} label - Display label
 * @property {string} value - Display value
 * @property {string} detail - Additional context
 * @property {string} date - ISO date
 * @property {string} icon - Emoji
 */

function detectRunningPRs(runs) {
  if (runs.length === 0) return [];

  const prs = [];

  // ── 1. Fastest pace by run type ──
  const runTypes = ['Easy Run', 'Tempo', 'Long Run', 'Race'];
  runTypes.forEach(type => {
    const ofType = runs.filter(r =>
      r.details.runType === type && r.details.actualPace
    );
    if (ofType.length === 0) return;

    let fastest = null;
    let fastestDecimal = Infinity;

    ofType.forEach(r => {
      const decimal = parsePace(r.details.actualPace);
      if (decimal && decimal < fastestDecimal) {
        fastestDecimal = decimal;
        fastest = r;
      }
    });

    if (fastest) {
      prs.push({
        id: `run-pace-${type}`,
        sport: 'run',
        category: 'pace',
        label: `Fastest ${type}`,
        value: fastest.details.actualPace + '/mi',
        detail: `${fastest.details.actualDistance} mi`,
        date: fastest.date,
        icon: type === 'Race' ? '🏁' : type === 'Tempo' ? '🔥' : '🏃',
      });
    }
  });

  // ── 2. Longest run ──
  let longestRun = null;
  let longestDist = 0;

  runs.forEach(r => {
    const dist = r.details.actualDistance || 0;
    if (dist > longestDist) {
      longestDist = dist;
      longestRun = r;
    }
  });

  if (longestRun) {
    prs.push({
      id: 'run-longest',
      sport: 'run',
      category: 'distance',
      label: 'Longest Run',
      value: longestDist + ' mi',
      detail: longestRun.details.actualPace ? `@ ${longestRun.details.actualPace}` : '',
      date: longestRun.date,
      icon: null,
    });
  }

  // ── 3. Fastest by distance bracket ──
  const BRACKETS = [
    { label: '2 mi', min: 1.8, max: 2.2 },
    { label: '3 mi', min: 2.8, max: 3.2 },
    { label: '4 mi', min: 3.8, max: 4.2 },
    { label: '5 mi', min: 4.8, max: 5.5 },
    { label: '6 mi', min: 5.5, max: 6.5 },
    { label: '8 mi', min: 7.5, max: 8.5 },
    { label: '10 mi', min: 9.5, max: 10.5 },
    { label: '13.1 mi', min: 12.5, max: 14 },
  ];

  BRACKETS.forEach(bracket => {
    const inBracket = runs.filter(r => {
      const dist = r.details.actualDistance;
      return dist && dist >= bracket.min && dist <= bracket.max && r.details.actualPace;
    });

    if (inBracket.length === 0) return;

    let fastest = null;
    let fastestDecimal = Infinity;

    inBracket.forEach(r => {
      const decimal = parsePace(r.details.actualPace);
      if (decimal && decimal < fastestDecimal) {
        fastestDecimal = decimal;
        fastest = r;
      }
    });

    if (fastest) {
      prs.push({
        id: `run-bracket-${bracket.label}`,
        sport: 'run',
        category: 'distance-bracket',
        label: `Fastest ${bracket.label}`,
        value: fastest.details.actualPace + '/mi',
        detail: `${fastest.details.actualDistance} mi actual`,
        date: fastest.date,
        icon: null,
      });
    }
  });

  // ── 4. Best performance index (lower pace × longer distance = harder) ──
  let bestPI = null;
  let bestPIScore = 0;

  runs.forEach(r => {
    const dist = r.details.actualDistance;
    const pace = parsePace(r.details.actualPace);
    if (!dist || !pace || dist < 2) return;

    // Performance index: distance / pace (higher = better)
    // A 10mi run at 8:00 pace = 10/8 = 1.25
    // A 3mi run at 7:00 pace = 3/7 = 0.43
    const score = dist / pace;
    if (score > bestPIScore) {
      bestPIScore = score;
      bestPI = r;
    }
  });

  if (bestPI) {
    prs.push({
      id: 'run-performance-index',
      sport: 'run',
      category: 'performance',
      label: 'Best Performance',
      value: `${bestPI.details.actualDistance} mi @ ${bestPI.details.actualPace}`,
      detail: 'Distance × speed composite',
      date: bestPI.date,
      icon: null,
    });
  }

  return prs;
}


// ═══════════════════════════════════════════════════════
// LIFTING PR DETECTION
// ═══════════════════════════════════════════════════════

/**
 * @typedef {Object} LiftingPR
 * @property {string} id
 * @property {string} sport - 'lift'
 * @property {string} category - 'e1rm' | 'set' | 'volume'
 * @property {string} label
 * @property {string} value
 * @property {string} detail
 * @property {string} date
 * @property {string} icon
 */

function detectLiftingPRs(lifts) {
  if (lifts.length === 0) return [];

  const prs = [];

  // ── 1. Estimated 1RM per exercise ──
  const exerciseBests = {}; // { exerciseName: { e1rm, weight, reps, date } }

  lifts.forEach(session => {
    (session.details.exercises || []).forEach(exercise => {
      if (!Array.isArray(exercise.sets)) return;
      exercise.sets.forEach(set => {
        if (!set.completed || !set.weight || !set.reps) return;

        const e1rm = calculateE1RM(set.weight, set.reps);
        const key = exercise.name;

        if (!exerciseBests[key] || e1rm > exerciseBests[key].e1rm) {
          exerciseBests[key] = {
            e1rm,
            weight: set.weight,
            reps: set.reps,
            date: session.date,
            muscleGroup: exercise.muscleGroup,
          };
        }
      });
    });
  });

  Object.entries(exerciseBests).forEach(([name, best]) => {
    prs.push({
      id: `lift-e1rm-${name.replace(/\s+/g, '-').toLowerCase()}`,
      sport: 'lift',
      category: 'e1rm',
      label: name,
      value: `${best.e1rm} lbs e1RM`,
      detail: `${best.weight} × ${best.reps} actual`,
      date: best.date,
      icon: null,
      muscleGroup: best.muscleGroup,
    });
  });

  // ── 2. Best single set (heaviest weight) per exercise ──
  const heaviestSets = {};

  lifts.forEach(session => {
    (session.details.exercises || []).forEach(exercise => {
      if (!Array.isArray(exercise.sets)) return;
      exercise.sets.forEach(set => {
        if (!set.completed || !set.weight) return;

        const key = exercise.name;
        if (!heaviestSets[key] || set.weight > heaviestSets[key].weight) {
          heaviestSets[key] = {
            weight: set.weight,
            reps: set.reps,
            date: session.date,
          };
        }
      });
    });
  });

  // Only add if different from e1RM (avoid duplicate for same exercise)
  Object.entries(heaviestSets).forEach(([name, best]) => {
    const e1rmEntry = exerciseBests[name];
    // Skip if the heaviest set IS the e1RM set
    if (e1rmEntry && e1rmEntry.weight === best.weight && e1rmEntry.reps === best.reps) return;

    prs.push({
      id: `lift-heavy-${name.replace(/\s+/g, '-').toLowerCase()}`,
      sport: 'lift',
      category: 'set',
      label: `${name} (Heaviest)`,
      value: `${best.weight} lbs × ${best.reps}`,
      detail: 'Heaviest single set',
      date: best.date,
      icon: null,
    });
  });

  // ── 3. Highest volume session ──
  let bestVolumeSession = null;
  let bestVolume = 0;

  lifts.forEach(session => {
    const vol = session.details.totalVolume || 0;
    if (vol > bestVolume) {
      bestVolume = vol;
      bestVolumeSession = session;
    }
  });

  if (bestVolumeSession) {
    prs.push({
      id: 'lift-volume-record',
      sport: 'lift',
      category: 'volume',
      label: 'Highest Volume Session',
      value: bestVolume.toLocaleString() + ' lbs',
      detail: bestVolumeSession.details.sessionName || 'Workout',
      date: bestVolumeSession.date,
      icon: null,
    });
  }

  return prs;
}


// ═══════════════════════════════════════════════════════
// CHECK FOR NEW PRs (compare before/after a log)
// ═══════════════════════════════════════════════════════

/**
 * Compares PR lists before and after a new workout to find new records.
 * Returns an array of newly achieved PRs.
 * 
 * Usage:
 *   const before = detectAllPRs(workoutsBefore);
 *   const after = detectAllPRs([...workoutsBefore, newWorkout]);
 *   const newPRs = findNewPRs(before, after);
 */
export function findNewPRs(beforePRs, afterPRs) {
  const beforeMap = new Map();

  [...beforePRs.running, ...beforePRs.lifting].forEach(pr => {
    beforeMap.set(pr.id, pr.value);
  });

  const newPRs = [];

  [...afterPRs.running, ...afterPRs.lifting].forEach(pr => {
    const oldValue = beforeMap.get(pr.id);
    if (!oldValue || oldValue !== pr.value) {
      newPRs.push({
        ...pr,
        isNew: true,
        previousValue: oldValue || null,
      });
    }
  });

  return newPRs;
}