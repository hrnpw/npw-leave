'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion, animate, type Variants } from 'framer-motion';
import { Lock, User, Eye, EyeOff, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function HrLoginClient() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/hr/dashboard';
  const reduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const busy = loading || success;

  // Return focus to the password field after a failed attempt (inputs are re-enabled by then)
  useEffect(() => {
    if (error) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }, [error]);

  const shakeCard = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 40, 30]);
    }
    if (reduceMotion || !cardRef.current) return;
    animate(cardRef.current, { x: [0, -10, 10, -6, 6, -2, 0] }, { duration: 0.45, ease: 'easeInOut' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/hr/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      toast.success('เข้าสู่ระบบสำเร็จ', {
        description: `ยินดีต้อนรับ คุณ${data.user?.firstName || ''}`,
      });

      // Show the success state on the button, then fade the page out.
      // This also gives the cookie time to be fully set before navigation.
      setLoading(false);
      setSuccess(true);
      if ('vibrate' in navigator) {
        navigator.vibrate(15);
      }
      await sleep(reduceMotion ? 300 : 550);
      if (!reduceMotion && pageRef.current) {
        await animate(pageRef.current, { opacity: 0, scale: 0.98 }, { duration: 0.25, ease: 'easeIn' });
      }

      // Hard navigation so the session cookie is picked up on a fresh page load
      window.location.href = returnUrl;
    } catch (err: any) {
      let errorMsg = 'เข้าสู่ระบบไม่สำเร็จ';
      let errorDesc = err.message;

      if (err.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      } else if (err.message?.includes('ชื่อผู้ใช้') || err.message?.includes('รหัสผ่าน')) {
        errorMsg = 'ข้อมูลไม่ถูกต้อง';
        errorDesc = 'กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน';
      }

      setError({ title: errorMsg, description: errorDesc });
      setLoading(false);
      shakeCard();
    }
  };

  const updateCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  // Staggered entrance; collapses to a plain fade when reduced motion is requested
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06, delayChildren: reduceMotion ? 0 : 0.05 } },
  };
  const item: Variants = reduceMotion
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
      };
  const popIn = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.4 },
        animate: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 500, damping: 18 } },
        exit: { opacity: 0, scale: 0.4, transition: { duration: 0.12 } },
      };

  const inputClass = (hasError: boolean) =>
    `w-full pl-10 py-3 bg-slate-50 dark:bg-slate-800 border ${
      hasError ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-700'
    } rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-colors disabled:opacity-60`;

  return (
    <div
      ref={pageRef}
      className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-teal-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center justify-center p-4"
    >
      <motion.div variants={container} initial="hidden" animate="show" className="w-full max-w-md">
        {/* Header */}
        <motion.div variants={item} className="text-center mb-8">
          <div className="relative mx-auto mb-4 w-20 h-20">
            <motion.div
              aria-hidden="true"
              className="absolute -inset-3 rounded-full blur-xl"
              style={{ background: 'conic-gradient(from 0deg, #38bdf8, #2dd4bf, #7dd3fc, #5eead4, #38bdf8)' }}
              initial={{ opacity: 0.5 }}
              animate={
                reduceMotion
                  ? { opacity: 0.5 }
                  : { rotate: 360, opacity: [0.35, 0.65, 0.35], scale: [0.9, 1.03, 0.9] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      rotate: { duration: 10, ease: 'linear', repeat: Infinity },
                      opacity: { duration: 3, ease: 'easeInOut', repeat: Infinity },
                      scale: { duration: 3, ease: 'easeInOut', repeat: Infinity },
                    }
              }
            />
            <Image
              src="/icons/icon-192.png"
              alt="โรงเรียนบ้านเนินพลับหวาน"
              width={80}
              height={80}
              className="relative"
              priority
            />
          </div>
          <h1 className="text-display text-slate-900 dark:text-slate-100 mb-1">
            เข้าสู่ระบบเจ้าหน้าที่
          </h1>
          <p className="text-body-sm text-secondary">โรงเรียนบ้านเนินพลับหวาน</p>
        </motion.div>

        {/* Login form */}
        <div
          ref={cardRef}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <motion.div variants={item}>
              <label htmlFor="username" className="block text-label text-slate-700 dark:text-slate-300 mb-2">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-5 h-5" aria-hidden="true" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  aria-invalid={error ? true : undefined}
                  className={`${inputClass(Boolean(error))} pr-4`}
                  placeholder="กรอกชื่อผู้ใช้"
                  required
                  disabled={busy}
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={item}>
              <label htmlFor="password" className="block text-label text-slate-700 dark:text-slate-300 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-5 h-5" aria-hidden="true" />
                </div>
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  onBlur={() => setCapsLock(false)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={capsLock ? 'caps-lock-hint' : undefined}
                  className={`${inputClass(Boolean(error))} pr-12`}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  disabled={busy}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  disabled={busy}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={showPassword ? 'hide' : 'show'}
                      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
                      transition={{ duration: reduceMotion ? 0 : 0.12 }}
                      className="block"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden="true" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
              <AnimatePresence initial={false}>
                {capsLock && (
                  <motion.p
                    id="caps-lock-hint"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15 }}
                    className="overflow-hidden"
                  >
                    <span className="mt-2 flex items-center gap-1.5 text-caption text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Caps Lock เปิดอยู่
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Error message */}
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="error"
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-body-sm font-medium text-red-600 dark:text-red-400">{error.title}</p>
                    <p className="text-body-sm text-red-600/80 dark:text-red-400/80">{error.description}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.div variants={item}>
              <button
                type="submit"
                disabled={busy}
                className={`w-full py-3 text-white font-semibold rounded-xl shadow-lg transition-[transform,opacity] active:scale-95 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                  success
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 disabled:opacity-60'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {success ? (
                    <motion.span key="success" {...popIn} className="inline-flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      เข้าสู่ระบบสำเร็จ
                    </motion.span>
                  ) : loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center justify-center gap-2"
                    >
                      <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      กำลังเข้าสู่ระบบ
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      เข้าสู่ระบบ
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          </form>

          {/* Help note + back link */}
          <motion.div variants={item} className="mt-6 space-y-4 text-center">
            <p className="text-caption text-tertiary">
              ลืมรหัสผ่าน? กรุณาติดต่อผู้ดูแลระบบ
            </p>
            <Link
              href="/"
              className="inline-block text-body-sm text-secondary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ← กลับหน้าแรก
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
