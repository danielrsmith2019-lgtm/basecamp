'use client';

/**
 * PlanAdaptation — Shows adaptive plan notifications.
 * Each card explains what changed, why (with science), and lets the user accept or reject.
 */

import { useState } from 'react';
import { AlertTriangle, TrendingUp, Activity, Scale, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const TYPE_CONFIG = {
  missed_sessions: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/5',
    badge: 'bg-yellow-400/20 text-yellow-400',
  },
  pace_trending_fast: {
    icon: TrendingUp,
    color: 'text-green-400',
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
    badge: 'bg-green-400/20 text-green-400',
  },
  overexertion: {
    icon: Activity,
    color: 'text-red-400',
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
    badge: 'bg-red-400/20 text-red-400',
  },
  cross_domain_balance: {
    icon: Scale,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    badge: 'bg-blue-400/20 text-blue-400',
  },
};

const SEVERITY_LABELS = {
  warning: 'Adjustment',
  positive: 'Improvement',
  info: 'Insight',
};

export default function PlanAdaptationList({ adaptations, onAccept, onReject }) {
  if (!adaptations || adaptations.length === 0) return null;

  const pending = adaptations.filter(a => a.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-accent" />
        <p className="stride-section-label mb-0">Plan Adaptations</p>
        <span className="stride-badge bg-accent/20 text-accent text-[10px]">
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

  async function handleAccept() {
    setActing(true);
    await onAccept();
  }

  async function handleReject() {
    setActing(true);
    await onReject();
  }

  return (
    <div className={`bc-card-flush border ${config.border} ${config.bg}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.badge}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${config.color}`}>
                {severityLabel}
              </span>
            </div>
            <p className="text-sm font-semibold text-primary">{adaptation.title}</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">{adaptation.description}</p>
          </div>
        </div>

        {/* Changes summary */}
        {adaptation.changes && (
          <div className="mt-3 ml-11">
            <div className="flex items-center gap-4 text-xs">
              {adaptation.changes.before?.label && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">Before:</span>
                  <span className="stride-data text-secondary">{adaptation.changes.before.label}</span>
                </div>
              )}
            </div>
            {adaptation.changes.after?.label && (
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="text-muted">After:</span>
                <span className={`stride-data font-medium ${config.color}`}>{adaptation.changes.after.label}</span>
              </div>
            )}
          </div>
        )}

        {/* Science toggle */}
        {adaptation.science && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 ml-11 text-[10px] text-muted hover:text-secondary transition-colors"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Hide' : 'Why?'} The science
          </button>
        )}

        {expanded && adaptation.science && (
          <div className="mt-2 ml-11 p-3 bg-surface/50 rounded-lg">
            <p className="text-[11px] text-secondary leading-relaxed italic">{adaptation.science}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-gray-800">
        <button
          onClick={handleAccept}
          disabled={acting}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
            ${adaptation.type === 'overexertion' || adaptation.type === 'cross_domain_balance'
              ? 'text-secondary hover:text-primary hover:bg-white/5'
              : 'text-green-400 hover:bg-green-500/10'
            }
            disabled:opacity-50`}
        >
          <Check size={12} />
          {adaptation.type === 'overexertion' ? 'Got it' :
           adaptation.type === 'cross_domain_balance' ? 'Understood' :
           'Accept'}
        </button>
        <div className="w-px bg-surface" />
        <button
          onClick={handleReject}
          disabled={acting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
        >
          <X size={12} />
          Dismiss
        </button>
      </div>
    </div>
  );
}