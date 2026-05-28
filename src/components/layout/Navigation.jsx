'use client';

/**
 * Navigation — Sidebar on desktop, bottom tabs on mobile.
 * Desktop: full sidebar with all nav items.
 * Mobile: bottom tab bar with 4 primary items + "More" sheet
 *         that reveals Records, Goals, Settings.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Calendar, ClipboardList,
  Trophy, Target, Settings, Salad,
  MoreHorizontal, X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',          label: 'Home',      icon: Home          },
  { href: '/plans',     label: 'Plan',      icon: Calendar      },
  { href: '/log',       label: 'Log',       icon: ClipboardList },
  { href: '/nutrition', label: 'Nutrition', icon: Salad         },
  { href: '/records',   label: 'Records',   icon: Trophy        },
  { href: '/goals',     label: 'Goals',     icon: Target        },
  { href: '/settings',  label: 'Settings',  icon: Settings      },
];

// Primary tabs shown in the bottom bar (4 max + More button)
const PRIMARY_MOBILE = [
  { href: '/',          label: 'Home',      icon: Home          },
  { href: '/plans',     label: 'Plan',      icon: Calendar      },
  { href: '/log',       label: 'Log',       icon: ClipboardList },
  { href: '/nutrition', label: 'Nutrition', icon: Salad         },
];

// Secondary items shown inside the "More" sheet
const SECONDARY_MOBILE = [
  { href: '/records',  label: 'Records',  icon: Trophy   },
  { href: '/goals',    label: 'Goals',    icon: Target   },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  // If current page is a secondary item, highlight More button
  const isMoreActive = SECONDARY_MOBILE.some(item => isActive(item.href));

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-screen pt-14 z-30
                   border-r border-border"
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
        <nav className="flex flex-col gap-0.5 px-3 py-4">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px]
                            text-sm font-medium transition-all
                  ${active
                    ? 'bg-bc-blue-light text-bc-blue-dark font-semibold'
                    : 'text-secondary hover:text-primary hover:bg-canvas'}`}>
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-bc-blue" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-6 py-4 border-t border-border">
          <p className="bc-caption">BaseCamp v0.1</p>
          <p className="bc-caption">Phase 1: Foundation</p>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border
                   pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-stretch h-16">

          {/* Primary tabs */}
          {PRIMARY_MOBILE.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5
                            flex-1 py-1 transition-colors
                  ${active ? 'text-bc-blue' : 'text-tertiary'}`}>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2
                                  w-8 h-0.5 rounded-full bg-bc-blue" />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5
                        flex-1 py-1 transition-colors
              ${isMoreActive ? 'text-bc-blue' : 'text-tertiary'}`}>
            {isMoreActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2
                              w-8 h-0.5 rounded-full bg-bc-blue" />
            )}
            <MoreHorizontal size={22} strokeWidth={isMoreActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet (mobile) ── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70]
                       rounded-t-[24px] border-t border-border pb-[env(safe-area-inset-bottom)]"
            style={{
              background: 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}>

            {/* Sheet handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="bc-caption uppercase tracking-wider">More</p>
              <button
                onClick={() => setShowMore(false)}
                className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                           text-secondary hover:text-primary transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Secondary nav items — 3 cols now that Plans moved to primary */}
            <div className="px-3 pb-4 grid grid-cols-3 gap-2">
              {SECONDARY_MOBILE.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px]
                                transition-all
                      ${active
                        ? 'bg-bc-blue-light text-bc-blue-dark'
                        : 'bg-canvas text-secondary hover:text-primary hover:bg-canvas'}`}>
                    <Icon size={24} strokeWidth={active ? 2 : 1.5} />
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}