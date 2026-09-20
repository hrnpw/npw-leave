'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  Send,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface SettingsClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface Signatory {
  id: string;
  role: 'director' | 'hr_head';
  title: string;
  firstName: string;
  lastName: string;
  position: string;
  isActive: boolean;
}

interface Settings {
  id: string;
  schoolName: string;
  systemStartDate: string;
  backdateLimitDays: number;
  hrBackdateLimitDays: number;
  quotaSickPersonal: number;
  quotaMaternity: number;
  quotaReligious: number;
  requireTeacherSignature: boolean;
  currentDirectorId: string | null;
  currentHrHeadId: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
}

export default function SettingsClient({ hrUser }: SettingsClientProps) {
  const router = useRouter();
  const isSuperAdmin = hrUser.role === 'super_admin';

  const [settings, setSettings] = useState<Settings | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    schoolName: '',
    backdateLimitDays: 14,
    hrBackdateLimitDays: 30,
    quotaSickPersonal: 23,
    quotaMaternity: 90,
    quotaReligious: 120,
    requireTeacherSignature: false,
    currentDirectorId: '',
    currentHrHeadId: '',
    telegramBotToken: '',
    telegramChatId: '',
  });

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, signatoriesRes, pendingRes] = await Promise.all([
        fetch('/api/hr/settings'),
        fetch('/api/hr/signatories'),
        fetch('/api/hr/leaves/pendingCount'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
        setFormData({
          schoolName: data.schoolName || '',
          backdateLimitDays: data.backdateLimitDays,
          hrBackdateLimitDays: data.hrBackdateLimitDays,
          quotaSickPersonal: data.quotaSickPersonal,
          quotaMaternity: data.quotaMaternity,
          quotaReligious: data.quotaReligious,
          requireTeacherSignature: data.requireTeacherSignature || false,
          currentDirectorId: data.currentDirectorId || '',
          currentHrHeadId: data.currentHrHeadId || '',
          telegramBotToken: data.telegramBotToken || '',
          telegramChatId: data.telegramChatId || '',
        });
      }

      if (signatoriesRes.ok) {
        const data = await signatoriesRes.json();
        setSignatories(data.signatories.filter((s: Signatory) => s.isActive));
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    // Validation
    if (!formData.schoolName.trim()) {
      toast.error('กรุณากรอกชื่อโรงเรียน');
      return;
    }

    if (formData.backdateLimitDays < 0 || formData.backdateLimitDays > 90) {
      toast.error('วันย้อนหลังของครูต้องอยู่ระหว่าง 0-90 วัน');
      return;
    }

    if (formData.hrBackdateLimitDays < 0 || formData.hrBackdateLimitDays > 90) {
      toast.error('วันย้อนหลังของ HR ต้องอยู่ระหว่าง 0-90 วัน');
      return;
    }

    if (isSuperAdmin) {
      if (formData.quotaSickPersonal < 1 || formData.quotaSickPersonal > 365) {
        toast.error('โควตาป่วย/กิจต้องอยู่ระหว่าง 1-365 วัน');
        return;
      }

      if (formData.quotaMaternity < 1 || formData.quotaMaternity > 365) {
        toast.error('โควตาคลอดต้องอยู่ระหว่าง 1-365 วัน');
        return;
      }

      if (formData.quotaReligious < 1 || formData.quotaReligious > 365) {
        toast.error('โควตาทางศาสนาต้องอยู่ระหว่าง 1-365 วัน');
        return;
      }
    }

    try {
      setSaving(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const payload: any = {
        schoolName: formData.schoolName.trim(),
        backdateLimitDays: formData.backdateLimitDays,
        hrBackdateLimitDays: formData.hrBackdateLimitDays,
        currentDirectorId: formData.currentDirectorId || null,
        currentHrHeadId: formData.currentHrHeadId || null,
      };

      if (isSuperAdmin) {
        payload.quotaSickPersonal = formData.quotaSickPersonal;
        payload.quotaMaternity = formData.quotaMaternity;
        payload.quotaReligious = formData.quotaReligious;
        payload.requireTeacherSignature = formData.requireTeacherSignature;
        payload.telegramBotToken = formData.telegramBotToken.trim() || null;
        payload.telegramChatId = formData.telegramChatId.trim() || null;
      }

      const response = await fetch('/api/hr/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      toast.success('บันทึกการตั้งค่าสำเร็จ');
      await fetchData();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (testingTelegram) return;

    try {
      setTestingTelegram(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      const response = await fetch('/api/telegram/test', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send');
      }

      toast.success('ส่งข้อความทดสอบสำเร็จ');
    } catch (error: any) {
      console.error('Test Telegram error:', error);
      toast.error(error.message || 'ไม่สามารถส่งข้อความได้');
    } finally {
      setTestingTelegram(false);
    }
  };

  const directors = signatories.filter((s) => s.role === 'director');
  const hrHeads = signatories.filter((s) => s.role === 'hr_head');

  if (loading) {
    return (
      <HrLayoutWrapper
        hrUser={{
          id: hrUser.id,
          firstName: hrUser.firstName,
          lastName: hrUser.lastName,
          role: hrUser.role,
          createdAt: Date.now(),
        }}
        pendingCount={pendingCount}
      >
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-4xl mx-auto px-4 py-6">
              <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </header>
          <main className="max-w-4xl mx-auto px-4 py-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-6 h-48 animate-pulse"
                />
              ))}
            </div>
          </main>
        </div>
      </HrLayoutWrapper>
    );
  }

  return (
    <HrLayoutWrapper
      hrUser={{
        id: hrUser.id,
        firstName: hrUser.firstName,
        lastName: hrUser.lastName,
        role: hrUser.role,
        createdAt: Date.now(),
      }}
      pendingCount={pendingCount}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="กลับ"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ตั้งค่าระบบ
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  กำหนดพารามิเตอร์และการตั้งค่าต่างๆ
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
          {/* General Settings */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              ตั้งค่าทั่วไป
            </h2>

            <div className="space-y-4">
              {/* School Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ชื่อโรงเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) =>
                    setFormData({ ...formData, schoolName: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                  placeholder="โรงเรียนบ้านเนินพลับหวาน"
                />
              </div>

              {/* Backdate Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ย้อนหลัง (ครู) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={formData.backdateLimitDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          backdateLimitDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      วัน
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ครูยื่นย้อนหลังได้ไม่เกิน (0-90 วัน)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ย้อนหลัง (HR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={formData.hrBackdateLimitDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hrBackdateLimitDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      วัน
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    HR ยื่นแทนย้อนหลังได้ไม่เกิน (0-90 วัน)
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Quotas - Super Admin Only */}
          {isSuperAdmin && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg mt-0.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    โควตาวันลา
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    เฉพาะ Super Admin เท่านั้น · เปลี่ยนโควตาต้องระมัดระวัง
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ป่วย/กิจส่วนตัว <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.quotaSickPersonal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quotaSickPersonal: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      วัน
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    คลอดบุตร <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.quotaMaternity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quotaMaternity: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      วัน
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ทางศาสนา <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.quotaReligious}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quotaReligious: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      วัน
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  โควตาใช้เทียบกับ days_calendar (รวมวันหยุด) · ระบบเตือนเท่านั้น ไม่บล็อกการยื่น
                </p>
              </div>

              {/* Require Teacher Signature */}
              <div className="mt-4 flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <input
                  type="checkbox"
                  id="requireTeacherSignature"
                  checked={formData.requireTeacherSignature}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requireTeacherSignature: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-400 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                />
                <label
                  htmlFor="requireTeacherSignature"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  บังคับครูต้องลงนามยืนยันก่อนยื่นใบลา
                </label>
              </div>
            </motion.section>
          )}

          {/* Signatories */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isSuperAdmin ? 0.2 : 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                ผู้ลงนาม
              </h2>
              <button
                onClick={() => router.push('/hr/signatories')}
                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                จัดการผู้ลงนาม
              </button>
            </div>

            <div className="space-y-4">
              {/* Director */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ผู้อำนวยการโรงเรียน
                </label>
                <select
                  value={formData.currentDirectorId}
                  onChange={(e) =>
                    setFormData({ ...formData, currentDirectorId: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                >
                  <option value="">-- ยังไม่ได้เลือก --</option>
                  {directors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}{d.firstName} {d.lastName} ({d.position})
                    </option>
                  ))}
                </select>
                {directors.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ยังไม่มีข้อมูลผู้อำนวยการ กรุณาเพิ่มที่หน้าจัดการผู้ลงนาม
                  </p>
                )}
              </div>

              {/* HR Head */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  หัวหน้าฝ่ายบุคคล
                </label>
                <select
                  value={formData.currentHrHeadId}
                  onChange={(e) =>
                    setFormData({ ...formData, currentHrHeadId: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                >
                  <option value="">-- ยังไม่ได้เลือก --</option>
                  {hrHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}{h.firstName} {h.lastName} ({h.position})
                    </option>
                  ))}
                </select>
                {hrHeads.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ยังไม่มีข้อมูลหัวหน้าฝ่ายบุคคล กรุณาเพิ่มที่หน้าจัดการผู้ลงนาม
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* Telegram - Super Admin Only */}
          {isSuperAdmin && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg mt-0.5">
                  <Send className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Telegram
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    เฉพาะ Super Admin เท่านั้น · แจ้งเตือนใบลาใหม่และสรุปประจำวัน
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Bot Token */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Bot Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={formData.telegramBotToken}
                      onChange={(e) =>
                        setFormData({ ...formData, telegramBotToken: e.target.value })
                      }
                      className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 font-mono text-sm"
                      placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      aria-label={showToken ? 'ซ่อน' : 'แสดง'}
                    >
                      {showToken ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ได้จาก @BotFather บน Telegram
                  </p>
                </div>

                {/* Chat ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Chat ID
                  </label>
                  <input
                    type="text"
                    value={formData.telegramChatId}
                    onChange={(e) =>
                      setFormData({ ...formData, telegramChatId: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 font-mono text-sm"
                    placeholder="-1001234567890"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Group chat ID (เริ่มด้วย - สำหรับกลุ่ม)
                  </p>
                </div>

                {/* Test Button */}
                <div>
                  <button
                    onClick={handleTestTelegram}
                    disabled={testingTelegram || !formData.telegramBotToken || !formData.telegramChatId}
                    className="w-full sm:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {testingTelegram ? 'กำลังส่ง...' : 'ทดสอบส่งข้อความ'}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    ส่งข้อความทดสอบไปยังกลุ่ม Telegram ที่ตั้งค่าไว้
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </main>

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 md:pl-64 safe-area-bottom z-10">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed active:scale-[0.97]"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  บันทึกการตั้งค่า
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </HrLayoutWrapper>
  );
}
