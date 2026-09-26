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
    setFormData({
      ...formData,
      birthDate: {
        ...formData.birthDate,
        [field]: value,
      },
    });
  };

  // Generate options for dropdowns
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
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
  const currentYear = new Date().getFullYear() + 543;
  const years = Array.from({ length: 46 }, (_, i) => (currentYear - 20 - i).toString());

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
    if (!day || !month || !year) {
      setError('กรุณาเลือกวันเดือนปีเกิดให้ครบถ้วน');
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
        return;
      }

      toast.success('ยืนยันตัวตนสำเร็จ', {
        description: `ยินดีต้อนรับ ${data.teacher?.firstName || ''} ${data.teacher?.lastName || ''}`,
      });

      console.log('[Verify] Login successful, redirecting to:', returnUrl);

      // Wait a bit for cookie to be fully set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use router.push with replace to prevent back button issues
      // This will trigger middleware to check the new cookie
      router.replace(returnUrl);
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            ยืนยันตัวตน
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            โรงเรียนบ้านเนินพลับหวาน
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Citizen ID */}
            <div>
              <label
                htmlFor="citizenId"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                เลขบัตรประชาชน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <input
                  id="citizenId"
                  type="text"
                  inputMode="numeric"
                  value={formatCitizenId(formData.citizenId)}
                  onChange={(e) => handleCitizenIdChange(e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border ${
                    citizenIdError
                      ? 'border-red-500 dark:border-red-400'
                      : citizenIdValid
                      ? 'border-green-500 dark:border-green-400'
                      : 'border-slate-300 dark:border-slate-700'
                  } rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all`}
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
                {/* Day Dropdown */}
                <div className="relative">
                  <select
                    value={formData.birthDate.day}
                    onChange={(e) => handleBirthDateChange('day', e.target.value)}
                    className="w-full px-3 py-3 pr-8 appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    disabled={loading}
                    required
                  >
                    <option value="">วัน</option>
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Month Dropdown */}
                <div className="relative">
                  <select
                    value={formData.birthDate.month}
                    onChange={(e) => handleBirthDateChange('month', e.target.value)}
                    className="w-full px-3 py-3 pr-8 appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    disabled={loading}
                    required
                  >
                    <option value="">เดือน</option>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Year Dropdown */}
                <div className="relative">
                  <select
                    value={formData.birthDate.year}
                    onChange={(e) => handleBirthDateChange('year', e.target.value)}
                    className="w-full px-3 py-3 pr-8 appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    disabled={loading}
                    required
                  >
                    <option value="">ปี พ.ศ.</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
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
              disabled={loading || !citizenIdValid}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'ยืนยันตัวตน'}
            </button>
          </form>

          {/* Back link */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
            >
              ← กลับหน้าแรก
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
