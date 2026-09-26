'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Key, X } from 'lucide-react';
import { toast } from 'sonner';

export default function HrLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/hr/dashboard';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    try {
      console.log('[HR Login] Starting login process');

      const response = await fetch('/api/auth/hr/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include', // Ensure cookies are included
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.lockedUntil) {
          setLockedUntil(data.lockedUntil);
        }
        throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      toast.success('เข้าสู่ระบบสำเร็จ', {
        description: `ยินดีต้อนรับ คุณ${data.user?.firstName || ''}`
      });

      console.log('[HR Login] Login successful, redirecting to:', returnUrl);

      // Wait a bit for cookie to be fully set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use router.replace with replace to prevent back button issues
      // This will trigger proxy to check the new cookie
      router.replace(returnUrl);
    } catch (err: any) {
      let errorMsg = 'เข้าสู่ระบบไม่สำเร็จ';
      let errorDesc = err.message;

      if (err.message === 'Failed to fetch') {
        errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
      } else if (err.message?.includes('ชื่อผู้ใช้') || err.message?.includes('รหัสผ่าน')) {
        errorMsg = 'ข้อมูลไม่ถูกต้อง';
        errorDesc = 'กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน';
      } else if (err.message?.includes('ล็อก') || err.message?.includes('หลายครั้ง')) {
        errorMsg = 'บัญชีถูกล็อกชั่วคราว';
        errorDesc = 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที';
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน', {
        description: 'กรุณากรอกรหัสผ่านใหม่ให้ตรงกันทั้งสองช่อง',
      });
      return;
    }

    if (changePasswordForm.newPassword.length < 8) {
      toast.error('รหัสผ่านสั้นเกินไป', {
        description: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/hr/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: changePasswordForm.currentPassword,
          newPassword: changePasswordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }

      toast.success('เปลี่ยนรหัสผ่านสำเร็จ', {
        description: 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่',
      });

      setShowChangePassword(false);
      setChangePasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for lock
  if (lockedUntil) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            บัญชีถูกล็อก
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ {lockedUntil} วินาที
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
            เข้าสู่ระบบเจ้าหน้าที่
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            โรงเรียนบ้านเนินพลับหวาน
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                  placeholder="กรอกชื่อผู้ใช้"
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                  placeholder="กรอกรหัสผ่าน"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
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
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
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

        {/* Change Password Dialog */}
        {showChangePassword && (
          <AnimatePresence>
            <motion.div
              key="change-password-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowChangePassword(false)}
            />
            <motion.div
              key="change-password-dialog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      เปลี่ยนรหัสผ่าน
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowChangePassword(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      รหัสผ่านปัจจุบัน
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={changePasswordForm.currentPassword}
                        onChange={(e) =>
                          setChangePasswordForm({
                            ...changePasswordForm,
                            currentPassword: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="กรอกรหัสผ่านปัจจุบัน"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      รหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={changePasswordForm.newPassword}
                        onChange={(e) =>
                          setChangePasswordForm({
                            ...changePasswordForm,
                            newPassword: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="ขั้นต่ำ 8 ตัวอักษร"
                        required
                        disabled={loading}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      value={changePasswordForm.confirmPassword}
                      onChange={(e) =>
                        setChangePasswordForm({
                          ...changePasswordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(false)}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}
