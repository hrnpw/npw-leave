import type { Metadata, Viewport } from 'next';
import { Kanit } from 'next/font/google';
import { Toaster } from 'sonner';
import { PWARegister } from '@/components/PWARegister';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import './globals.css';

// Kanit font from Google Fonts
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-kanit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'แจ้งลาออนไลน์ | โรงเรียนบ้านเนินพลับหวาน',
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
      </body>
    </html>
  );
}
