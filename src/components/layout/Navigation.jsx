'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Calendar, ClipboardList, Sparkles,
  Trophy, Target, Settings, Salad,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',           label: 'Home',      icon: Home          },
  { href: '/schedule',   label: 'Schedule',  icon: Calendar      },
  { href: '/log',        label: 'Log',       icon: ClipboardList },
  { href: '/nutrition',  label: 'Nutrition', icon: Salad         },
  { href: '/plans',      label: 'Plans',     icon: Sparkles      },
  { href: '/records',    label: 'Records',   icon: Trophy        },
  { href: '/goals',      label: 'Goals',     icon: Target        },
  { href: '/settings',   label: 'Settings',  icon: Settings      },
];

const MOBILE_ITEMS = [
  { href: '/',          label: 'Home',      icon: Home          },
  { href: '/schedule',  label: 'Schedule',  icon: Calendar      },
  { href: '/log',       label: 'Log',       icon: ClipboardList },
  { href: '/nutrition', label: 'Nutrition', icon: Salad         },
  { href: '/plans',     label: 'Plans',     icon: Sparkles      },
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

      {/* ── Mobile Bottom Tabs ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border
                   pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-center justify-around h-16">
          {MOBILE_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5
                            min-w-[3rem] py-1 transition-colors
                  ${active ? 'text-bc-blue' : 'text-tertiary'}`}>
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2
                                  w-6 h-0.5 rounded-full bg-bc-blue" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}