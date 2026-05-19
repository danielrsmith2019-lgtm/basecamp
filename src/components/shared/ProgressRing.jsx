'use client';

/**
 * ProgressRing — Circular progress indicator.
 * Light mode: track uses #F2F2F7, auto-colors use BaseCamp tokens.
 */

export default function ProgressRing({
  percentage = 0,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  sublabel,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;

  // Auto-color using BaseCamp design tokens
  const ringColor = color || (
    clamped >= 75 ? '#34C759' :  // bc-green
    clamped >= 40 ? '#007AFF' :  // bc-blue
                    '#FF9500'    // bc-orange
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* Track */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F2F2F7"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-primary"
            style={{
              fontSize: size >= 72 ? '14px' : '12px',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
            {Math.round(clamped)}%
          </span>
        </div>
      </div>

      {label && (
        <p className="text-xs font-medium text-primary mt-2 text-center">{label}</p>
      )}
      {sublabel && (
        <p className="text-[10px] text-tertiary text-center mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}