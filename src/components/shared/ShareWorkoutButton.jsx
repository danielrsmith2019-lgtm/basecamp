'use client';

import { useState } from 'react';
import ShareCard from './ShareCard';
import { useShareWorkout } from '@/hooks/useShareWorkout';
import { useIsMobile } from '@/hooks/useMediaQuery';

export default function ShareWorkoutButton({
  workout,
  userName = '',
  deepLinkUrl = '',
  onShareComplete,
  variant = 'button', // 'button' | 'icon'
  className = '',
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showName, setShowName] = useState(true);
  const isMobile = useIsMobile();

  const { cardRef, isGenerating, shareWorkout, downloadImage, error } =
    useShareWorkout({
      onShared: () => {
        onShareComplete?.(workout);
        setShowPreview(false);
      },
    });

  const handleShare = async () => {
    if (isMobile) {
      await shareWorkout();
    } else {
      await downloadImage();
    }
  };

  return (
    <>
      {/* ── Trigger ── */}
      {variant === 'icon' ? (
        // FIXED: use currentColor so it inherits from parent text color,
        // and use a visible bg + border that works on both light and dark cards
        <button
          onClick={() => setShowPreview(true)}
          className={`flex items-center justify-center rounded-xl transition-all hover:opacity-80 active:scale-95 ${className}`}
          style={{
            width: '32px',
            height: '32px',
            minWidth: '32px',
            background: 'rgba(142,142,147,0.12)',
            border: '1px solid rgba(142,142,147,0.2)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Share workout"
          title="Share workout"
        >
          {/* Upload/share arrow icon — visible on both light and dark */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8E8E93"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      ) : (
        // Button variant — solid pill style, works anywhere
        <button
          onClick={() => setShowPreview(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold
                      transition-all hover:opacity-80 active:scale-95 ${className}`}
          style={{
            background: 'rgba(142,142,147,0.12)',
            border: '1px solid rgba(142,142,147,0.2)',
            color: '#8E8E93',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      )}

      {/* ── Preview modal ── */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
        >
          {/* Card preview (scaled down 1080→270) */}
          <div
            style={{
              width: '270px',
              height: '480px',
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              position: 'relative',
            }}
          >
            <div
              style={{
                transform: 'scale(0.25)',
                transformOrigin: 'top left',
                width: '1080px',
                height: '1920px',
              }}
            >
              <ShareCard
                ref={cardRef}
                workout={workout}
                userName={userName}
                showName={showName}
                deepLinkUrl={deepLinkUrl}
              />
            </div>
          </div>

          {/* Controls */}
          <div
            className="flex flex-col items-center gap-3 mt-6"
            style={{ maxWidth: '320px', width: '100%' }}
          >
            {/* Name toggle */}
            <label
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: '44px',
              }}
            >
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
                className="w-5 h-5 rounded accent-green-500"
              />
              <span className="text-sm text-white">Show display name</span>
            </label>

            {/* Share / Download */}
            <button
              onClick={handleShare}
              disabled={isGenerating}
              className="w-full rounded-xl font-semibold text-sm transition-all"
              style={{
                minHeight: '52px',
                background: isGenerating
                  ? 'rgba(34,197,94,0.3)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                border: 'none',
                cursor: isGenerating ? 'wait' : 'pointer',
              }}
            >
              {isGenerating
                ? 'Generating...'
                : isMobile
                  ? 'Share Image'
                  : 'Download Image'}
            </button>

            {/* Desktop secondary */}
            {!isMobile && (
              <button
                onClick={shareWorkout}
                disabled={isGenerating}
                className="w-full rounded-xl text-sm font-medium"
                style={{
                  minHeight: '44px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                }}
              >
                Share via System...
              </button>
            )}

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={() => setShowPreview(false)}
              className="text-sm"
              style={{
                color: 'rgba(255,255,255,0.4)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}