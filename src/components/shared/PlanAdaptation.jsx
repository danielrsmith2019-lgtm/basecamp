'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingUp, Activity, Scale, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const TYPE_CONFIG = {
  missed_sessions: {
    icon: AlertTriangle,
    color: 'text-bc-orange-dark',
    border: 'border-bc-orange/30',
    bg: 'bg-bc-orange-light',
  },
  pace_trending_fast: {
    icon: TrendingUp,
    color: 'text-bc-green-dark',
    border: 'border-bc-green/30',
    bg: 'bg-bc-green-light',
  },
  overexertion: {
    icon: Activity,
    color: 'text-bc-red-dark',
    border: 'border-bc-red/30',
    bg: 'bg-bc-red-light',
  },
  cross_domain_balance: {
    icon: Scale,
    color: 'text-bc-blue-dark',
    border: 'border-bc-blue/30',
    bg: 'bg-bc-blue-light',
  },
};

const SEVERITY_LABELS = {
  warning:  'Adjustment',
  positive: 'Improvement',
  info:     'Insight',
};

// FIX: header removed — dashboard owns the header + show/hide toggle
// This component only renders the cards themselves
export default function PlanAdaptationList({ adaptations, onAccept, onReject }) {
  if (!adaptations || adaptations.length === 0) return null;
  const pending = adaptations.filter(a => a.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending.map(adaptation => (
        <PlanAdaptationCard
          key={adaptation.id}
          adaptation={adaptation}
          onAccept={() => onAccept(adaptation)}
          onReject={() => onReject(adaptation)}
        />
      ))}
    </div>
  );
}

function PlanAdaptationCard({ adaptation, onAccept, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [acting,   setActing]   = useState(false);

  const config = TYPE_CONFIG[adaptation.type] || TYPE_CONFIG.missed_sessions;
  const Icon   = config.icon;
  const severityLabel = SEVERITY_LABELS[adaptation.severity] || 'Update';

  async function handleAccept() { setActing(true); await onAccept(); }
  async function handleReject() { setActing(true); await onReject(); }

  return (
    <div className={`bc-card-flush border-l-4 ${config.border} ${config.bg}`}>

      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 ${config.bg}`}>
            <Icon size={16} className={config.color} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${config.color}`}>
              {severityLabel}
            </span>
            <p className="text-sm font-semibold text-primary mt-0.5">{adaptation.title}</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">{adaptation.description}</p>
          </div>
        </div>

        {/* Before / After — FIX: plain text, not mono bc-data */}
        {adaptation.changes && (
          <div className="mt-3 ml-11 space-y-1">
            {adaptation.changes.before?.label && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-tertiary">Before:</span>
                <span className="text-[11px] text-secondary">{adaptation.changes.before.label}</span>
              </div>
            )}
            {adaptation.changes.after?.label && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-tertiary">After:</span>
                <span className={`text-[11px] font-semibold ${config.color}`}>
                  {adaptation.changes.after.label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Science toggle */}
        {adaptation.science && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 ml-11 bc-caption hover:text-secondary transition-colors min-h-[32px]">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Hide' : 'Why?'} The science
          </button>
        )}
        {expanded && adaptation.science && (
          <div className="mt-2 ml-11 p-3 bg-canvas rounded-[10px]">
            <p className="text-[11px] text-secondary leading-relaxed italic">{adaptation.science}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-border">
        <button
          onClick={handleAccept}
          disabled={acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                     text-bc-green-dark hover:bg-bc-green-light/50 transition-colors disabled:opacity-50 min-h-[44px]">
          <Check size={12} />
          {adaptation.type === 'overexertion'         ? 'Got it'     :
           adaptation.type === 'cross_domain_balance' ? 'Understood' :
           'Accept'}
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={handleReject}
          disabled={acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                     text-tertiary hover:text-bc-red-dark hover:bg-bc-red-light/50
                     transition-colors disabled:opacity-50 min-h-[44px]">
          <X size={12} />
          Dismiss
        </button>
      </div>
    </div>
  );
}