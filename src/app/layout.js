import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// ─── STRIDE TYPOGRAPHY ──────────────────────────────
// DM Sans: all UI text (headings, labels, body copy)
// JetBrains Mono: all data (paces, distances, weights, reps, calories)

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// ─── APP METADATA ───────────────────────────────────

export const metadata = {
  title: 'BASECAMP — Unified Fitness Ecosystem',
  description: 'Track runs, lifts, and nutrition in one place. AI-powered plans that adapt to your body.',
};

// ─── ROOT LAYOUT ────────────────────────────────────

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-base text-primary font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}