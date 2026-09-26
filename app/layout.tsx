import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { PWARegister } from '@/components/PWARegister';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import './globals.css';

// Kanit font - self-hosted
const kanit = localFont({
  src: [
    {
      path: '../public/fonts/kanit/kanit-v17-latin_thai-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/kanit/kanit-v17-latin_thai-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/kanit/kanit-v17-latin_thai-600.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-kanit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'แจ้งลา | โรงเรียนบ้านเนินพลับหวาน',
  description: 'ระบบแจ้งลาออนไลน์สำหรับโรงเรียนบ้านเนินพลับหวาน',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'แจ้งลา NPW',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0ea5e9',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="แจ้งลาออนไลน์" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash.png" />
      </head>
      <body className={`${kanit.variable} font-sans antialiased`}>
        <PWARegister />
        <OfflineIndicator />
        {children}
        <PWAInstallPrompt />
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  );
}
