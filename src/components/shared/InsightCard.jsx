'use client';

import { InsightIcon } from '@/utils/icons';

export default function InsightCard({ insight, onDismiss, onAction }) {
  const styles = {
    warning:    { border: 'border-bc-orange', iconBg: 'bg-bc-orange-light', title: 'text-bc-orange-dark', bg: 'bg-bc-gray-light' },
    suggestion: { border: 'border-bc-blue',   iconBg: 'bg-bc-blue-light',   title: 'text-bc-blue-dark',   bg: 'bg-bc-gray-light'   },
    info:       { border: 'border-border',        iconBg: 'bg-canvas',          title: 'text-primary',        bg: 'bg-canvas'             },
  };
  const style = styles[insight.type] || styles.info;

  return (
    <div className={`bc-card border-l-4 p-4 ${style.border} ${style.bg}`}>
      <div className="flex gap-3">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
          <InsightIcon type={insight.type} insightId={insight.id} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold mb-1 ${style.title}`}>{insight.title}</h4>
          <p className="text-xs text-secondary leading-relaxed">{insight.description}</p>
          <div className="flex items-center gap-2 mt-3">
            {insight.action && (
              <button
                onClick={() => onAction?.(insight)}
                className="bc-btn-secondary !text-xs !py-1.5 !px-3">
                {insight.action.label}
              </button>
            )}
            <button
              onClick={() => onDismiss?.(insight.id)}
              className="px-3 py-1.5 text-tertiary text-xs hover:text-primary transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}