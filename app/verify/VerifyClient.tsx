'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCitizenId } from '@/lib/citizenIdFormat';
import { validateThaiCitizenId, getCitizenIdErrorMessage } from '@/lib/validateCitizenId';

export default function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/teacher';

  const [formData, setFormData] = useState({
    citizenId: '',
    birthDate: {
      day: '',
      month: '',
      year: '',
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [citizenIdError, setCitizenIdError] = useState<string | null>(null);
  const [citizenIdValid, setCitizenIdValid] = useState(false);

  const handleCitizenIdChange = (value: string) => {
    // Remove all non-digits (including dashes, spaces)
    const cleaned = value.replace(/\D/g, '');
    // Only update if within limit
    if (cleaned.length <= 13) {
      setFormData({ ...formData, citizenId: cleaned });

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
    }
  };

  const handleBirthDateChange = (field: 'day' | 'month' | 'year', value: string) => {
    const cleaned = value.replace(/\D/g, '');

    let maxLength = 2;
    if (field === 'year') maxLength = 4;

    if (cleaned.length <= maxLength) {
      setFormData({
        ...formData,
        birthDate: {
          ...formData.birthDate,
          [field]: cleaned,
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if locked
    if (lockedUntil && Date.now() < lockedUntil) {
      const remainingSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`กรุณารออีก ${remainingSeconds} วินาที ก่อนลองใหม่`);
      return;
    }

    // Client-side validation for citizen ID
    if (!citizenIdValid) {
      const errorMsg = getCitizenIdErrorMessage(formData.citizenId);
      setCitizenIdError(errorMsg || 'เลขบัตรประชาชนไม่ถูกต้อง');
      setError(errorMsg || 'เลขบัตรประชาชนไม่ถูกต้อง');
      return;
    }

    const { day, month, year } = formData.birthDate;
    if (!day || !month || !year || year.length !== 4) {
      setError('กรุณากรอกวันเดือนปีเกิดให้ครบถ้วน');
      return;
    }

    const buddhistYear = parseInt(year, 10);
    if (buddhistYear < 2400 || buddhistYear > 2600) {
      setError('กรุณากรอกปีเกิดเป็น พ.ศ. (เช่น 2530)');
      return;
    }

    const christianYear = buddhistYear - 543;
    const birthDate = `${christianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    setLoading(true);
    setError('');

    try {
      // Delete old cookie before verify
      document.cookie = 'teacher_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      const response = await fetch('/api/auth/teacher/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenId: formData.citizenId,
          birthDate,
        }),
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
        return;
      }

      toast.success('ยืนยันตัวตนสำเร็จ', {
        description: `ยินดีต้อนรับ ${data.teacher?.firstName || ''} ${data.teacher?.lastName || ''}`,
      });

      // Verify session before navigation to prevent race condition
      try {
        const verifyRes = await fetch('/api/auth/teacher/extend', { method: 'POST' });
        if (verifyRes.ok) {
          // Session verified, safe to use client-side navigation
          router.push(returnUrl);
        } else {
          // Session not ready, use full page reload as fallback
          window.location.href = returnUrl;
        }
      } catch {
        // Network error, use full page reload as fallback
        window.location.href = returnUrl;
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 mb-4">
              <CreditCard className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              ยืนยันตัวตน
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              กรอกเลขบัตรประชาชนและวันเดือนปีเกิดเพื่อเข้าสู่ระบบ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Citizen ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                เลขบัตรประชาชน
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCitizenId(formData.citizenId)}
                  onChange={(e) => handleCitizenIdChange(e.target.value)}
                  className={`w-full px-4 py-3 pr-10 rounded-lg border ${
                    citizenIdError
                      ? 'border-red-500 dark:border-red-400'
                      : citizenIdValid
                      ? 'border-green-500 dark:border-green-400'
                      : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors`}
                  placeholder="X-XXXX-XXXXX-XX-X"
                  disabled={loading}
                  required
                />
                {formData.citizenId.length === 13 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {citizenIdValid ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    )}
                  </div>
                )}
              </div>
              {citizenIdError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {citizenIdError}
                </p>
              )}
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                วันเดือนปีเกิด (พ.ศ.)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.birthDate.day}
                  onChange={(e) => handleBirthDateChange('day', e.target.value)}
                  className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors text-center"
                  placeholder="วัน"
                  disabled={loading}
                  required
                  maxLength={2}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.birthDate.month}
                  onChange={(e) => handleBirthDateChange('month', e.target.value)}
                  className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors text-center"
                  placeholder="เดือน"
                  disabled={loading}
                  required
                  maxLength={2}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.birthDate.year}
                  onChange={(e) => handleBirthDateChange('year', e.target.value)}
                  className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors text-center"
                  placeholder="ปี พ.ศ."
                  disabled={loading}
                  required
                  maxLength={4}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !citizenIdValid}
              className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-medium disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  กำลังตรวจสอบ...
                </span>
              ) : (
                'ยืนยันตัวตน'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            <p>ไม่สามารถเข้าสู่ระบบได้?</p>
            <p className="mt-1">กรุณาติดต่อฝ่ายบุคคล</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
