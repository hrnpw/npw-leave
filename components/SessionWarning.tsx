'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { SESSION_TTL_SECONDS, SESSION_EARLY_WARNING_SECONDS, SESSION_WARNING_SECONDS } from '@/lib/constants';

interface SessionWarningProps {
  sessionType: 'teacher' | 'hr';
  sessionCreatedAt: number;
}

export function SessionWarning({ sessionType, sessionCreatedAt }: SessionWarningProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [earlyWarningShown, setEarlyWarningShown] = useState(false);
  const [extending, setExtending] = useState(false);
  // Tracks the session start we are counting down from. Extending updates this
  // in place instead of reloading, so unsaved form input survives.
  const [createdAt, setCreatedAt] = useState(sessionCreatedAt);

  useEffect(() => {
    setCreatedAt(sessionCreatedAt);
  }, [sessionCreatedAt]);

  const checkSession = useCallback(() => {
    const now = Date.now();
    const elapsed = (now - createdAt) / 1000; // seconds
    const remaining = SESSION_TTL_SECONDS - elapsed;

    if (remaining <= 0) {
      // Session expired
      handleExpired();
      return;
    }

    // Early warning: toast a few minutes out, while there is still time to act
    if (remaining <= SESSION_EARLY_WARNING_SECONDS && remaining > SESSION_WARNING_SECONDS && !earlyWarningShown) {
      setEarlyWarningShown(true);
      toast.warning(`เซสชันจะหมดอายุในอีก ${Math.ceil(remaining / 60)} นาที`, {
        description: 'กรุณาบันทึกงานของคุณ',
        duration: 10000,
        action: {
          label: 'ใช้งานต่อ',
          onClick: handleExtend
        }
      });
    }

    // Critical warning: 1 minute before (modal)
    if (remaining <= SESSION_WARNING_SECONDS && !showWarning) {
      setShowWarning(true);
    }

    if (showWarning) {
      setRemainingSeconds(Math.ceil(remaining));
    }
  }, [createdAt, showWarning, earlyWarningShown]);

  useEffect(() => {
    const interval = setInterval(checkSession, 1000);
    checkSession(); // Initial check

    return () => clearInterval(interval);
  }, [checkSession]);

  const handleExpired = () => {
    setShowWarning(false);
    const loginPath = sessionType === 'teacher' ? '/verify' : '/hr/login';
    router.push(`${loginPath}?returnUrl=${encodeURIComponent(pathname)}`);
  };

  const handleExtend = async () => {
    if (extending) return;

    const endpoint = sessionType === 'teacher'
      ? '/api/auth/teacher/extend'
      : '/api/auth/hr/extend';

    try {
      setExtending(true);
      const res = await fetch(endpoint, { method: 'POST' });

      if (!res.ok) {
        // Session already gone on the server - nothing left to extend.
        handleExpired();
        return;
      }

      // Restart the countdown from now. Deliberately no reload: this component
      // also runs on the leave form, where a reload would discard user input.
      setCreatedAt(Date.now());
      setShowWarning(false);
      setEarlyWarningShown(false);
      toast.success('ต่อเวลาใช้งานแล้ว');
    } catch (error) {
      console.error('Failed to extend session:', error);
      toast.error('ต่อเวลาไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setExtending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {showWarning && (
        <>
          {/* Backdrop - don't extend on click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                    เซสชันจะหมดอายุเร็วๆ นี้
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    คุณจะถูกออกจากระบบในอีก <span className="font-bold text-amber-600 dark:text-amber-400">{formatTime(remainingSeconds)}</span>
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={handleExtend}
                      disabled={extending}
                      className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {extending ? 'กำลังต่อเวลา...' : 'ใช้งานต่อ'}
                    </button>
                    <button
                      onClick={handleExpired}
                      disabled={extending}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(remainingSeconds / SESSION_WARNING_SECONDS) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
