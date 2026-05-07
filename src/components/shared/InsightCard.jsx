'use client';

/**
 * InsightCard — Displays a single cross-training insight.
 * Color-coded by type: warning (red/orange), suggestion (blue), info (gray).
 * Dismissible — calls onDismiss with the insight ID.
 */

export default function InsightCard({ insight, onDismiss, onAction }) {
  const styles = {
    warning: {
      border: 'border-phase-peak',
      bg: 'bg-phase-peak/5',
      iconBg: 'bg-phase-peak/20',
      title: 'text-phase-peak',
    },
    suggestion: {
      border: 'border-phase-build',
      bg: 'bg-phase-build/5',
      iconBg: 'bg-phase-build/20',
      title: 'text-phase-build',
    },
    info: {
      border: 'border-secondary',
      bg: 'bg-surface',
      iconBg: 'bg-secondary/20',
      title: 'text-secondary',
    },
  };

  const style = styles[insight.type] || styles.info;

  return (
    <div className={`
      stride-card stride-accent-left p-4
      ${style.border} ${style.bg}
    `}>
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${style.iconBg}
        `}>
          <span className="text-xl">{insight.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold mb-1 ${style.title}`}>
            {insight.title}
          </h4>
          <p className="text-xs text-secondary leading-relaxed">
            {insight.description}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {insight.action && (
              <button
                onClick={() => onAction?.(insight)}
                className="px-3 py-1.5 bg-accent/15 text-accent text-xs font-medium
                           rounded-lg hover:bg-accent/25 transition-colors"
              >
                {insight.action.label}
              </button>
            )}
            <button
              onClick={() => onDismiss?.(insight.id)}
              className="px-3 py-1.5 text-muted text-xs hover:text-primary transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}