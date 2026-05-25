'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Target, Trophy, Settings, UtensilsCrossed } from 'lucide-react';

const PRIMARY_TABS = [
  {
    label: 'Home',
    href: '/',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#007AFF' : '#AEAEB2'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#007AFF' : '#AEAEB2'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Log',
    href: '/log',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#007AFF' : '#AEAEB2'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    label: 'Plan',
    href: '/plans',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#007AFF' : '#AEAEB2'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="7" y1="15" x2="17" y2="15" />
        <line x1="7" y1="19" x2="13" y2="19" />
      </svg>
    ),
  },
];

const MORE_ITEMS = [
  {
    label: 'Nutrition',
    href: '/nutrition',
    description: 'Log food & track macros',
    Icon: UtensilsCrossed,
    color: '#34C759',
    bg: '#E8F5E9',
  },
  {
    label: 'Goals',
    href: '/goals',
    description: 'Track your training goals',
    Icon: Target,
    color: '#AF52DE',
    bg: '#F3E5F5',
  },
  {
    label: 'Records',
    href: '/records',
    description: 'Personal bests & PRs',
    Icon: Trophy,
    color: '#FF9500',
    bg: '#FFF3E0',
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Profile & preferences',
    Icon: Settings,
    color: '#8E8E93',
    bg: '#F2F2F7',
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [showMore, setShowMore] = useState(false);

  if (!isMobile) return null;

  const isMoreActive = MORE_ITEMS.some(
    item => pathname === item.href || pathname?.startsWith(item.href + '/')
  );

  return (
    <>
      {/* Page content spacer */}
      <div style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />

      {/* Backdrop */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 48,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* More drawer */}
      {showMore && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          left: '12px',
          right: '12px',
          zIndex: 49,
          background: 'rgba(255,255,255,0.98)',
          borderRadius: '20px',
          border: '0.5px solid rgba(60,60,67,0.12)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {MORE_ITEMS.map((item, i) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 20px',
                  textDecoration: 'none',
                  borderBottom: i < MORE_ITEMS.length - 1
                    ? '0.5px solid rgba(60,60,67,0.08)' : 'none',
                  background: active ? 'rgba(0,122,255,0.04)' : 'transparent',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: active ? 'rgba(0,122,255,0.12)' : item.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} strokeWidth={2} color={active ? '#007AFF' : item.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600,
                    color: active ? '#007AFF' : '#1C1C1E', lineHeight: '20px' }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#8E8E93', lineHeight: '16px' }}>
                    {item.description}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={active ? '#007AFF' : '#C7C7CC'} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {/* Nav bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(60,60,67,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Icon row — strict 64px, never affected by safe area */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '64px' }}>
        {PRIMARY_TABS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '3px',
                textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
              }}>
              {item.icon(isActive)}
              <span style={{
                fontSize: '10px', fontWeight: isActive ? 600 : 500,
                color: isActive ? '#007AFF' : '#AEAEB2', lineHeight: '13px',
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button onClick={() => setShowMore(!showMore)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '3px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="5"  cy="12" r="1.4" fill={isMoreActive || showMore ? '#007AFF' : '#AEAEB2'} />
            <circle cx="12" cy="12" r="1.4" fill={isMoreActive || showMore ? '#007AFF' : '#AEAEB2'} />
            <circle cx="19" cy="12" r="1.4" fill={isMoreActive || showMore ? '#007AFF' : '#AEAEB2'} />
          </svg>
          <span style={{
            fontSize: '10px', fontWeight: isMoreActive || showMore ? 600 : 500,
            color: isMoreActive || showMore ? '#007AFF' : '#AEAEB2', lineHeight: '13px',
          }}>
            More
          </span>
        </button>
        </div>
      </nav>
    </>
  );
}