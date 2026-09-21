'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCitizenId } from '@/lib/citizenIdFormat';
import { validateThaiCitizenId, getCitizenIdErrorMessage } from '@/lib/validateCitizenId';

function VerifyForm() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate citizen ID format
    const citizenIdValidationError = getCitizenIdErrorMessage(formData.citizenId);
    if (citizenIdValidationError) {
      setError(citizenIdValidationError);
      setCitizenIdError(citizenIdValidationError);
      toast.error('เลขบัตรประชาชนไม่ถูกต้อง', {
        description: citizenIdValidationError
      });
      return;
    }

    if (!formData.birthDate.day || !formData.birthDate.month || !formData.birthDate.year) {
      const errorMsg = 'กรุณาเลือกวันเดือนปีเกิด';
      setError(errorMsg);
      toast.error(errorMsg, {
        description: 'เลือกวัน เดือน และปีเกิดให้ครบถ้วน'
      });
      return;
    }

    setLoading(true);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    try {
      // Convert Buddhist year to Gregorian
      const yearNum = parseInt(formData.birthDate.year);
      if (isNaN(yearNum)) {
        toast.error('ปีเกิดไม่ถูกต้อง');
        setLoading(false);
        return;
      }
      const gregorianYear = yearNum - 543;
      const birthDateStr = `${gregorianYear}-${formData.birthDate.month.padStart(2, '0')}-${formData.birthDate.day.padStart(2, '0')}`;

      const response = await fetch('/api/auth/teacher/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenId: formData.citizenId,
          birthDate: birthDateStr,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.lockedUntil) {
          setLockedUntil(data.lockedUntil);
        }
        throw new Error(data.error || 'ยืนยันตัวตนไม่สำเร็จ');
      }

      toast.success('ยืนยันตัวตนสำเร็จ', {
        description: `ยินดีต้อนรับ คุณ${data.teacher?.firstName || ''}`
      });
      router.push(returnUrl);
    } catch (err: any) {
      let errorMsg = 'ยืนยันตัวตนไม่สำเร็จ';
      let errorDesc = err.message;

      if (err.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      } else if (err.message?.includes('ไม่พบ') || err.message?.includes('ไม่ถูกต้อง')) {
        errorMsg = 'ข้อมูลไม่ถูกต้อง';
        errorDesc = 'กรุณาตรวจสอบเลขบัตรประชาชนและวันเกิด หรือติดต่อฝ่ายบุคคล';
      } else if (err.message?.includes('ปิดใช้งาน') || err.message?.includes('ระงับ')) {
        errorMsg = 'บัญชีถูกระงับ';
        errorDesc = 'กรุณาติดต่อฝ่ายบุคคลเพื่อขอความช่วยเหลือ';
      } else if (err.message?.includes('ล็อก') || err.message?.includes('หลายครั้ง')) {
        errorMsg = 'พยายามหลายครั้งเกินไป';
        errorDesc = 'กรุณารอ 15 นาทีแล้วลองใหม่';
      }

      setError(errorMsg);
      toast.error(errorMsg, {
        description: errorDesc,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate day options (1-31)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Thai months
  const months = [
    { value: '1', label: 'มกราคม' },
    { value: '2', label: 'กุมภาพันธ์' },
    { value: '3', label: 'มีนาคม' },
    { value: '4', label: 'เมษายน' },
    { value: '5', label: 'พฤษภาคม' },
    { value: '6', label: 'มิถุนายน' },
    { value: '7', label: 'กรกฎาคม' },
    { value: '8', label: 'สิงหาคม' },
    { value: '9', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' },
    { value: '12', label: 'ธันวาคม' },
  ];

  // Generate year options (Buddhist years, 2450-2570 = ~1907-2027)
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const years = Array.from({ length: 100 }, (_, i) => currentBuddhistYear - i);

  // Lock screen
  if (lockedUntil) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            ยืนยันตัวตนผิดหลายครั้ง
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            กรุณารอ {lockedUntil} วินาที
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            ยืนยันตัวตน
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            กรุณากรอกข้อมูลเพื่อยืนยันตัวตน
          </p>
        </div>

        {/* Verify form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Citizen ID */}
            <div>
              <label
                htmlFor="citizenId"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                เลขบัตรประชาชน 13 หลัก
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <input
                  id="citizenId"
                  type="text"
                  inputMode="numeric"
                  value={formData.citizenId}
                  onChange={(e) => handleCitizenIdChange(e.target.value)}
                  className={`
                    w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent outline-none transition-all tracking-wider
                    ${citizenIdError ? 'border-red-500 focus:ring-red-500' : citizenIdValid ? 'border-emerald-500 focus:ring-emerald-500' : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'}
                  `}
                  placeholder="1234567890123"
                  required
                  disabled={loading}
                  autoComplete="off"
                  maxLength={13}
                />
                {formData.citizenId.length === 13 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {citizenIdValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {citizenIdError ? (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {citizenIdError}
                </motion.p>
              ) : citizenIdValid ? (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  เลขบัตรประชาชนถูกต้อง
                </motion.p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  กรอกตัวเลข 13 หลัก ไม่ต้องใส่ขีด (-) • {formData.citizenId.length}/13 หลัก
                </p>
              )}
            </div>

            {/* Birth date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันเดือนปีเกิด (พ.ศ.)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* Day */}
                <div>
                  <select
                    value={formData.birthDate.day}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        birthDate: { ...formData.birthDate, day: e.target.value },
                      })
                    }
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    required
                    disabled={loading}
                  >
                    <option value="">วัน</option>
                    {days.map((day) => (
                      <option key={day} value={day.toString()}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month */}
                <div>
                  <select
                    value={formData.birthDate.month}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        birthDate: { ...formData.birthDate, month: e.target.value },
                      })
                    }
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    required
                    disabled={loading}
                  >
                    <option value="">เดือน</option>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <select
                    value={formData.birthDate.year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        birthDate: { ...formData.birthDate, year: e.target.value },
                      })
                    }
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    required
                    disabled={loading}
                  >
                    <option value="">ปี</option>
                    {years.map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                ระบุวันเดือนปีเกิดตามบัตรประชาชน (ปี พ.ศ.)
              </p>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังยืนยันตัวตน...' : 'ยืนยันตัวตน'}
            </button>
          </form>

          {/* Back link */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
            >
              ← กลับหน้าแรก
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">กำลังโหลด...</div>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
