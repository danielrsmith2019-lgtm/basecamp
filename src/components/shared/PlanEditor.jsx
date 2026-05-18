'use client';

/**
 * PlanEditor — AI-powered plan editing.
 *
 * Shows the current plan and lets the user ask Claude to modify it.
 * Claude returns structured suggestions (swap a day, reduce mileage, etc.)
 * that can be accepted or rejected before being applied.
 */

import { useState, useRef } from 'react';
import { Sparkles, Loader2, Check, X, ChevronDown, ChevronUp, Send } from 'lucide-react';

const QUICK_EDITS = [
  { label: 'Too much volume this week', prompt: 'The volume feels too high this week. Suggest how to reduce it without losing training effect.' },
  { label: 'Swap a run day', prompt: 'I need to move my run to a different day this week. What\'s the best option given my schedule?' },
  { label: 'I\'m feeling overtrained', prompt: 'I\'m feeling overtrained and run down. Suggest recovery adjustments for the next 1-2 weeks.' },
  { label: 'Add more intensity', prompt: 'I want to add more intensity. Where can we safely add harder sessions without overtraining?' },
  { label: 'I missed a week', prompt: 'I missed an entire week of training. How should I adjust the plan to get back on track?' },
  { label: 'Race is closer than planned', prompt: 'My race is sooner than my plan accounts for. How should we adjust the taper and peak weeks?' },
];

export default function PlanEditor({ plan, onPlanUpdate, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  async function askClaude(userPrompt) {
    if (!userPrompt.trim()) return;
    setLoading(true);
    setError(null);
    setPrompt('');

    const message = { role: 'user', text: userPrompt, timestamp: Date.now() };
    setHistory(prev => [...prev, message]);

    try {
      const res = await fetch('/api/edit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, plan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get suggestions');
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setHistory(prev => [...prev, {
        role: 'assistant',
        text: data.explanation,
        suggestions: data.suggestions,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function acceptSuggestion(suggestion) {
    // Apply the suggestion to the plan
    const updatedPlan = applySuggestion(plan, suggestion);
    onPlanUpdate(updatedPlan);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    setHistory(prev => [...prev, {
      role: 'system',
      text: `✓ Applied: ${suggestion.title}`,
      timestamp: Date.now(),
    }]);
  }

  function rejectSuggestion(suggestionId) {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        background: 'var(--color-surface, #fff)',
        borderRadius: '24px 24px 0 0',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-bc-indigo-light flex items-center justify-center">
              <Sparkles size={16} className="text-bc-indigo" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">AI Plan Editor</p>
              <p className="bc-caption">Exercise science based suggestions to modify your plan</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Conversation + suggestions */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Welcome state */}
          {history.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-secondary mb-4">
                Describe what you want to change and I&apos;ll suggest specific adjustments backed by training science.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_EDITS.map(q => (
                  <button key={q.label} onClick={() => askClaude(q.prompt)}
                    className="w-full text-left px-4 py-3 rounded-[12px] border border-border bg-canvas
                               hover:border-bc-indigo/40 hover:bg-bc-indigo-light/20 transition-all text-sm text-secondary">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation history */}
          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'system' ? (
                <div className="w-full px-3 py-2 bg-bc-green-light rounded-[10px] text-xs text-bc-green-dark font-medium">
                  {msg.text}
                </div>
              ) : (
                <div className={`max-w-[85%] px-4 py-3 rounded-[16px] text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-bc-indigo text-white rounded-br-[4px]'
                    : 'bg-canvas border border-border text-primary rounded-bl-[4px]'}`}>
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-[16px] bg-canvas border border-border rounded-bl-[4px] flex items-center gap-2">
                <Loader2 size={14} className="text-bc-indigo animate-spin" />
                <span className="text-sm text-secondary">Analyzing your plan…</span>
              </div>
            </div>
          )}

          {/* Pending suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="bc-caption uppercase tracking-wider">Suggested Changes</p>
              {suggestions.map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => acceptSuggestion(suggestion)}
                  onReject={() => rejectSuggestion(suggestion.id)}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-bc-red-light border border-bc-red/20 rounded-[12px]">
              <p className="text-bc-red-dark text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          {/* Quick edits if conversation started */}
          {history.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
              {QUICK_EDITS.slice(0, 3).map(q => (
                <button key={q.label} onClick={() => askClaude(q.prompt)} disabled={loading}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border text-xs text-secondary
                             hover:border-bc-indigo/40 hover:text-bc-indigo transition-all whitespace-nowrap disabled:opacity-40">
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && askClaude(prompt)}
              placeholder="e.g. reduce mileage week 3, I have a work trip…"
              disabled={loading}
              className="bc-input flex-1 !py-2.5"
            />
            <button
              onClick={() => askClaude(prompt)}
              disabled={!prompt.trim() || loading}
              className="w-10 h-10 rounded-[10px] bg-bc-indigo flex items-center justify-center
                         disabled:opacity-30 transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function SuggestionCard({ suggestion, onAccept, onReject }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors = {
    reduce:  { border: 'border-bc-orange/30', bg: 'bg-bc-orange-light', text: 'text-bc-orange-dark' },
    increase:{ border: 'border-run-accent/30', bg: 'bg-run-bg', text: 'text-run-accent' },
    swap:    { border: 'border-bc-blue/30', bg: 'bg-bc-blue-light', text: 'text-bc-blue-dark' },
    add:     { border: 'border-bc-green/30', bg: 'bg-bc-green-light', text: 'text-bc-green-dark' },
    remove:  { border: 'border-bc-red/30', bg: 'bg-bc-red-light', text: 'text-bc-red-dark' },
    modify:  { border: 'border-bc-indigo/30', bg: 'bg-bc-indigo-light', text: 'text-bc-indigo-dark' },
  };
  const colors = typeColors[suggestion.type] || typeColors.modify;

  return (
    <div className={`bc-card-flush border-l-4 ${colors.border}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${colors.bg} ${colors.text} flex-shrink-0 mt-0.5`}>
            {suggestion.type}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">{suggestion.title}</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">{suggestion.description}</p>

            {/* What changes */}
            {suggestion.changes?.length > 0 && (
              <div className="mt-2 space-y-1">
                {suggestion.changes.map((change, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-tertiary flex-shrink-0 mt-0.5">→</span>
                    <span className="text-secondary">{change}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Science toggle */}
            {suggestion.science && (
              <button onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-2 bc-caption hover:text-secondary transition-colors">
                {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {expanded ? 'Hide' : 'Why?'}
              </button>
            )}
            {expanded && suggestion.science && (
              <div className="mt-2 p-3 bg-canvas rounded-[10px]">
                <p className="text-[11px] text-secondary leading-relaxed italic">{suggestion.science}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex border-t border-border">
        <button onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                     text-bc-green-dark hover:bg-bc-green-light/50 transition-colors">
          <Check size={12} /> Apply
        </button>
        <div className="w-px bg-border" />
        <button onClick={onReject}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                     text-tertiary hover:text-bc-red-dark hover:bg-bc-red-light/50 transition-colors">
          <X size={12} /> Skip
        </button>
      </div>
    </div>
  );
}


// ── Helper: apply a suggestion's data changes to the plan ──
function applySuggestion(plan, suggestion) {
  if (!suggestion.planMutations) return plan;
  const updated = JSON.parse(JSON.stringify(plan));

  for (const mutation of suggestion.planMutations) {
    const week = updated.weeks.find(w => w.weekNumber === mutation.weekNumber);
    if (!week) continue;

    if (mutation.action === 'update_run' && mutation.runIndex !== undefined) {
      const run = week.runs?.[mutation.runIndex];
      if (run) Object.assign(run, mutation.changes);
    }
    if (mutation.action === 'update_lift' && mutation.liftIndex !== undefined) {
      const lift = week.lifts?.[mutation.liftIndex];
      if (lift) Object.assign(lift, mutation.changes);
    }
    if (mutation.action === 'remove_run' && mutation.runIndex !== undefined) {
      week.runs?.splice(mutation.runIndex, 1);
    }
    if (mutation.action === 'remove_lift' && mutation.liftIndex !== undefined) {
      week.lifts?.splice(mutation.liftIndex, 1);
    }
    if (mutation.action === 'add_rest') {
      if (!week.restDays) week.restDays = [];
      week.restDays.push(mutation.day);
    }
    if (mutation.action === 'update_week_mileage') {
      week.totalMileage = mutation.value;
    }
  }

  return updated;
}