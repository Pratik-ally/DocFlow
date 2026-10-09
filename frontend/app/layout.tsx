import Providers from './providers';
import type { Metadata, Viewport } from 'next';
import './globals.css';

const APP_NAME = 'DocFlow';
const APP_TITLE = 'DocFlow — Smarter Appointments. Faster Patient Flow. Better Care.';
const APP_DESCRIPTION =
  'DocFlow is an AI-assisted hospital appointment and patient priority management platform designed to streamline scheduling, patient flow, and queue management.';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  // ── Core ──────────────────────────────────────────────────────────────
  metadataBase: new URL(APP_URL),
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    'hospital appointment',
    'patient priority',
    'healthcare management',
    'AI scheduling',
    'queue management',
    'DocFlow',
  ],

  // ── Open Graph ────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: APP_URL,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: APP_TITLE,
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ['/opengraph-image'],
  },

  // ── Icons (SVG favicon auto-picked up from app/icon.svg) ─────────────
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
  },

  // ── Manifest ─────────────────────────────────────────────────────────
  manifest: '/manifest.webmanifest',

  // ── Robots ───────────────────────────────────────────────────────────
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Flash-prevention: runs before React hydrates — applies saved theme instantly
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('docflow-theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (stored === 'system' && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
    // Disable transitions during initial paint to prevent flash
    document.documentElement.classList.add('no-transitions');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        document.documentElement.classList.remove('no-transitions');
      });
    });
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
