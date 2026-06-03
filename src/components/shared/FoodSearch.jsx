'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Plus, Minus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// ── Rounding helpers ────────────────────────────────────────────────────────
const ri = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

// ── Parse grams from serving_size string e.g. "1 bar (45g)" ────────────────
function parseServingGrams(str) {
  if (!str) return null;
  const m = str.match(/\((\d+\.?\d*)\s*g\)/i);
  return m ? parseFloat(m[1]) : null;
}

// ── Normalize a raw OFF product into our schema ─────────────────────────────
function normalizeProduct(p) {
  if (!p.product_name?.trim()) return null;
  const n = p.nutriments || {};
  if (n['energy-kcal_100g'] == null) return null;

  const cal100      = ri(n['energy-kcal_100g']    || 0);
  const protein100  = r1(n.proteins_100g           || 0);
  const carbs100    = r1(n.carbohydrates_100g      || 0);
  const fat100      = r1(n.fat_100g                || 0);

  const servingSize = (p.serving_size || '').trim();
  let servingGrams  = typeof p.serving_quantity === 'number' ? p.serving_quantity : null;
  if (!servingGrams) servingGrams = parseServingGrams(servingSize);

  // Per-serving nutriments — prefer API values, fall back to calculation
  let calS, proteinS, carbsS, fatS;
  if (n['energy-kcal_serving'] != null) {
    calS     = ri(n['energy-kcal_serving']);
    proteinS = r1(n.proteins_serving        || 0);
    carbsS   = r1(n.carbohydrates_serving   || 0);
    fatS     = r1(n.fat_serving             || 0);
  } else if (servingGrams) {
    calS     = ri(cal100     * servingGrams / 100);
    proteinS = r1(protein100 * servingGrams / 100);
    carbsS   = r1(carbs100   * servingGrams / 100);
    fatS     = r1(fat100     * servingGrams / 100);
  }

  const hasServingData = calS != null;
  const servingLabel   = servingSize || (servingGrams ? `${servingGrams}g` : null);

  return {
    name:    p.product_name.trim(),
    brand:   (p.brands || '').split(',')[0].trim(),
    cal100, protein100, carbs100, fat100,
    calS, proteinS, carbsS, fatS,
    servingGrams: servingGrams || null,
    servingLabel,
    hasServingData,
    defaultCal:   hasServingData ? calS   : cal100,
    defaultLabel: hasServingData ? (servingLabel || 'per serving') : 'per 100g',
  };
}

async function queryOFF(q, signal) {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || []).map(normalizeProduct).filter(Boolean);
}

// Returns per-1-unit raw macros (unrounded by qty) for a given mode
function getBaseMacros(r, mode, customGrams) {
  if (mode === 'serving' && r.hasServingData) {
    return { cal: r.calS, protein: r.proteinS, carbs: r.carbsS, fat: r.fatS };
  }
  if (mode === '100g') {
    return { cal: r.cal100, protein: r.protein100, carbs: r.carbs100, fat: r.fat100 };
  }
  const g = Math.max(0, parseFloat(customGrams) || 0);
  return {
    cal:     r.cal100     * g / 100,
    protein: r.protein100 * g / 100,
    carbs:   r.carbs100   * g / 100,
    fat:     r.fat100     * g / 100,
  };
}

// ── Component ───────────────────────────────────────────────────────────────
export default function FoodSearch({ onSelect, mealLabel = 'Meal', entries = [] }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [apiError,    setApiError]    = useState(false);
  const [expanded,    setExpanded]    = useState(null);
  const [servingMode, setServingMode] = useState('100g');
  const [customGrams, setCustomGrams] = useState('100');
  const [qty,         setQty]         = useState(1);
  const [showCustom,  setShowCustom]  = useState(false);
  const [custom,      setCustom]      = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  const debounceRef = useRef(null);
  const abortRef    = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setApiError(false);
      setExpanded(null);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        const found = await queryOFF(q, abortRef.current.signal);
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

  // Top 8 recent foods by frequency from entries prop
  const recentFoods = useMemo(() => {
    if (!entries.length) return [];
    const byName = {};
    for (const e of entries) {
      if (!e.name) continue;
      if (!byName[e.name]) byName[e.name] = { ...e, count: 0 };
      byName[e.name].count++;
      byName[e.name] = { ...byName[e.name], ...e, count: byName[e.name].count };
    }
    return Object.values(byName).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [entries]);

  function handleExpand(i) {
    if (expanded === i) { setExpanded(null); return; }
    const r = results[i];
    setExpanded(i);
    setServingMode(r.hasServingData ? 'serving' : '100g');
    setCustomGrams(r.servingGrams ? String(r.servingGrams) : '100');
    setQty(1);
  }

  function handleAdd(r) {
    const base = getBaseMacros(r, servingMode, customGrams);

    let servingDescription;
    if (servingMode === 'serving') {
      const label = r.servingLabel || 'serving';
      servingDescription = qty > 1 ? `${qty} × ${label}` : label;
    } else if (servingMode === '100g') {
      servingDescription = qty > 1 ? `${qty * 100}g` : '100g';
    } else {
      const g = parseFloat(customGrams) || 100;
      servingDescription = qty > 1 ? `${qty} × ${g}g` : `${g}g`;
    }

    onSelect({
      name:               r.name,
      calories:           ri(base.cal     * qty),
      protein:            r1(base.protein * qty),
      carbs:              r1(base.carbs   * qty),
      fat:                r1(base.fat     * qty),
      servingDescription,
    });
  }

  function handleRecentSelect(e) {
    onSelect({
      name:               e.name,
      calories:           e.calories      || 0,
      protein:            e.protein       || 0,
      carbs:              e.carbs         || 0,
      fat:                e.fat           || 0,
      servingDescription: e.servingDescription || null,
    });
  }

  function handleAddCustom() {
    if (!custom.name || !custom.calories) return;
    onSelect({
      name:               custom.name,
      calories:           parseInt(custom.calories)   || 0,
      protein:            parseFloat(custom.protein)  || 0,
      carbs:              parseFloat(custom.carbs)    || 0,
      fat:                parseFloat(custom.fat)      || 0,
      servingDescription: null,
    });
    setCustom({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setShowCustom(false);
    setQuery('');
  }

  const hasQuery      = query.trim().length > 0;
  const showNoResults = hasQuery && !loading && results.length === 0 && !apiError;
  const showEmptyHint = !hasQuery && !loading && recentFoods.length < 2 && !showCustom;

  return (
    <div>
      {/* ── Recent food chips ── */}
      {recentFoods.length >= 2 && !hasQuery && (
        <div className="mb-3">
          <p className="bc-caption uppercase tracking-wider mb-1.5">Recent</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {recentFoods.map((food, i) => (
              <button key={i} onClick={() => handleRecentSelect(food)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-border rounded-full text-xs font-medium text-primary hover:bg-surface-alt transition-colors whitespace-nowrap min-h-[36px]">
                <span className="truncate max-w-[120px]">{food.name}</span>
                <span className="text-tertiary tabular-nums">{food.calories}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* ── States ── */}
      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 size={16} className="animate-spin text-bc-blue" />
          <p className="text-xs text-tertiary">Searching…</p>
        </div>
      )}

      {showEmptyHint && (
        <p className="text-center text-sm text-tertiary py-6">Search millions of foods from Open Food Facts</p>
      )}

      {showNoResults && !showCustom && (
        <div className="text-center py-4">
          <p className="text-sm text-secondary">No results for "{query}"</p>
          <p className="bc-caption mt-0.5">Try a different name, or add it manually below</p>
        </div>
      )}

      {apiError && (
        <p className="text-center text-xs text-secondary py-3">Can't reach food database — enter manually below</p>
      )}

      {/* ── Results ── */}
      {!loading && results.length > 0 && (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto mb-2">
          {results.map((r, i) => {
            const isOpen = expanded === i;
            const base   = isOpen ? getBaseMacros(r, servingMode, customGrams) : null;
            const dCal   = isOpen ? ri(base.cal     * qty) : null;
            const dPro   = isOpen ? r1(base.protein * qty) : null;
            const dCarb  = isOpen ? r1(base.carbs   * qty) : null;
            const dFat   = isOpen ? r1(base.fat     * qty) : null;

            return (
              <div key={i} className="bc-card !p-0 overflow-hidden">
                {/* Collapsed header */}
                <button
                  onClick={() => handleExpand(i)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-canvas transition-colors min-h-[52px]">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-primary truncate">{r.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {r.brand && (
                        <><span className="text-[10px] text-tertiary truncate max-w-[100px]">{r.brand}</span>
                        <span className="text-[10px] text-tertiary">·</span></>
                      )}
                      <span className="text-[10px] font-medium text-primary tabular-nums">{r.defaultCal} cal</span>
                      <span className="text-[10px] text-tertiary">·</span>
                      <span className="text-[10px] text-tertiary">{r.defaultLabel}</span>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp size={14} className="text-tertiary flex-shrink-0" />
                    : <ChevronDown size={14} className="text-tertiary flex-shrink-0" />}
                </button>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-canvas space-y-3">
                    {/* Serving mode toggle */}
                    <div className="flex rounded-[10px] border border-border overflow-hidden text-xs">
                      {r.hasServingData && (
                        <button
                          onClick={() => setServingMode('serving')}
                          className={`flex-1 py-2 font-semibold transition-colors min-h-[36px] ${servingMode === 'serving' ? 'bg-bc-blue text-white' : 'bg-canvas text-secondary'}`}>
                          Per serving
                        </button>
                      )}
                      <button
                        onClick={() => setServingMode('100g')}
                        className={`flex-1 py-2 font-semibold transition-colors min-h-[36px] border-l border-border ${servingMode === '100g' ? 'bg-bc-blue text-white' : 'bg-canvas text-secondary'} ${!r.hasServingData ? 'border-l-0' : ''}`}>
                        100g
                      </button>
                      <button
                        onClick={() => setServingMode('custom')}
                        className={`flex-1 py-2 font-semibold transition-colors min-h-[36px] border-l border-border ${servingMode === 'custom' ? 'bg-bc-blue text-white' : 'bg-canvas text-secondary'}`}>
                        Custom
                      </button>
                    </div>

                    {/* Serving label hint */}
                    {servingMode === 'serving' && r.servingLabel && (
                      <p className="text-[10px] text-tertiary -mt-1">{r.servingLabel}</p>
                    )}

                    {/* Custom grams input */}
                    {servingMode === 'custom' && (
                      <div>
                        <label className="bc-caption uppercase tracking-wider block mb-1">Grams</label>
                        <input
                          type="number" min="0" value={customGrams}
                          onChange={e => setCustomGrams(e.target.value)}
                          className="bc-input bc-data"
                          style={{ fontSize: '16px' }}
                          placeholder="100"
                        />
                      </div>
                    )}

                    {/* Quantity stepper */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-secondary">Quantity</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQty(q => Math.max(1, q - 1))}
                          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-secondary hover:bg-surface-alt transition-colors">
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold tabular-nums w-5 text-center">{qty}</span>
                        <button onClick={() => setQty(q => q + 1)}
                          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-secondary hover:bg-surface-alt transition-colors">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Macro summary row */}
                    <div className="flex items-center justify-between px-1 py-2 bg-white rounded-[10px] border border-border/50">
                      <div className="text-center flex-1">
                        <p className="text-base font-bold text-primary tabular-nums">{dCal}</p>
                        <p className="text-[9px] text-tertiary">cal</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center flex-1">
                        <p className="text-sm font-semibold tabular-nums" style={{ color: '#5856D6' }}>{dPro}g</p>
                        <p className="text-[9px] text-tertiary">protein</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center flex-1">
                        <p className="text-sm font-semibold tabular-nums text-bc-orange-dark">{dCarb}g</p>
                        <p className="text-[9px] text-tertiary">carbs</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center flex-1">
                        <p className="text-sm font-semibold tabular-nums text-bc-green-dark">{dFat}g</p>
                        <p className="text-[9px] text-tertiary">fat</p>
                      </div>
                    </div>

                    <button onClick={() => handleAdd(r)} className="bc-btn-primary w-full min-h-[44px] text-sm">
                      Add to {mealLabel}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add custom food ── */}
      {!loading && (
        <>
          <div className="border-t border-border mt-2 pt-2">
            <button onClick={() => setShowCustom(v => !v)}
              className="flex items-center gap-1.5 text-xs text-bc-blue hover:opacity-70 transition-opacity min-h-[40px]">
              {showCustom ? <ChevronUp size={12} /> : <Plus size={12} />}
              Add custom food
            </button>
          </div>
          {showCustom && (
            <div className="mt-2 space-y-2">
              <input type="text" value={custom.name}
                onChange={e => setCustom(p => ({ ...p, name: e.target.value }))}
                placeholder="Food name" className="bc-input" style={{ fontSize: '16px' }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={custom.calories}
                  onChange={e => setCustom(p => ({ ...p, calories: e.target.value }))}
                  placeholder="Calories *" className="bc-input bc-data" style={{ fontSize: '16px' }} />
                <input type="number" value={custom.protein}
                  onChange={e => setCustom(p => ({ ...p, protein: e.target.value }))}
                  placeholder="Protein (g)" className="bc-input bc-data" style={{ fontSize: '16px' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={custom.carbs}
                  onChange={e => setCustom(p => ({ ...p, carbs: e.target.value }))}
                  placeholder="Carbs (g)" className="bc-input bc-data" style={{ fontSize: '16px' }} />
                <input type="number" value={custom.fat}
                  onChange={e => setCustom(p => ({ ...p, fat: e.target.value }))}
                  placeholder="Fat (g)" className="bc-input bc-data" style={{ fontSize: '16px' }} />
              </div>
              <button onClick={handleAddCustom} disabled={!custom.name || !custom.calories}
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
