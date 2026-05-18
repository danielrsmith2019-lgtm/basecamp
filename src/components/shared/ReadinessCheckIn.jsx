'use client';

import { useState } from 'react';
import { READINESS_ICON_MAP, ReadinessIcon } from '@/utils/icons';

export default function ReadinessCheckin({
  onSubmit,
  initialScore = null,
  className = '',
}) {
  const [selected, setSelected]   = useState(initialScore);
  const [note, setNote]           = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSelect(score) { setSelected(score); }

  function handleSubmit() {
    if (selected === null) return;
    onSubmit?.({ score: selected, note });
    setSubmitted(true);
  }

  if (submitted) {
    const config = READINESS_ICON_MAP.find(r => r.score === selected);
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="flex justify-center mb-3">
          <ReadinessIcon score={selected} size={40} showBg />
        </div>
        <p className="text-sm font-semibold text-primary">{config?.label}</p>
        <p className="text-xs text-tertiary mt-1">Readiness logged — let&apos;s go!</p>
      </div>
    );
  }

  const selectedConfig = READINESS_ICON_MAP.find(r => r.score === selected);

  return (
    <div className={className}>
      <h3 className="text-center bc-caption uppercase tracking-wider mb-5">
        How are you feeling today?
      </h3>

      {/* Icon button row */}
      <div className="flex items-center justify-between gap-2 px-1">
        {READINESS_ICON_MAP.map(opt => {
          const isSelected = selected === opt.score;
          return (
            <button
              key={opt.score}
              onClick={() => handleSelect(opt.score)}
              aria-label={opt.label}
              title={opt.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '72px',
                borderRadius: '16px',
                border: isSelected ? `2px solid ${opt.color}` : '2px solid transparent',
                background: isSelected ? opt.bg : '#F9F9FB',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: '10px 4px',
              }}
            >
              <opt.Icon
                size={26}
                strokeWidth={2}
                style={{ color: isSelected ? opt.color : '#AEAEB2' }}
              />
              <span style={{
                fontSize: '10px',
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? opt.color : '#AEAEB2',
                lineHeight: '13px',
              }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected feedback */}
      {selected !== null && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <ReadinessIcon score={selected} size={16} />
          <p className="text-sm font-semibold" style={{ color: selectedConfig?.color }}>
            {selectedConfig?.label}
          </p>
        </div>
      )}

      {/* Note */}
      <div className="mt-5 px-4 sm:px-0">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Quick note (optional)..."
          rows={2}
          className="bc-input resize-none"
          style={{ minHeight: '44px', fontSize: '16px' }}
        />
      </div>

      {/* Submit — button color matches selected readiness level */}
      <div className="mt-4 px-4 sm:px-0">
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className="w-full rounded-xl font-semibold text-sm transition-all"
          style={{
            minHeight: '52px',
            background: selected !== null
              ? `linear-gradient(135deg, ${selectedConfig?.color}, ${selectedConfig?.color}CC)`
              : '#F2F2F7',
            color: selected !== null ? '#fff' : '#AEAEB2',
            border: 'none',
            cursor: selected !== null ? 'pointer' : 'not-allowed',
          }}
        >
          Log Readiness
        </button>
      </div>
    </div>
  );
}