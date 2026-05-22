import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import LayoutShell from '@/components/layout/LayoutShell';
import { AuthProvider } from '@/lib/auth';

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

export const metadata = {
  title: 'BaseCamp — Multimodal Fitness OS',
  description: 'One app for every run, lift, and cardio session. AI-powered training plans that understand the interference effect.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BaseCamp',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'BaseCamp — Multimodal Fitness OS',
    description: 'One app for every run, lift, and cardio session.',
    siteName: 'BaseCamp',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#007AFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* PWA meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BaseCamp" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#007AFF" />
        {/* Prevent iOS input zoom */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-canvas text-primary font-sans antialiased min-h-screen">
        <AuthProvider>
          <LayoutShell>
            {children}
          </LayoutShell>
        </AuthProvider>
      </body>
    </html>
  );
}