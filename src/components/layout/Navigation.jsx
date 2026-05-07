'use client';

/**
 * Navigation — Sidebar on desktop, bottom tabs on mobile.
 * Uses Next.js usePathname to highlight the active route.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  ClipboardList,
  Sparkles,
  Trophy,
  Target,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',         label: 'Home',     icon: Home },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/log',      label: 'Log',      icon: ClipboardList },
  { href: '/plans',    label: 'Plans',    icon: Sparkles },
  { href: '/records',  label: 'Records',  icon: Trophy },
  { href: '/goals',    label: 'Goals',    icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Bottom tabs show a subset — keep it to 5 max for mobile
const MOBILE_ITEMS = [
  { href: '/',         label: 'Home',     icon: Home },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/log',      label: 'Log',      icon: ClipboardList },
  { href: '/plans',    label: 'Plans',    icon: Sparkles },
  { href: '/records',  label: 'Records',  icon: Trophy },
];

export default function Navigation() {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border
                         fixed top-0 left-0 h-screen pt-16 z-30">
        <nav className="flex flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  text-sm font-medium transition-colors
                  ${active
                    ? 'bg-accent/15 text-accent'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                  }
                `}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* App version at bottom of sidebar */}
        <div className="mt-auto px-6 py-4 border-t border-border">
          <p className="text-xs text-muted">BASECAMP v0.1</p>
          <p className="text-xs text-muted">Phase 1: Foundation</p>
        </div>
      </aside>

      {/* ── Mobile Bottom Tabs ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border
                       z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {MOBILE_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-0.5
                  min-w-[3rem] py-1 transition-colors
                  ${active ? 'text-accent' : 'text-muted'}
                `}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <div className="absolute top-0 w-8 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}