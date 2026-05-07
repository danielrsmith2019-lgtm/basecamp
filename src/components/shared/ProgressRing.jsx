'use client';

/**
 * ProgressRing — Circular progress indicator.
 * Uses SVG stroke-dasharray for the fill animation.
 * Color shifts based on percentage: green >75, blue 40-75, orange <40.
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

  // Auto-color if none specified
  const ringColor = color || (
    clamped >= 75 ? '#4ADE80' :
    clamped >= 40 ? '#60A5FA' :
    '#FB923C'
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Track */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1E293B"
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
          <span className="stride-data text-lg font-bold text-primary">
            {Math.round(clamped)}%
          </span>
        </div>
      </div>

      {/* Labels below ring */}
      {label && (
        <p className="text-xs font-medium text-primary mt-2 text-center">{label}</p>
      )}
      {sublabel && (
        <p className="text-[10px] text-muted text-center mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}