'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingUp, Activity, Scale, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const TYPE_CONFIG = {
  missed_sessions: {
    icon: AlertTriangle,
    color: 'text-bc-orange-dark',
    border: 'border-bc-orange/30',
    bg: 'bg-bc-orange-light',
    iconBg: 'bg-bc-orange-light',
  },
  pace_trending_fast: {
    icon: TrendingUp,
    color: 'text-bc-green-dark',
    border: 'border-bc-green/30',
    bg: 'bg-bc-green-light',
    iconBg: 'bg-bc-green-light',
  },
  overexertion: {
    icon: Activity,
    color: 'text-bc-red-dark',
    border: 'border-bc-red/30',
    bg: 'bg-bc-red-light',
    iconBg: 'bg-bc-red-light',
  },
  cross_domain_balance: {
    icon: Scale,
    color: 'text-bc-blue-dark',
    border: 'border-bc-blue/30',
    bg: 'bg-bc-blue-light',
    iconBg: 'bg-bc-blue-light',
  },
};

const SEVERITY_LABELS = {
  warning:  'Adjustment',
  positive: 'Improvement',
  info:     'Insight',
};

export default function PlanAdaptationList({ adaptations, onAccept, onReject }) {
  if (!adaptations || adaptations.length === 0) return null;
  const pending = adaptations.filter(a => a.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-bc-indigo" />
        <p className="bc-caption uppercase tracking-wider mb-0">Plan Adaptations</p>
        <span className="bc-pill bg-bc-indigo-light text-bc-indigo-dark text-[10px]">
          {pending.length} pending
        </span>
      </div>
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
    </div>
  );
}

function PlanAdaptationCard({ adaptation, onAccept, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const config = TYPE_CONFIG[adaptation.type] || TYPE_CONFIG.missed_sessions;
  const Icon = config.icon;
  const severityLabel = SEVERITY_LABELS[adaptation.severity] || 'Update';

  async function handleAccept() { setActing(true); await onAccept(); }
  async function handleReject() { setActing(true); await onReject(); }

  return (
    <div className={`bc-card-flush border-l-4 ${config.border} ${config.bg}`}>
      {/* ── Header ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center
                           flex-shrink-0 ${config.iconBg}`}>
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

        {/* Changes summary */}
        {adaptation.changes && (
          <div className="mt-3 ml-11 space-y-1 text-xs">
            {adaptation.changes.before?.label && (
              <div className="flex items-center gap-1.5">
                <span className="text-tertiary">Before:</span>
                <span className="bc-data text-secondary">{adaptation.changes.before.label}</span>
              </div>
            )}
            {adaptation.changes.after?.label && (
              <div className="flex items-center gap-1.5">
                <span className="text-tertiary">After:</span>
                <span className={`bc-data font-medium ${config.color}`}>
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
            className="flex items-center gap-1 mt-3 ml-11 bc-caption hover:text-secondary transition-colors">
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

      {/* ── Action buttons ── */}
      <div className="flex border-t border-border">
        <button
          onClick={handleAccept}
          disabled={acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                     text-xs font-medium text-bc-green-dark hover:bg-bc-green-light/50
                     transition-colors disabled:opacity-50">
          <Check size={12} />
          {adaptation.type === 'overexertion'        ? 'Got it'     :
           adaptation.type === 'cross_domain_balance' ? 'Understood' :
           'Accept'}
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={handleReject}
          disabled={acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                     text-xs font-medium text-tertiary hover:text-bc-red-dark
                     hover:bg-bc-red-light/50 transition-colors disabled:opacity-50">
          <X size={12} />
          Dismiss
        </button>
      </div>
    </div>
  );
}