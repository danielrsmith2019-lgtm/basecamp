'use client';

import { InsightIcon } from '@/utils/icons';

export default function InsightCard({ insight, onDismiss, onAction }) {
  const styles = {
    warning: { border: 'border-phase-peak', bg: 'bg-phase-peak/5', iconBg: 'bg-phase-peak/20', title: 'text-phase-peak' },
    suggestion: { border: 'border-phase-build', bg: 'bg-phase-build/5', iconBg: 'bg-phase-build/20', title: 'text-phase-build' },
    info: { border: 'border-secondary', bg: 'bg-surface', iconBg: 'bg-secondary/20', title: 'text-secondary' },
  };
  const style = styles[insight.type] || styles.info;

  return (
    <div className={`stride-card stride-accent-left p-4 ${style.border} ${style.bg}`}>
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
          <InsightIcon type={insight.type} insightId={insight.id} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold mb-1 ${style.title}`}>{insight.title}</h4>
          <p className="text-xs text-secondary leading-relaxed">{insight.description}</p>
          <div className="flex items-center gap-2 mt-3">
            {insight.action && (
              <button onClick={() => onAction?.(insight)} className="btn-secondary text-xs py-1.5 px-3 min-h-0">
                {insight.action.label}
              </button>
            )}
            <button onClick={() => onDismiss?.(insight.id)} className="px-3 py-1.5 text-muted text-xs hover:text-primary transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}