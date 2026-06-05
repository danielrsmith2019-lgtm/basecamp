/**
 * Returns the top 8 most-frequently-logged foods from the given entries array,
 * sorted by count desc. Each entry must have a `date` (YYYY-MM-DD) field.
 * Looks back up to 14 days from today.
 *
 * @param {Array} entries - Meal entries with { name, calories, protein, carbs, fat, date, ... }
 * @returns {Array} Up to 8 food objects with most-recent macro values
 */
export function getRecentFoods(entries) {
  if (!entries || entries.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const countMap = {};

  for (const entry of entries) {
    if (!entry.name) continue;
    if (entry.date && entry.date < cutoffStr) continue;

    if (!countMap[entry.name]) {
      countMap[entry.name] = { count: 0, latest: entry };
    }
    countMap[entry.name].count++;
    if (!countMap[entry.name].latest.date || (entry.date || '') >= countMap[entry.name].latest.date) {
      countMap[entry.name].latest = entry;
    }
  }

  return Object.values(countMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(({ latest }) => ({
      name:        latest.name,
      calories:    latest.calories    || 0,
      protein:     latest.protein     || 0,
      carbs:       latest.carbs       || 0,
      fat:         latest.fat         || 0,
      servingSize: latest.servingSize || null,
      servingUnit: latest.servingUnit || null,
    }));
}
