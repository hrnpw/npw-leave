'use client';

import { useEffect, useState } from 'react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check visit count
    const visitCount = parseInt(localStorage.getItem('pwa_visit_count') || '0', 10);
    const hasPrompted = localStorage.getItem('pwa_prompted') === 'true';
    const hasDismissed = localStorage.getItem('pwa_dismissed') === 'true';

    // Increment visit count
    localStorage.setItem('pwa_visit_count', (visitCount + 1).toString());

    // Show prompt on 2nd visit or later, if not prompted before and not dismissed
    if (visitCount >= 1 && !hasPrompted && !hasDismissed) {
      // Listen for beforeinstallprompt event
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    localStorage.setItem('pwa_prompted', 'true');
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center">
            <svg
              className="w-6 h-6 text-sky-600 dark:text-sky-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              เพิ่มลงหน้าจอโฮม
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              ติดตั้งแอปเพื่อเข้าถึงได้รวดเร็วและใช้งานแบบออฟไลน์
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ติดตั้ง
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                ไม่แสดง
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
