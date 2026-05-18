'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * NutritionRing — single SVG ring that scales down on mobile
 */
export function NutritionRing({
  label,
  current,
  target,
  color = '#22c55e',
  size = 100,
}) {
  const isMobile = useIsMobile();
  const displaySize = isMobile ? Math.min(size, 72) : size;
  const strokeWidth = isMobile ? 5 : 6;
  const radius = (displaySize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / target, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={displaySize}
        height={displaySize}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={displaySize / 2}
          cy={displaySize / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={displaySize / 2}
          cy={displaySize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>

      {/* Center label */}
      <div className="text-center">
        <span className="text-sm sm:text-base font-bold text-white">
          {current}
        </span>
        <span
          className="text-xs"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          /{target}
        </span>
      </div>
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * NutritionRingsRow — flex container that scales on mobile
 */
export function NutritionRingsRow({ children, className = '' }) {
  return (
    <div className={`nutrition-rings ${className}`}>
      {children}
    </div>
  );
}

/**
 * MealSection — collapsible on mobile, always open on desktop
 */
export function MealSection({ title, icon, itemCount = 0, children }) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);

  return (
    <div
      className={`meal-section ${!isOpen && isMobile ? 'collapsed' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header — tappable on mobile */}
      <button
        className="meal-section-header w-full text-left"
        onClick={() => isMobile && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          minHeight: '44px',
          background: 'transparent',
          border: 'none',
          cursor: isMobile ? 'pointer' : 'default',
        }}
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-sm font-semibold text-white">{title}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-md"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {itemCount}
          </span>
        </div>

        {isMobile && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div
        style={{
          maxHeight: isOpen || !isMobile ? '2000px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}