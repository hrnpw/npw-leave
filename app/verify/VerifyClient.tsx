'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion, animate, type Variants } from 'framer-motion';
import { CreditCard, Calendar, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatCitizenIdPartial, caretIndexAfterDigits } from '@/lib/citizenIdFormat';
import { validateThaiCitizenId, getCitizenIdErrorMessage } from '@/lib/validateCitizenId';

const months = [
  { value: '01', label: 'มกราคม' },
  { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' },
  { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' },
  { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' },
  { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' },
];

// Number of days in a month; leap year assumed until a year is picked so 29 Feb stays selectable
function getDaysInMonth(month: string, buddhistYear: string): number {
  if (!month) return 31;
  const year = buddhistYear ? parseInt(buddhistYear, 10) - 543 : 2000;
  return new Date(year, parseInt(month, 10), 0).getDate();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function VerifyClient() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/teacher';
  const reduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    citizenId: '',
    birthDate: {
      day: '',
      month: '',
      year: '',
    },
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [citizenIdError, setCitizenIdError] = useState<string | null>(null);
  const [citizenIdValid, setCitizenIdValid] = useState(false);

  const citizenInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  // Digit count before the caret, restored after the value is re-formatted
  const pendingCaretDigits = useRef<number | null>(null);

  const formattedCitizenId = formatCitizenIdPartial(formData.citizenId);
  const digitCount = formData.citizenId.length;
  const { day, month, year } = formData.birthDate;
  const birthDateComplete = Boolean(day && month && year);
  const canSubmit = citizenIdValid && birthDateComplete;
  const busy = loading || success;

  useLayoutEffect(() => {
    const input = citizenInputRef.current;
    if (pendingCaretDigits.current === null || !input) return;
    const pos = caretIndexAfterDigits(formattedCitizenId, pendingCaretDigits.current);
    input.setSelectionRange(pos, pos);
    pendingCaretDigits.current = null;
  });

  const handleCitizenIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = e.target;
    // Remove all non-digits (including dashes, spaces)
    const cleaned = value.replace(/\D/g, '');
    // Only update if within limit
    if (cleaned.length > 13) return;

    // Keep the caret next to the same digit after dashes are re-inserted
    const caret = selectionStart ?? value.length;
    pendingCaretDigits.current = value.slice(0, caret).replace(/\D/g, '').length;

    setFormData(prev => ({ ...prev, citizenId: cleaned }));
    setError('');

    // Validate in real-time
    if (cleaned.length === 13) {
      const isValid = validateThaiCitizenId(cleaned);
      setCitizenIdValid(isValid);
      if (!isValid) {
        setCitizenIdError('เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      } else {
        setCitizenIdError(null);
      }
    } else {
      setCitizenIdValid(false);
      setCitizenIdError(null);
    }
  };

  const handleBirthDateChange = (field: 'day' | 'month' | 'year', value: string) => {
    setFormData(prev => {
      const birthDate = { ...prev.birthDate, [field]: value };
      // Clear a day that no longer exists in the chosen month (e.g. 31 → February)
      if (birthDate.day && parseInt(birthDate.day, 10) > getDaysInMonth(birthDate.month, birthDate.year)) {
        birthDate.day = '';
      }
      return { ...prev, birthDate };
    });
    setError('');
  };

  // Generate options for dropdowns
  const days = Array.from({ length: getDaysInMonth(month, year) }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const currentYear = new Date().getFullYear() + 543;
  const years = Array.from({ length: 46 }, (_, i) => (currentYear - 20 - i).toString());

  const shakeCard = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 40, 30]);
    }
    if (reduceMotion || !cardRef.current) return;
    animate(cardRef.current, { x: [0, -10, 10, -6, 6, -2, 0] }, { duration: 0.45, ease: 'easeInOut' });
  };

  const submitHint = !citizenIdValid
    ? digitCount < 13
      ? 'กรอกเลขบัตรประชาชนให้ครบ 13 หลัก'
      : 'ตรวจสอบเลขบัตรประชาชนอีกครั้ง'
    : !birthDateComplete
    ? 'เลือกวัน เดือน และปีเกิดให้ครบ'
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if locked
    if (lockedUntil && Date.now() < lockedUntil) {
      const remainingSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`กรุณารออีก ${remainingSeconds} วินาที ก่อนลองใหม่`);
      shakeCard();
      return;
    }

    // Client-side validation for citizen ID
    if (!citizenIdValid) {
      const errorMsg = getCitizenIdErrorMessage(formData.citizenId);
      setCitizenIdError(errorMsg || 'เลขบัตรประชาชนไม่ถูกต้อง');
      setError(errorMsg || 'เลขบัตรประชาชนไม่ถูกต้อง');
      shakeCard();
      return;
    }

    if (!birthDateComplete) {
      setError('กรุณาเลือกวันเดือนปีเกิดให้ครบถ้วน');
      shakeCard();
      return;
    }

    const buddhistYear = parseInt(year, 10);

    const christianYear = buddhistYear - 543;
    const birthDate = `${christianYear}-${month}-${day}`;

    setLoading(true);
    setError('');

    try {
      console.log('[Verify] Starting verification process');

      const response = await fetch('/api/auth/teacher/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenId: formData.citizenId,
          birthDate,
        }),
        credentials: 'include', // Ensure cookies are included
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const lockDuration = 30000;
          const lockUntilTime = Date.now() + lockDuration;
          setLockedUntil(lockUntilTime);
          setError(data.error || 'พยายามหลายครั้งเกินไป กรุณารอ 30 วินาที');

          setTimeout(() => {
            setLockedUntil(null);
          }, lockDuration);
        } else {
          setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
        setLoading(false);
        shakeCard();
        return;
      }

      toast.success('ยืนยันตัวตนสำเร็จ', {
        description: `ยินดีต้อนรับ ${data.teacher?.firstName || ''} ${data.teacher?.lastName || ''}`,
      });

      console.log('[Verify] Login successful, redirecting to:', returnUrl);

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

      // Use window.location.href for hard navigation to ensure fresh page load
      // This prevents cache issues and ensures session is properly loaded
      window.location.href = returnUrl;
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
      shakeCard();
    }
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

  const selectClass = (filled: boolean) =>
    `w-full px-3 py-3 pr-8 appearance-none bg-slate-50 dark:bg-slate-800 border ${
      birthDateComplete
        ? 'border-green-500 dark:border-green-400'
        : filled
        ? 'border-slate-400 dark:border-slate-500'
        : 'border-slate-300 dark:border-slate-700'
    } rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-colors`;

  const chevron = (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );

  return (
    <div ref={pageRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div variants={container} initial="hidden" animate="show" className="w-full max-w-md">
        {/* Header */}
        <motion.div variants={item} className="text-center mb-8">
          <div className="relative mx-auto mb-4 w-20 h-20">
            {/* Green-yellow glow: a blurred conic gradient that slowly rotates and breathes */}
            <motion.div
              aria-hidden="true"
              className="absolute -inset-3 rounded-full blur-xl"
              style={{
                background:
                  'conic-gradient(from 0deg, #a3e635, #facc15, #4ade80, #fde047, #a3e635)',
              }}
              initial={{ opacity: 0.55 }}
              animate={
                reduceMotion
                  ? { opacity: 0.55 }
                  : { rotate: 360, opacity: [0.40, 0.75, 0.40], scale: [0.90, 1.03, 0.90] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      rotate: { duration: 8, ease: 'linear', repeat: Infinity },
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            ยืนยันตัวตน
          </h1>
        </motion.div>

        {/* Login form */}
        <div
          ref={cardRef}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Citizen ID */}
            <motion.div variants={item}>
              <label
                htmlFor="citizenId"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                เลขบัตรประชาชน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <CreditCard className="w-5 h-5" aria-hidden="true" />
                </div>
                <input
                  ref={citizenInputRef}
                  id="citizenId"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formattedCitizenId}
                  onChange={handleCitizenIdChange}
                  aria-invalid={citizenIdError ? true : undefined}
                  aria-describedby={citizenIdError ? 'citizenId-error' : 'citizenId-progress'}
                  className={`w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border ${
                    citizenIdError
                      ? 'border-red-500 dark:border-red-400'
                      : citizenIdValid
                      ? 'border-green-500 dark:border-green-400'
                      : 'border-slate-300 dark:border-slate-700'
                  } rounded-xl text-lg tracking-wider tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-base placeholder:tracking-normal focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-colors`}
                  placeholder="X-XXXX-XXXXX-XX-X"
                  disabled={busy}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AnimatePresence mode="wait" initial={false}>
                    {digitCount === 13 &&
                      (citizenIdValid ? (
                        <motion.span key="valid" {...popIn} className="block">
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" aria-hidden="true" />
                        </motion.span>
                      ) : (
                        <motion.span key="invalid" {...popIn} className="block">
                          <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" aria-hidden="true" />
                        </motion.span>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-1 min-h-5 text-sm">
                {citizenIdError ? (
                  <p id="citizenId-error" className="text-red-600 dark:text-red-400">
                    {citizenIdError}
                  </p>
                ) : (
                  <p
                    id="citizenId-progress"
                    className={`tabular-nums ${
                      citizenIdValid ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {citizenIdValid ? 'เลขบัตรถูกต้อง' : `${digitCount}/13 หลัก`}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Birth Date */}
            <motion.div variants={item}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" aria-hidden="true" />
                วันเดือนปีเกิด (พ.ศ.)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* Day Dropdown */}
                <div className="relative">
                  <select
                    value={day}
                    onChange={(e) => handleBirthDateChange('day', e.target.value)}
                    className={selectClass(Boolean(day))}
                    disabled={busy}
                    required
                  >
                    <option value="">วัน</option>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>

                {/* Month Dropdown */}
                <div className="relative">
                  <select
                    value={month}
                    onChange={(e) => handleBirthDateChange('month', e.target.value)}
                    className={selectClass(Boolean(month))}
                    disabled={busy}
                    required
                  >
                    <option value="">เดือน</option>
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>

                {/* Year Dropdown */}
                <div className="relative">
                  <select
                    value={year}
                    onChange={(e) => handleBirthDateChange('year', e.target.value)}
                    className={selectClass(Boolean(year))}
                    disabled={busy}
                    required
                  >
                    <option value="">ปี พ.ศ.</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              </div>
            </motion.div>

            {/* Error message */}
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.div variants={item}>
              <motion.button
                type="submit"
                disabled={busy}
                aria-describedby={submitHint ? 'submit-hint' : undefined}
                className={`w-full py-3 text-white font-semibold rounded-xl shadow-lg transition-[transform,opacity] active:scale-95 disabled:cursor-not-allowed ${
                  success
                    ? 'bg-green-500'
                    : `bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 ${
                        canSubmit ? '' : 'opacity-60'
                      } disabled:opacity-60`
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {success ? (
                    <motion.span key="success" {...popIn} className="inline-flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ยืนยันตัวตนสำเร็จ
                    </motion.span>
                  ) : loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center justify-center gap-1"
                    >
                      กำลังตรวจสอบ
                      <span className="inline-flex gap-1 ml-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      ยืนยันตัวตน
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              {submitHint && !busy && (
                <p id="submit-hint" className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  {submitHint}
                </p>
              )}
            </motion.div>
          </form>

          {/* Privacy note + back link */}
          <motion.div variants={item} className="mt-6 space-y-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ข้อมูลนี้ใช้เพื่อยืนยันตัวตนเท่านั้น
            </p>
            <Link
              href="/"
              className="inline-block text-sm text-slate-600 dark:text-slate-400 hover:underline"
            >
              ← กลับหน้าแรก
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
