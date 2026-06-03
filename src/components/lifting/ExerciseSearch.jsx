'use client';

/**
 * ExerciseSearch v2
 * 
 * - High-contrast search input with clear placeholder
 * - Muscle group filter pills
 * - Equipment filter
 * - Shows last used weight/reps from history as preview
 * - Keyboard accessible
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { getExerciseDatabase, searchExercises } from '@/lib/exerciseDatabase';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '@/data/exercises';

const GROUP_COLORS = {
  'Chest':      { bg: '#FFF3E0', text: '#E65100', dot: '#FF9500' },
  'Back':       { bg: '#E3F2FD', text: '#1565C0', dot: '#007AFF' },
  'Shoulders':  { bg: '#F3E5F5', text: '#6A1B9A', dot: '#AF52DE' },
  'Biceps':     { bg: '#E8F5E9', text: '#2E7D32', dot: '#34C759' },
  'Triceps':    { bg: '#E8F5E9', text: '#1B5E20', dot: '#30D158' },
  'Quads':      { bg: '#FCE4EC', text: '#880E4F', dot: '#FF2D55' },
  'Hamstrings': { bg: '#FCE4EC', text: '#AD1457', dot: '#FF375F' },
  'Glutes':     { bg: '#FBE9E7', text: '#BF360C', dot: '#FF6B35' },
  'Calves':     { bg: '#F1F8E9', text: '#33691E', dot: '#7CB342' },
  'Core':       { bg: '#FFF8E1', text: '#F57F17', dot: '#FFCC00' },
  'Full Body':  { bg: '#E8EAF6', text: '#283593', dot: '#5856D6' },
};

export default function ExerciseSearch({ onSelect, placeholder = 'Search exercises...', workoutHistory = [] }) {
  const [query,          setQuery]          = useState('');
  const [open,           setOpen]           = useState(false);
  const [groupFilter,    setGroupFilter]    = useState('');
  const [equipFilter,    setEquipFilter]    = useState('');
  const [showFilters,    setShowFilters]    = useState(false);
  const [focusedIdx,     setFocusedIdx]     = useState(-1);
  const [dbLoading,      setDbLoading]      = useState(true);
  const [dbLoaded,       setDbLoaded]       = useState(false);

  const inputRef     = useRef(null);
  const dropdownRef  = useRef(null);

  // Load the wger exercise database on mount (uses cache after first fetch)
  useEffect(() => {
    getExerciseDatabase()
      .then(() => { setDbLoaded(true); setDbLoading(false); })
      .catch(() => setDbLoading(false));
  }, []);

  // Build recent exercise map from history
  const recentMap = useMemo(() => {
    const map = {};
    if (!workoutHistory?.length) return map;
    [...workoutHistory]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(w => {
        if (w.type !== 'lift' || w.status !== 'completed') return;
        (w.details?.exercises || []).forEach(ex => {
          if (map[ex.name]) return; // already have most recent
          const sets = Array.isArray(ex.sets) ? ex.sets.filter(s => s.completed && s.weight && s.reps) : [];
          if (sets.length) {
            const avgW = Math.round(sets.reduce((s, set) => s + Number(set.weight), 0) / sets.length);
            const avgR = Math.round(sets.reduce((s, set) => s + Number(set.reps),   0) / sets.length);
            map[ex.name] = { weight: avgW, reps: avgR, date: w.date };
          }
        });
      });
    return map;
  }, [workoutHistory]);

  const recentNames = useMemo(() => new Set(Object.keys(recentMap)), [recentMap]);

  // searchExercises handles sorting: exact → starts-with → recently used → contains
  const sortedResults = useMemo(() =>
    searchExercises(query, {
      muscleGroup: groupFilter || undefined,
      equipment:   equipFilter || undefined,
      recentNames,
    }),
  // dbLoaded is a trigger: forces re-search once the wger DB is ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, groupFilter, equipFilter, recentNames, dbLoaded]);

  function handleSelect(exercise) {
    onSelect(exercise);
    setQuery('');
    setOpen(false);
    setFocusedIdx(-1);
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, sortedResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); handleSelect(sortedResults[focusedIdx]); }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (!dropdownRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeFilters = (groupFilter ? 1 : 0) + (equipFilter ? 1 : 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Search input ── */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setFocusedIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-20 py-3 rounded-[12px] text-sm text-primary
                     bg-white border-2 border-border focus:border-bc-blue
                     outline-none transition-colors placeholder:text-[#AEAEB2]"
          style={{ fontSize: '16px' }} // prevent iOS zoom
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="w-6 h-6 rounded-full bg-bc-gray flex items-center justify-center">
              <X size={12} className="text-secondary" />
            </button>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-0.5 px-2 py-1 rounded-[8px] text-xs font-semibold transition-colors
              ${activeFilters > 0 ? 'bg-bc-blue text-white' : 'bg-canvas text-secondary hover:text-primary'}`}>
            <ChevronDown size={12} className={showFilters ? 'rotate-180 transition-transform' : 'transition-transform'} />
            {activeFilters > 0 ? activeFilters : 'Filter'}
          </button>
        </div>
      </div>

      {/* ── Database hint ── */}
      {!query && (
        <p className="text-[10px] text-tertiary mt-1 ml-1">
          {dbLoading ? 'Loading exercise database…' : '~900 exercises available'}
        </p>
      )}

      {/* ── Filter pills ── */}
      {showFilters && (
        <div className="mt-2 p-3 bg-canvas rounded-[12px] border border-border space-y-2">
          {/* Muscle groups */}
          <div>
            <p className="bc-caption uppercase tracking-wider mb-1.5">Muscle Group</p>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map(g => {
                const colors = GROUP_COLORS[g] || {};
                const active = groupFilter === g;
                return (
                  <button key={g} onClick={() => setGroupFilter(active ? '' : g)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={{
                      background: active ? (colors.dot || '#007AFF') : (colors.bg || '#F2F2F7'),
                      color:      active ? '#fff' : (colors.text || '#3C3C43'),
                    }}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Equipment */}
          <div>
            <p className="bc-caption uppercase tracking-wider mb-1.5">Equipment</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_TYPES.map(eq => (
                <button key={eq} onClick={() => setEquipFilter(equipFilter === eq ? '' : eq)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all
                    ${equipFilter === eq ? 'bg-primary text-white' : 'bg-surface border border-border text-secondary'}`}>
                  {eq}
                </button>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setGroupFilter(''); setEquipFilter(''); }}
              className="text-[11px] text-bc-red font-medium">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Results dropdown ── */}
      {open && sortedResults.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-border rounded-[14px] shadow-xl z-50 overflow-hidden"
          style={{ maxHeight: 320 }}>
          <div className="overflow-y-auto" style={{ maxHeight: 320 }}>

            {/* Recent section header */}
            {sortedResults.some(r => recentMap[r.name]) && (
              <div className="px-3 pt-2 pb-1">
                <p className="bc-caption uppercase tracking-wider text-tertiary">Recently Used</p>
              </div>
            )}

            {sortedResults.map((ex, i) => {
              const hist    = recentMap[ex.name];
              const colors  = GROUP_COLORS[ex.muscleGroup] || {};
              const isFocused = i === focusedIdx;
              const isFirstNonRecent = !hist && i > 0 && recentMap[sortedResults[i-1]?.name];

              return (
                <>
                  {isFirstNonRecent && (
                    <div key={`sep-${i}`} className="px-3 pt-2 pb-1 border-t border-border">
                      <p className="bc-caption uppercase tracking-wider text-tertiary">All Exercises</p>
                    </div>
                  )}
                  <button
                    key={ex.name}
                    onClick={() => handleSelect(ex)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                      ${isFocused ? 'bg-bc-blue-light/50' : 'hover:bg-canvas'}`}>
                    {/* Muscle group dot */}
                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: colors.bg || '#F2F2F7' }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: colors.dot || '#AEAEB2' }} />
                    </div>
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{ex.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px]" style={{ color: colors.text || '#8E8E93' }}>{ex.muscleGroup}</span>
                        <span className="text-[10px] text-tertiary">·</span>
                        <span className="text-[10px] text-tertiary">{ex.equipment}</span>
                      </div>
                    </div>
                    {/* History preview */}
                    {hist && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] font-semibold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {hist.weight} × {hist.reps}
                        </p>
                        <p className="text-[9px] text-tertiary">last session</p>
                      </div>
                    )}
                  </button>
                </>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {open && query && sortedResults.length === 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-border rounded-[14px] shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-secondary">No exercises found for "{query}"</p>
          <p className="bc-caption mt-1">Try a different name or muscle group</p>
        </div>
      )}
    </div>
  );
}