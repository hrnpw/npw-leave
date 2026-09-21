'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateForAPI } from '@/lib/dateFormat';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import LeaveTypeStep from './steps/LeaveTypeStep';
import DateRangeStep from './steps/DateRangeStep';
import DetailsStep from './steps/DetailsStep';
import SignatureStep from './steps/SignatureStep';

interface LeaveFormClientProps {
  teacher: {
    id: string;
    teacherCode: string;
    firstName: string;
    lastName: string;
  };
}

export interface LeaveFormData {
  type: LeaveType | null;
  customTypeName: string;
  startDate: Date | null;
  endDate: Date | null;
  isHalfDay: boolean;
  halfDayPeriod: HalfDayPeriod | null;
  reason: string;
  contactAddress: string;
  contactPhone?: string;
  teacherSignature: boolean;
  signatureDataUrl: string | null;
  files: File[];
}

const STORAGE_KEY = 'teacher_leave_draft';

export default function LeaveFormClient({ teacher }: LeaveFormClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [requireSignature, setRequireSignature] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [formData, setFormData] = useState<LeaveFormData>({
    type: null,
    customTypeName: '',
    startDate: null,
    endDate: null,
    isHalfDay: false,
    halfDayPeriod: null,
    reason: '',
    contactAddress: '',
    contactPhone: '',
    teacherSignature: false,
    signatureDataUrl: null,
    files: [],
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await fetch('/api/teacher/settings/signature-required');
      if (res.ok) {
        const data = await res.json();
        setRequireSignature(data.requireTeacherSignature || false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Auto-save disabled per user request

  const updateFormData = (updates: Partial<LeaveFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Auto-advance from step 1 when type is selected
    if (currentStep === 1 && formData.type) {
      setCurrentStep(2);
    } else if (currentStep === 2 && formData.startDate && formData.endDate) {
      setCurrentStep(3);
    } else if (currentStep === 3 && formData.reason.trim().length >= 10 && formData.contactAddress.trim()) {
      // Only advance to step 4 if signature is required
      if (requireSignature) {
        setCurrentStep(4);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Validate
    if (!formData.type || !formData.startDate || !formData.endDate) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน', {
        description: 'ตรวจสอบว่าได้เลือกประเภทการลาและช่วงวันที่แล้ว'
      });
      return;
    }

    if (formData.type === 'other' && !formData.customTypeName.trim()) {
      toast.error('กรุณาระบุประเภทการลา', {
        description: 'ท่านเลือก "อื่นๆ" กรุณาระบุชื่อประเภทการลา'
      });
      return;
    }

    if (formData.reason.trim().length < 10) {
      toast.error('เหตุผลการลาสั้นเกินไป', {
        description: `กรุณากรอกอย่างน้อย 10 ตัวอักษร (ปัจจุบัน ${formData.reason.trim().length} ตัวอักษร)`
      });
      return;
    }

    if (!formData.contactAddress.trim()) {
      toast.error('กรุณากรอกที่อยู่ติดต่อระหว่างลา', {
        description: 'ระบุที่อยู่ที่สามารถติดต่อท่านได้ระหว่างวันลา'
      });
      return;
    }

    if (!formData.contactPhone || !formData.contactPhone.trim()) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์', {
        description: 'ระบุเบอร์โทรศัพท์ที่สามารถติดต่อได้ระหว่างวันลา'
      });
      return;
    }

    // Validate phone format (more lenient - allow international format)
    const phoneDigits = formData.contactPhone.replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{8,11}$/.test(phoneDigits)) {
      toast.error('รูปแบบเบอร์โทรไม่ถูกต้อง', {
        description: 'กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (8-11 หลัก)'
      });
      return;
    }

    // Validate signature if required
    if (requireSignature && !formData.signatureDataUrl) {
      toast.error('กรุณาลงลายเซ็น', {
        description: 'ท่านต้องเซ็นลายเซ็นบนหน้าจอก่อนยื่นใบลา'
      });
      return;
    }

    // Check online status before submitting
    if (!navigator.onLine) {
      toast.error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', {
        description: 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่',
        duration: 5000,
        action: {
          label: 'ลองอีกครั้ง',
          onClick: () => handleSubmit()
        }
      });
      return;
    }

    try {
      setSubmitting(true);

      // Check overlap first
      const overlapRes = await fetch('/api/teacher/leaves/check-overlap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formatDateForAPI(formData.startDate),
          endDate: formatDateForAPI(formData.endDate),
        }),
      });

      const overlapData = await overlapRes.json();

      if (overlapData.hasOverlap) {
        const overlapInfo = overlapData.overlappingLeave;
        toast.error('ช่วงวันที่ทับซ้อนกับใบลาเดิม', {
          description: overlapInfo
            ? `ท่านมีใบลา ${overlapInfo.leaveNo || ''} อยู่แล้วในช่วงนี้ กรุณาเลือกวันอื่น`
            : 'กรุณาเลือกช่วงวันที่ไม่ทับซ้อนกับใบลาที่มีอยู่',
          duration: 5000
        });
        setSubmitting(false);
        return;
      }

      // Submit leave
      const submitBody = {
        type: formData.type,
        customTypeName: formData.type === 'other' ? formData.customTypeName : undefined,
        startDate: formatDateForAPI(formData.startDate),
        endDate: formatDateForAPI(formData.endDate),
        isHalfDay: formData.isHalfDay,
        halfDayPeriod: formData.halfDayPeriod,
        reason: formData.reason,
        contactAddress: formData.contactAddress,
        contactPhone: formData.contactPhone,
        signatureDataUrl: formData.signatureDataUrl || undefined,
      };

      const submitRes = await fetch('/api/teacher/leaves/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitBody),
      });

      if (!submitRes.ok) {
        const error = await submitRes.json();
        let errorMessage = 'ไม่สามารถยื่นใบลาได้';
        let errorDescription = error.error || 'กรุณาลองอีกครั้ง หากปัญหายังคงอยู่ติดต่อฝ่ายบุคคล';

        // Specific error messages
        if (error.error?.includes('ย้อนหลัง')) {
          errorMessage = 'ไม่สามารถยื่นย้อนหลังได้';
          errorDescription = 'ท่านสามารถยื่นใบลาย้อนหลังได้ไม่เกิน 14 วัน';
        } else if (error.error?.includes('ทับซ้อน')) {
          errorMessage = 'ช่วงวันที่ทับซ้อนกับใบลาเดิม';
        } else if (error.error?.includes('โควตา') || error.error?.includes('เกิน')) {
          errorMessage = 'วันลาใกล้ถึงหรือเกินเกณฑ์';
          errorDescription = 'ท่านยังสามารถยื่นได้ แต่ควรปรึกษาฝ่ายบุคคล';
        }

        throw new Error(JSON.stringify({ message: errorMessage, description: errorDescription }));
      }

      const result = await submitRes.json();

      // Haptic success
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
      }

      // Clear draft
      localStorage.removeItem(STORAGE_KEY);

      toast.success('ยื่นใบลาสำเร็จ ✓', {
        description: `เลขที่ใบลา: ${result.leaveNo}`,
        duration: 4000,
      });

      // Navigate to success page or dashboard
      router.push('/teacher');
    } catch (error: any) {
      console.error('Submit error:', error);

      // Parse structured error message
      let errorMsg = 'ไม่สามารถยื่นใบลาได้';
      let errorDesc = 'กรุณาลองอีกครั้ง หากปัญหายังคงอยู่ติดต่อฝ่ายบุคคล';

      try {
        const parsed = JSON.parse(error.message);
        if (parsed.message) errorMsg = parsed.message;
        if (parsed.description) errorDesc = parsed.description;
      } catch {
        // Fallback to plain message
        if (error.message && error.message !== 'Failed to fetch') {
          errorDesc = error.message;
        } else if (error.message === 'Failed to fetch') {
          errorMsg = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
          errorDesc = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง';
        }
      }

      toast.error(errorMsg, {
        description: errorDesc,
        duration: 5000,
        action: error.message === 'Failed to fetch' ? {
          label: '🔄 ลองอีกครั้ง',
          onClick: () => handleSubmit()
        } : undefined
      });
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.type !== null;
    }
    if (currentStep === 2) {
      return formData.startDate !== null && formData.endDate !== null;
    }
    if (currentStep === 3) {
      return (
        formData.reason.trim().length >= 10 &&
        formData.contactAddress.trim().length > 0 &&
        (formData.contactPhone?.trim().length ?? 0) >= 9
      );
    }
    if (currentStep === 4) {
      return formData.signatureDataUrl !== null;
    }
    return false;
  };

  // Show loading while settings are loading
  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const totalSteps = requireSignature ? 4 : 3;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              disabled={submitting}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ยื่นใบลา
            </h1>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step <= currentStep
                    ? 'bg-orange-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            ขั้นตอนที่ {currentStep} จาก {totalSteps}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <LeaveTypeStep
              key="step1"
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
            />
          )}

          {currentStep === 2 && (
            <DateRangeStep
              key="step2"
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
            />
          )}

          {currentStep === 3 && (
            <DetailsStep
              key="step3"
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
              onSubmit={requireSignature ? handleNext : handleSubmit}
              submitting={submitting}
              requireSignature={requireSignature}
            />
          )}

          {currentStep === 4 && requireSignature && (
            <SignatureStep
              key="step4"
              formData={formData}
              updateFormData={updateFormData}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Bottom button (fixed on mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 safe-area-bottom md:hidden">
        {currentStep === 4 && requireSignature ? (
          <button
            onClick={handleSubmit}
            disabled={!formData.signatureDataUrl || submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังส่ง...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>ยืนยันและส่ง</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={currentStep === 3 && !requireSignature ? handleSubmit : handleNext}
            disabled={!canProceed() || submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังส่ง...</span>
              </>
            ) : (currentStep === 3 && !requireSignature) ? (
              <>
                <Check className="w-5 h-5" />
                <span>ยืนยันและส่ง</span>
              </>
            ) : (
              <>
                <span>ถัดไป</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
