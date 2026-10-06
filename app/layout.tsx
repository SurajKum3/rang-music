import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Archivo_Black, DM_Mono } from 'next/font/google';
import { RadioProvider } from '@/engine/audio/RadioProvider';
import VisibilityPause from '@/components/system/VisibilityPause';
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo-black',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

// Defaults for routes without their own metadata (404, error). No canonical here on purpose:
// each page sets its own, so a 404 never claims to be the homepage.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_IN',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_TITLE }],
  },
};

// viewport-fit=cover lets the scene run under the notch and home bar; the UI
// is kept clear of them with env(safe-area-inset-*). Pinch-zoom stays enabled.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050607',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${dmMono.variable}`}>
      <body suppressHydrationWarning><VisibilityPause /><RadioProvider>{children}</RadioProvider></body>
    </html>
  );
}
