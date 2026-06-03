'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

function scaleNutrient(per100, serving) {
  if (!per100 || !serving) return 0;
  return Math.round((per100 * serving) / 100);
}

async function queryOpenFoodFacts(q, signal) {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || [])
    .filter(p => p.product_name?.trim() && p.nutriments?.['energy-kcal_100g'] != null)
    .map(p => ({
      name:      p.product_name.trim(),
      brand:     (p.brands || '').split(',')[0].trim(), // first brand only
      cal100:    Math.round(p.nutriments['energy-kcal_100g']    || 0),
      protein100: Math.round(p.nutriments.proteins_100g         || 0),
      carbs100:   Math.round(p.nutriments.carbohydrates_100g    || 0),
      fat100:     Math.round(p.nutriments.fat_100g              || 0),
    }));
}

export default function FoodSearch({ onSelect }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [apiError,   setApiError]   = useState(false);
  const [expanded,   setExpanded]   = useState(null); // index of open result card
  const [serving,    setServing]    = useState('100');
  const [showCustom, setShowCustom] = useState(false);
  const [custom,     setCustom]     = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  const debounceRef = useRef(null);
  const abortRef    = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setApiError(false);
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const found = await queryOpenFoodFacts(q, abortRef.current.signal);
        setResults(found);
        setApiError(false);
        setExpanded(null);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('[BaseCamp] Food search failed:', err.message);
        setApiError(true);
        setResults([]);
        setShowCustom(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleExpand(i) {
    setExpanded(expanded === i ? null : i);
    setServing('100');
  }

  function handleAdd(result) {
    const s = Math.max(0, parseFloat(serving) || 100);
    onSelect({
      name:        result.name + (result.brand ? ` (${result.brand})` : ''),
      calories:    scaleNutrient(result.cal100,     s),
      protein:     scaleNutrient(result.protein100, s),
      carbs:       scaleNutrient(result.carbs100,   s),
      fat:         scaleNutrient(result.fat100,      s),
      servingSize: s,
      servingUnit: 'g',
    });
  }

  function handleAddCustom() {
    if (!custom.name || !custom.calories) return;
    onSelect({
      name:        custom.name,
      calories:    parseInt(custom.calories) || 0,
      protein:     parseInt(custom.protein)  || 0,
      carbs:       parseInt(custom.carbs)    || 0,
      fat:         parseInt(custom.fat)      || 0,
      servingSize: 1,
      servingUnit: 'serving',
    });
    setCustom({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setShowCustom(false);
    setQuery('');
  }

  const hasQuery      = query.trim().length > 0;
  const showEmpty     = !hasQuery && !loading;
  const showNoResults = hasQuery && !loading && results.length === 0 && !apiError;

  return (
    <div>
      {/* ── Search input ── */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search any food…"
          className="bc-input !pl-8 !pr-8"
          style={{ fontSize: '16px' }}
        />
        {hasQuery && (
          <button
            onClick={() => { setQuery(''); setResults([]); setApiError(false); setShowCustom(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-bc-gray flex items-center justify-center">
            <X size={12} className="text-secondary" />
          </button>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 size={16} className="animate-spin text-bc-blue" />
          <p className="text-xs text-tertiary">Searching…</p>
        </div>
      )}

      {/* ── Empty state (before typing) ── */}
      {showEmpty && !showCustom && (
        <p className="text-center text-sm text-tertiary py-6">
          Search millions of foods from Open Food Facts
        </p>
      )}

      {/* ── No results ── */}
      {showNoResults && !showCustom && (
        <div className="text-center py-4">
          <p className="text-sm text-secondary">No results for "{query}"</p>
          <p className="bc-caption mt-0.5">Try a different name, or add it manually below</p>
        </div>
      )}

      {/* ── API error notice ── */}
      {apiError && (
        <div className="text-center py-3">
          <p className="text-xs text-secondary">Food database unavailable — enter manually below</p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && results.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto mb-2">
          {results.map((r, i) => {
            const isOpen = expanded === i;
            const s = Math.max(0, parseFloat(serving) || 100);
            return (
              <div key={i} className="bc-card !p-0 overflow-hidden">
                {/* Card header — tap to expand */}
                <button
                  onClick={() => handleExpand(i)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-canvas transition-colors min-h-[52px]">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-primary truncate">{r.name}</p>
                    {r.brand && <p className="text-[10px] text-tertiary truncate">{r.brand}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: '#5856D6' }}>{r.protein100}g P</span>
                      <span className="text-[10px] text-bc-orange-dark">{r.carbs100}g C</span>
                      <span className="text-[10px] text-bc-green-dark">{r.fat100}g F</span>
                      <span className="text-[10px] text-tertiary">per 100g</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary tabular-nums">{r.cal100}</p>
                      <p className="text-[9px] text-tertiary">cal/100g</p>
                    </div>
                    {isOpen
                      ? <ChevronUp size={14} className="text-tertiary" />
                      : <ChevronDown size={14} className="text-tertiary" />}
                  </div>
                </button>

                {/* Expanded — serving size + scaled macros + add button */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-canvas">
                    <div className="flex items-end gap-3 mb-3">
                      <div className="flex-1">
                        <label className="bc-caption uppercase tracking-wider block mb-1">Serving (g)</label>
                        <input
                          type="number"
                          value={serving}
                          onChange={e => setServing(e.target.value)}
                          className="bc-input bc-data"
                          min="1"
                          placeholder="100"
                        />
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="bc-caption uppercase tracking-wider mb-1">Totals</p>
                        <p className="text-base font-bold text-primary tabular-nums">
                          {scaleNutrient(r.cal100, s)} <span className="text-xs font-normal text-tertiary">cal</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px]" style={{ color: '#5856D6' }}>{scaleNutrient(r.protein100, s)}g P</span>
                          <span className="text-[10px] text-bc-orange-dark">{scaleNutrient(r.carbs100, s)}g C</span>
                          <span className="text-[10px] text-bc-green-dark">{scaleNutrient(r.fat100, s)}g F</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(r)}
                      className="bc-btn-primary w-full min-h-[44px] text-sm">
                      <Plus size={14} className="inline mr-1.5 -mt-0.5" />
                      Add {s}g
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add custom ── */}
      {!loading && (
        <>
          <div className="border-t border-border mt-2 pt-2">
            <button
              onClick={() => setShowCustom(v => !v)}
              className="flex items-center gap-1.5 text-xs text-bc-blue hover:opacity-70 transition-opacity min-h-[40px]">
              {showCustom ? <ChevronUp size={12} /> : <Plus size={12} />}
              Add custom food
            </button>
          </div>

          {showCustom && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={custom.name}
                onChange={e => setCustom(p => ({ ...p, name: e.target.value }))}
                placeholder="Food name"
                className="bc-input"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={custom.calories}
                  onChange={e => setCustom(p => ({ ...p, calories: e.target.value }))}
                  placeholder="Calories *" className="bc-input bc-data" />
                <input type="number" value={custom.protein}
                  onChange={e => setCustom(p => ({ ...p, protein: e.target.value }))}
                  placeholder="Protein (g)" className="bc-input bc-data" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={custom.carbs}
                  onChange={e => setCustom(p => ({ ...p, carbs: e.target.value }))}
                  placeholder="Carbs (g)" className="bc-input bc-data" />
                <input type="number" value={custom.fat}
                  onChange={e => setCustom(p => ({ ...p, fat: e.target.value }))}
                  placeholder="Fat (g)" className="bc-input bc-data" />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!custom.name || !custom.calories}
                className="bc-btn-primary w-full disabled:opacity-40 min-h-[44px] text-sm">
                Add Custom Food
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
