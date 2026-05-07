'use client';

/**
 * Sparkline — Tiny inline trend chart for KPI cards.
 * Pure SVG, no Recharts dependency. Keeps KPI cards lightweight.
 */

export default function Sparkline({ data = [], color = '#4ADE80', width = 80, height = 24 }) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Fill area under the line
  const areaPoints = `0,${height} ${polyline} ${width},${height}`;

  return (
    <svg width={width} height={height} className="inline-block">
      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill={color}
        fillOpacity="0.1"
      />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={lastX} cy={lastY} r="2" fill={color} />;
      })()}
    </svg>
  );
}