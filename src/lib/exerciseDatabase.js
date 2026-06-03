import { EXERCISE_LIBRARY } from '@/data/exercises';

const CACHE_KEY = 'bc-exercises-cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let _loaded = null;
let _fetchPromise = null;

function refineMuscleGroup(wgerCategory, muscles, musclesSecondary) {
  const all = [...muscles, ...musclesSecondary].join(' ').toLowerCase();
  switch (wgerCategory) {
    case 'Abs':       return 'Core';
    case 'Back':      return 'Back';
    case 'Calves':    return 'Calves';
    case 'Chest':     return 'Chest';
    case 'Shoulders': return 'Shoulders';
    case 'Arms':
      if (all.includes('tricep')) return 'Triceps';
      return 'Biceps';
    case 'Legs':
      if (all.includes('hamstring') || all.includes('biceps femoris') || all.includes('semitendinosus')) return 'Hamstrings';
      if (all.includes('glute')) return 'Glutes';
      if (all.includes('gastrocnemius') || all.includes('soleus')) return 'Calves';
      return 'Quads';
    default:
      return 'Full Body';
  }
}

const EQUIPMENT_MAP = {
  'Barbell':       'Barbell',
  'SZ-Bar':        'Barbell',
  'Dumbbell':      'Dumbbell',
  'Kettlebell':    'Kettlebell',
  'Pull-up bar':   'Bodyweight',
  'Gym mat':       'Bodyweight',
  'None':          'Bodyweight',
  'Bench':         'Other',
  'Incline bench': 'Other',
  'Swiss Ball':    'Other',
};

function normalizeExercise(item) {
  const enTrans = (item.translations || []).find(t => t.language === 2);
  if (!enTrans?.name?.trim()) return null;

  const name = enTrans.name.trim();
  const wgerCategory = item.category?.name || '';
  const muscles = (item.muscles || []).map(m => m.name_en).filter(Boolean);
  const musclesSecondary = (item.muscles_secondary || []).map(m => m.name_en).filter(Boolean);
  const equipmentNames = (item.equipment || []).map(e => e.name);

  const muscleGroup = refineMuscleGroup(wgerCategory, muscles, musclesSecondary);

  let equipment = 'Other';
  for (const eq of equipmentNames) {
    if (EQUIPMENT_MAP[eq]) { equipment = EQUIPMENT_MAP[eq]; break; }
  }
  if (equipmentNames.length === 0) equipment = 'Bodyweight';

  return {
    id: item.id,
    name,
    muscleGroup,
    equipment,
    category: wgerCategory,
    isBodyweight: equipment === 'Bodyweight',
    muscles,
    musclesSecondary,
  };
}

export async function fetchAllExercises() {
  const PAGE_SIZE = 100;
  const makeUrl = (offset) =>
    `https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=${PAGE_SIZE}&offset=${offset}`;

  const firstRes = await fetch(makeUrl(0));
  if (!firstRes.ok) throw new Error(`wger HTTP ${firstRes.status}`);
  const firstData = await firstRes.json();
  const total = firstData.count;

  const pages = [firstData];

  if (total > PAGE_SIZE) {
    const offsets = [];
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset);
    const rest = await Promise.all(offsets.map(async offset => {
      const res = await fetch(makeUrl(offset));
      if (!res.ok) throw new Error(`wger HTTP ${res.status}`);
      return res.json();
    }));
    pages.push(...rest);
  }

  return pages.flatMap(p => p.results.map(normalizeExercise).filter(Boolean));
}

export async function getExerciseDatabase() {
  if (_loaded) return _loaded;
  if (_fetchPromise) return _fetchPromise;

  let cache = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) cache = JSON.parse(raw);
    } catch {}
  }

  if (cache?.exercises?.length && (Date.now() - (cache.cachedAt || 0)) < CACHE_TTL_MS) {
    _loaded = cache.exercises;
    return _loaded;
  }

  const staleCache = cache?.exercises?.length ? cache.exercises : null;

  _fetchPromise = fetchAllExercises()
    .then(exercises => {
      _loaded = exercises;
      _fetchPromise = null;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ exercises, cachedAt: Date.now() }));
        } catch {}
      }
      return exercises;
    })
    .catch(err => {
      console.warn('[BaseCamp] Exercise DB fetch failed:', err.message);
      _fetchPromise = null;
      _loaded = staleCache || EXERCISE_LIBRARY;
      return _loaded;
    });

  return _fetchPromise;
}

// Sorted: exact match → starts-with → recently used → contains → word match
export function searchExercises(query, filters = {}) {
  const db = _loaded || EXERCISE_LIBRARY;
  const { muscleGroup, equipment, recentNames } = filters;
  const q = (query || '').toLowerCase().trim();
  const words = q ? q.split(/\s+/).filter(Boolean) : [];

  const scored = [];
  for (const ex of db) {
    if (muscleGroup && ex.muscleGroup !== muscleGroup) continue;
    if (equipment && ex.equipment !== equipment) continue;

    const nameLower = ex.name.toLowerCase();
    let matchScore = 0;

    if (words.length) {
      const allWords = words.every(w => nameLower.includes(w));
      const anyWord  = words.some(w => nameLower.includes(w));
      if (!allWords && !anyWord) continue;

      if (nameLower === q)           matchScore = 1000;
      else if (nameLower.startsWith(q)) matchScore = 100;
      else if (nameLower.includes(q))   matchScore = 10;
      else if (allWords)                matchScore = 8;
      else                              matchScore = 1;
    }

    const recentScore = recentNames?.has(ex.name) ? 5 : 0;
    scored.push({ ex, score: matchScore + recentScore });
  }

  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored.slice(0, 30).map(r => r.ex);
}
