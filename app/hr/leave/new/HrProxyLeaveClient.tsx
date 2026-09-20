'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  User,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateForAPI } from '@/lib/dateFormat';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import LeaveTypeStep from '@/app/teacher/leave/new/steps/LeaveTypeStep';
import DateRangeStep from '@/app/teacher/leave/new/steps/DateRangeStep';
import DetailsStep from '@/app/teacher/leave/new/steps/DetailsStep';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';

interface HrProxyLeaveClientProps {
  hrUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'hr' | 'super_admin';
  };
}

interface Teacher {
  id: string;
  teacherCode: string;
  title: string;
  firstName: string;
  lastName: string;
  position: string;
  department?: string;
}

interface TeacherSummary {
  teacher: Teacher;
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  summary: {
    sickPersonal: { used: number; quota: number; remaining: number; exceeds: number };
    maternity: { used: number; quota: number; remaining: number; exceeds: number };
    religious: { used: number; quota: number; remaining: number; exceeds: number };
    other: { used: number; quota: null; remaining: null; exceeds: number };
  };
}

const PROXY_REASONS = [
  'ครูไม่สะดวกใช้งานระบบออนไลน์',
  'ครูยื่นเอกสารกระดาษ',
  'ครูลาป่วยกะทันหันแจ้งทางโทรศัพท์',
  'อื่นๆ (ระบุ)',
];

export default function HrProxyLeaveClient({ hrUser }: HrProxyLeaveClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 0: Teacher selection
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherSummary, setTeacherSummary] = useState<TeacherSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [proxyReason, setProxyReason] = useState('');
  const [customProxyReason, setCustomProxyReason] = useState('');
  const [showSelfSelectWarning, setShowSelfSelectWarning] = useState(false);

  // Step 1-3: Same as teacher form
  const [formData, setFormData] = useState({
    type: null as LeaveType | null,
    customTypeName: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    isHalfDay: false,
    halfDayPeriod: 'morning' as HalfDayPeriod,
    reason: '',
    contactAddress: '',
    contactPhone: '',
    proxyNote: '',
    teacherSignature: false,
    signatureDataUrl: null as string | null,
    files: [] as File[],
  });

  const [backdateLimitDays, setBackdateLimitDays] = useState(30);

  useEffect(() => {
    fetchSettings();
    fetchAllTeachers();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchTeachers();
    } else {
      fetchAllTeachers();
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherSummary();
    }
  }, [selectedTeacher]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/hr/settings/backdate');
      if (res.ok) {
        const data = await res.json();
        setBackdateLimitDays(data.hrBackdateLimitDays);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchAllTeachers = async () => {
    try {
      const res = await fetch('/api/hr/teachers/active');
      if (res.ok) {
        const data = await res.json();
        const sorted = data.teachers.sort((a: Teacher, b: Teacher) =>
          a.teacherCode.localeCompare(b.teacherCode)
        );
        setTeachers(sorted);
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
    }
  };

  const searchTeachers = async () => {
    try {
      const res = await fetch(
        `/api/hr/teachers/active?search=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        const sorted = data.teachers.sort((a: Teacher, b: Teacher) =>
          a.teacherCode.localeCompare(b.teacherCode)
        );
        setTeachers(sorted);
      }
    } catch (error) {
      console.error('Failed to search teachers:', error);
    }
  };

  const fetchTeacherSummary = async () => {
    if (!selectedTeacher) return;

    try {
      setLoadingSummary(true);
      const res = await fetch(`/api/hr/teachers/${selectedTeacher.id}/summary`);
      if (res.ok) {
        const data = await res.json();
        setTeacherSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch teacher summary:', error);
      toast.error('ไม่สามารถโหลดข้อมูลครูได้');
    } finally {
      setLoadingSummary(false);
    }
  };

  const canProceedStep0 = () => {
    return (
      selectedTeacher !== null &&
      proxyReason !== '' &&
      (proxyReason !== 'อื่นๆ (ระบุ)' || customProxyReason.trim().length > 0)
    );
  };

  const canProceedStep1 = () => {
    return formData.type !== null;
  };

  const canProceedStep2 = () => {
    return formData.startDate !== null && formData.endDate !== null;
  };

  const canProceedStep3 = () => {
    return (
      formData.reason.trim().length >= 10 &&
      formData.contactAddress.trim().length > 0 &&
      formData.contactPhone.trim().length >= 9
    );
  };

  const handleNext = () => {
    if (currentStep === 0 && canProceedStep0()) {
      setCurrentStep(1);
    } else if (currentStep === 1 && canProceedStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!selectedTeacher || !canProceedStep3()) return;

    // Validate dates before submitting
    if (!formData.startDate || !formData.endDate) {
      toast.error('กรุณาเลือกวันที่ลา');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch('/api/hr/leaves/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: selectedTeacher.id,
          type: formData.type,
          customTypeName: formData.customTypeName || undefined,
          startDate: formatDateForAPI(formData.startDate),
          endDate: formatDateForAPI(formData.endDate),
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.halfDayPeriod,
          reason: formData.reason,
          contactAddress: formData.contactAddress,
          contactPhone: formData.contactPhone,
          teacherSignature: formData.teacherSignature,
          proxyReason:
            proxyReason === 'อื่นๆ (ระบุ)' ? customProxyReason : proxyReason,
          proxyNote: formData.proxyNote || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('ยื่นใบลาแทนครูสำเร็จ');
      router.push('/hr/approvals');
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'ไม่สามารถยื่นใบลาได้');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = ['เลือกครู', 'ประเภท', 'ช่วงวัน', 'รายละเอียด'];

  return (
    <HrLayoutWrapper hrUser={hrUser}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                ยื่นใบลาแทนครู
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {stepTitles[currentStep]}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2">
            {stepTitles.map((title, idx) => (
              <div key={idx} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    idx <= currentStep
                      ? 'bg-sky-500'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Selected Teacher Display (shown in all steps after selection) */}
        {selectedTeacher && currentStep > 0 && (
          <div className="mb-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ยื่นใบลาแทน
                </p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTeacher.title}{selectedTeacher.firstName} {selectedTeacher.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedTeacher.teacherCode} • {selectedTeacher.position}
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentStep(0);
                  setSelectedTeacher(null);
                  setTeacherSummary(null);
                }}
                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                เปลี่ยนครู
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0: Teacher Selection */}
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Search and Table - Hidden when teacher is selected */}
              {!selectedTeacher && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    เลือกครู
                  </h2>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหา ชื่อ, นามสกุล, รหัสครู, ตำแหน่ง, หรือแผนก"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  {/* Teachers table */}
                  {teachers.length > 0 ? (
                    <div className="space-y-3">
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                        <table className="w-full">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                                รหัสครู
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                                ชื่อ-นามสกุล
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                                แผนก
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                เลือก
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {teachers.map((teacher) => (
                              <tr
                                key={teacher.id}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {teacher.teacherCode}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {teacher.title}{teacher.firstName} {teacher.lastName}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                  {teacher.department || '-'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedTeacher(teacher);
                                    }}
                                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs rounded-lg font-medium transition-colors"
                                  >
                                    เลือก
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                        ทั้งหมด {teachers.length} คน
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        ไม่พบครูที่ค้นหา
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Selected teacher */}
              {selectedTeacher && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ครูที่เลือก
                    </h2>
                    <button
                      onClick={() => {
                        setSelectedTeacher(null);
                        setTeacherSummary(null);
                      }}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      เปลี่ยน
                    </button>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedTeacher.title}{selectedTeacher.firstName}{' '}
                        {selectedTeacher.lastName}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {selectedTeacher.position}
                        {selectedTeacher.department &&
                          ` • ${selectedTeacher.department}`}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        รหัส: {selectedTeacher.teacherCode}
                      </p>
                    </div>
                  </div>

                  {/* Teacher summary */}
                  {loadingSummary ? (
                    <div className="h-32 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
                  ) : (
                    teacherSummary && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">
                          ยอดวันลาสะสม {teacherSummary.period.name}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                              ป่วย/กิจส่วนตัว
                            </p>
                            <p
                              className={`text-lg font-bold ${
                                teacherSummary.summary.sickPersonal.exceeds > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {teacherSummary.summary.sickPersonal.used} /{' '}
                              {teacherSummary.summary.sickPersonal.quota} วัน
                            </p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                              คลอดบุตร
                            </p>
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {teacherSummary.summary.maternity.used} /{' '}
                              {teacherSummary.summary.maternity.quota} วัน
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </motion.div>
              )}

              {/* Proxy reason */}
              {selectedTeacher && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
                >
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    เหตุผลที่ยื่นแทน <span className="text-red-500">*</span>
                  </h2>
                  <div className="space-y-2">
                    {PROXY_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <input
                          type="radio"
                          name="proxyReason"
                          value={reason}
                          checked={proxyReason === reason}
                          onChange={(e) => setProxyReason(e.target.value)}
                          className="w-4 h-4 text-sky-500"
                        />
                        <span className="text-sm text-slate-900 dark:text-slate-100">
                          {reason}
                        </span>
                      </label>
                    ))}
                  </div>

                  {proxyReason === 'อื่นๆ (ระบุ)' && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={customProxyReason}
                        onChange={(e) => setCustomProxyReason(e.target.value)}
                        placeholder="ระบุเหตุผล"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 1: Type */}
          {currentStep === 1 && (
            <LeaveTypeStep
              formData={formData}
              updateFormData={(updates) => {
                setFormData({ ...formData, ...updates, halfDayPeriod: updates.halfDayPeriod || formData.halfDayPeriod });
              }}
              onNext={() => setCurrentStep(2)}
            />
          )}

          {/* Step 2: Date Range */}
          {currentStep === 2 && (
            <DateRangeStep
              formData={formData}
              updateFormData={(updates) => {
                setFormData({ ...formData, ...updates, halfDayPeriod: updates.halfDayPeriod || formData.halfDayPeriod });
              }}
              onNext={() => setCurrentStep(3)}
              isProxyMode={true}
            />
          )}

          {/* Step 3: Details */}
          {currentStep === 3 && selectedTeacher && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <DetailsStep
                formData={formData}
                updateFormData={(updates) => {
                  setFormData({ ...formData, ...updates, halfDayPeriod: updates.halfDayPeriod || formData.halfDayPeriod });
                }}
                onSubmit={handleSubmit}
                submitting={submitting}
                requireSignature={false}
                isHrMode={true}
              />

              {/* HR Note */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  หมายเหตุของ HR (ไม่บังคับ)
                </label>
                <textarea
                  value={formData.proxyNote}
                  onChange={(e) =>
                    setFormData({ ...formData, proxyNote: e.target.value })
                  }
                  placeholder="บันทึกเพิ่มเติมสำหรับเจ้าหน้าที่"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 safe-area-bottom">
        <div className="max-w-5xl mx-auto">
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 0 && !canProceedStep0()) ||
                (currentStep === 1 && !canProceedStep1()) ||
                (currentStep === 2 && !canProceedStep2())
              }
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>ถัดไป</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceedStep3() || submitting}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังยื่น...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>ยืนยันยื่นใบลา</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
    </HrLayoutWrapper>
  );
}
