'use client';

/**
 * LayoutShell — Client-side wrapper for Header + Navigation + content.
 * Separated from layout.js so the root layout stays a server component.
 * 
 * Loads sample data for the header stats. Once storage.js is wired up,
 * this will read from localStorage/Supabase instead.
 */

import { usePathname } from 'next/navigation';
import Header from './Header';
import Navigation from './Navigation';
import sampleRunData from '@/data/sampleRunData';
import sampleLiftData from '@/data/sampleLiftData';

// Auth pages don't get the app shell
const AUTH_ROUTES = ['/login', '/signup'];

// Test pages get their own layout (they have their own headers)
const STANDALONE_ROUTES = ['/running', '/lifting'];

export default function LayoutShell({ children }) {
  const pathname = usePathname();

  // Auth pages render without the shell
  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  // Test pages render standalone (they have their own headers)
  if (STANDALONE_ROUTES.some(r => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // Combine all workout data for header stats
  const allWorkouts = [...sampleRunData, ...sampleLiftData];

  return (
    <>
      <Header workouts={allWorkouts} />
      <Navigation />

      {/* ── Main Content Area ── */}
      {/* pt-14: clears the fixed header (h-14) */}
      {/* md:pl-56: clears the desktop sidebar (w-56) */}
      {/* pb-20: clears the mobile bottom tabs on small screens */}
      <main className="pt-14 md:pl-56 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
          {children}
        </div>
      </main>
    </>
  );
}