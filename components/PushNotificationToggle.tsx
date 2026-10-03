'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = 'checking' | 'unsupported' | 'ios-need-install' | 'denied' | 'subscribed' | 'unsubscribed';

async function postSubscription(subscription: PushSubscription) {
  await fetch('/api/teacher/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.parse(JSON.stringify(subscription))),
  });
}

export function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const isSupported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (!isSupported) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as any).standalone === true;

        if (isIOS && !isStandalone) {
          if (!cancelled) setStatus('ios-need-install');
        } else {
          if (!cancelled) setStatus('unsupported');
        }
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        if (!cancelled) setStatus('unsupported');
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        if (!cancelled) {
          setStatus('unsubscribed');
          setShowPrompt(true);
        }
        return;
      }

      // Sync silently in case this device/subscription belonged to someone else
      // or the server-side row was removed.
      try {
        await postSubscription(subscription);
      } catch {
        // Ignore - user can retry via the button.
      }

      if (!cancelled) setStatus('subscribed');
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  const handleSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    dismissPrompt();

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error('ระบบแจ้งเตือนยังไม่พร้อมใช้งาน');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await postSubscription(subscription);
      setStatus('subscribed');
      toast.success('เปิดการแจ้งเตือนสำเร็จ');
    } catch (error) {
      console.error('Push subscribe error:', error);
      toast.error('เปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch('/api/teacher/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }

      setStatus('unsubscribed');
      toast.success('ปิดการแจ้งเตือนแล้ว');
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      toast.error('ปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking' || status === 'unsupported') {
    return null;
  }

  if (status === 'ios-need-install' || status === 'denied') {
    const hint =
      status === 'ios-need-install'
        ? 'เพิ่มแอปไปยังหน้าจอโฮมก่อนเพื่อรับการแจ้งเตือน'
        : 'เปิดสิทธิ์การแจ้งเตือนในการตั้งค่าเครื่องเพื่อรับการแจ้งเตือน';

    return (
      <button
        onClick={() => toast.info(hint)}
        aria-label={hint}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 flex-shrink-0"
      >
        <BellOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
      </button>
    );
  }

  if (status === 'subscribed') {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={busy}
        aria-label="ปิดการแจ้งเตือน"
        aria-pressed={true}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
      >
        <Bell className="w-5 h-5 text-sky-600 dark:text-sky-400" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleSubscribe}
        disabled={busy}
        aria-label="เปิดการแจ้งเตือน"
        aria-pressed={false}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
      >
        <BellOff className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      <AnimatePresence>
        {showPrompt && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={dismissPrompt}
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                      เปิดการแจ้งเตือน
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      รับการแจ้งเตือนทันทีเมื่อใบลาของคุณได้รับการอนุมัติหรือไม่อนุมัติ
                      กดที่ไอคอนกระดิ่งด้านบนหรือปุ่มด้านล่างเพื่อเปิดการแจ้งเตือน
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubscribe}
                        disabled={busy}
                        className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {busy ? 'กำลังเปิด...' : 'เปิดการแจ้งเตือน'}
                      </button>
                      <button
                        onClick={dismissPrompt}
                        disabled={busy}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        ไว้ก่อน
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
