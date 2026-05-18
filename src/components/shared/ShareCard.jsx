'use client';

import { forwardRef } from 'react';

/**
 * ShareCard — stylized card sized for Instagram Stories (1080×1920 = 9:16 ratio).
 * Rendered to canvas via html2canvas for sharing/downloading.
 *
 * Props:
 * - workout: { type, date, duration_minutes, distance_miles, pace, exercises,
 *              total_volume, sets, calories, title }
 * - userName: string (display name, toggleable externally)
 * - showName: boolean
 * - deepLinkUrl: string
 */
const ShareCard = forwardRef(function ShareCard(
  { workout, userName = '', showName = true, deepLinkUrl = '' },
  ref
) {
  const type = workout?.type?.toLowerCase() || 'run';
  const isRun = type === 'run';
  const isLift = type === 'lift' || type === 'strength';
  const isCardio = type === 'cardio';

  const dateStr = workout?.date
    ? new Date(workout.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  return (
    <div
      ref={ref}
      style={{
        width: '1080px',
        height: '1920px',
        background: '#0a0a0a',
        position: 'relative',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Gradient backdrop */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '960px',
          background: getGradient(type),
          opacity: 0.15,
        }}
      />

      {/* Accent glow */}
      <div
        style={{
          position: 'absolute',
          top: '240px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: getAccentColor(type),
          opacity: 0.08,
          filter: 'blur(120px)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 72px',
        }}
      >
        {/* Header: BaseCamp wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z"
                fill="#fff"
                fillOpacity="0.95"
              />
              <path
                d="M6 16l6 6 6-6"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeOpacity="0.6"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: '36px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.5px',
            }}
          >
            BASECAMP
          </span>
        </div>

        {/* Type icon + badge */}
        <div
          style={{
            marginTop: '120px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: `${getAccentColor(type)}15`,
              border: `2px solid ${getAccentColor(type)}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
            }}
          >
            {getTypeEmoji(type)}
          </div>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '6px 20px',
                borderRadius: '100px',
                background: `${getAccentColor(type)}18`,
                border: `1px solid ${getAccentColor(type)}30`,
                color: getAccentColor(type),
                fontSize: '22px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {type === 'strength' ? 'LIFT' : type.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Workout title */}
        {workout?.title && (
          <h2
            style={{
              marginTop: '48px',
              fontSize: '52px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-1px',
            }}
          >
            {workout.title}
          </h2>
        )}

        {/* Stats grid */}
        <div
          style={{
            marginTop: workout?.title ? '64px' : '100px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
          }}
        >
          {getStats(workout, type).map((stat, i) => (
            <div
              key={i}
              style={{
                padding: '36px 32px',
                borderRadius: '24px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: '12px',
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 800,
                  color: '#ffffff',
                  lineHeight: 1.1,
                }}
              >
                {stat.value}
              </div>
              {stat.unit && (
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.35)',
                    marginTop: '4px',
                  }}
                >
                  {stat.unit}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div>
          {/* Date */}
          <p
            style={{
              fontSize: '22px',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '12px',
            }}
          >
            {dateStr}
          </p>

          {/* User name */}
          {showName && userName && (
            <p
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '32px',
              }}
            >
              {userName}
            </p>
          )}

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              marginBottom: '28px',
            }}
          />

          {/* Deep link */}
          {deepLinkUrl && (
            <p
              style={{
                fontSize: '18px',
                color: 'rgba(255,255,255,0.25)',
                fontFamily: 'monospace',
              }}
            >
              {deepLinkUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default ShareCard;

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function getGradient(type) {
  const gradients = {
    run: 'linear-gradient(180deg, #3b82f6, transparent)',
    lift: 'linear-gradient(180deg, #f97316, transparent)',
    strength: 'linear-gradient(180deg, #f97316, transparent)',
    cardio: 'linear-gradient(180deg, #a855f7, transparent)',
    rest: 'linear-gradient(180deg, #6b7280, transparent)',
  };
  return gradients[type] || gradients.run;
}

function getAccentColor(type) {
  const colors = {
    run: '#3b82f6',
    lift: '#f97316',
    strength: '#f97316',
    cardio: '#a855f7',
    rest: '#6b7280',
  };
  return colors[type] || '#22c55e';
}

function getTypeEmoji(type) {
  const emojis = {
    run: '🏃',
    lift: '🏋️',
    strength: '🏋️',
    cardio: '💓',
    rest: '😴',
  };
  return emojis[type] || '⚡';
}

function getStats(workout, type) {
  if (!workout) return [];

  if (type === 'run') {
    return [
      {
        label: 'Distance',
        value: workout.distance_miles
          ? `${Number(workout.distance_miles).toFixed(1)}`
          : '—',
        unit: 'miles',
      },
      {
        label: 'Pace',
        value: workout.pace || '—',
        unit: '/mile',
      },
      {
        label: 'Duration',
        value: workout.duration_minutes
          ? `${workout.duration_minutes}`
          : '—',
        unit: 'min',
      },
      {
        label: 'Calories',
        value: workout.calories ? `${workout.calories}` : '—',
        unit: 'kcal',
      },
    ].filter((s) => s.value !== '—');
  }

  if (type === 'lift' || type === 'strength') {
    return [
      {
        label: 'Volume',
        value: workout.total_volume
          ? `${Number(workout.total_volume).toLocaleString()}`
          : '—',
        unit: 'lbs',
      },
      {
        label: 'Exercises',
        value: workout.exercises
          ? `${workout.exercises}`
          : '—',
        unit: '',
      },
      {
        label: 'Sets',
        value: workout.sets ? `${workout.sets}` : '—',
        unit: 'total',
      },
      {
        label: 'Duration',
        value: workout.duration_minutes
          ? `${workout.duration_minutes}`
          : '—',
        unit: 'min',
      },
    ].filter((s) => s.value !== '—');
  }

  // Cardio / generic
  return [
    {
      label: 'Duration',
      value: workout.duration_minutes
        ? `${workout.duration_minutes}`
        : '—',
      unit: 'min',
    },
    {
      label: 'Calories',
      value: workout.calories ? `${workout.calories}` : '—',
      unit: 'kcal',
    },
  ].filter((s) => s.value !== '—');
}