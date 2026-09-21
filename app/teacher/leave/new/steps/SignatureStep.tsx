'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, FileText, CheckCircle2 } from 'lucide-react';
import type { LeaveFormData } from '../LeaveFormClient';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { formatThaiDateShort } from '@/lib/thaiDate';

interface SignatureStepProps {
  formData: LeaveFormData;
  updateFormData: (updates: Partial<LeaveFormData>) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export default function SignatureStep({ formData, updateFormData, onSubmit, submitting }: SignatureStepProps) {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Load existing signature if any
    if (formData.signatureDataUrl && sigPadRef.current) {
      sigPadRef.current.fromDataURL(formData.signatureDataUrl);
      setIsEmpty(false);
    }
  }, [formData.signatureDataUrl]);

  const handleClear = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      updateFormData({ signatureDataUrl: null });
      setIsEmpty(true);
      setShowPreview(false);
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleEnd = () => {
    if (sigPadRef.current) {
      const dataUrl = sigPadRef.current.toDataURL('image/png');
      updateFormData({ signatureDataUrl: dataUrl });
      setIsEmpty(sigPadRef.current.isEmpty());
      setShowPreview(true);
    }
  };

  const canSubmit = !isEmpty && formData.signatureDataUrl;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Summary */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          สรุปการลา
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">ประเภท:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formData.type ? LEAVE_TYPE_LABELS[formData.type] : '-'}
              {formData.type && formData.type === 'other' && formData.customTypeName && ` (${formData.customTypeName})`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">วันที่:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formData.startDate && formData.endDate
                ? `${formatThaiDateShort(formData.startDate)} - ${formatThaiDateShort(formData.endDate)}`
                : '-'}
              {formData.isHalfDay && (
                <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                  {formData.halfDayPeriod === 'morning' ? 'ครึ่งเช้า' : 'ครึ่งบ่าย'}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Signature instruction */}
      <div className="bg-sky-50 dark:bg-sky-900/20 border-2 border-sky-200 dark:border-sky-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
              กรุณาเซ็นลายเซ็นในกรอบด้านล่าง
            </p>
            <p className="text-xs text-sky-700 dark:text-sky-300">
              ลายเซ็นจะถูกบันทึกและแสดงในใบลา PDF ของคุณ
            </p>
          </div>
        </div>
      </div>

      {/* Signature canvas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
            ลายเซ็น <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>ล้างเซ็นใหม่</span>
          </button>
        </div>

        <div className="relative bg-white rounded-xl border-2 border-slate-300 dark:border-slate-600 overflow-hidden">
          <SignatureCanvas
            ref={sigPadRef}
            onEnd={handleEnd}
            canvasProps={{
              className: 'w-full h-[150px] touch-none cursor-crosshair',
              style: { touchAction: 'none' }
            }}
            backgroundColor="#FFFFFF"
            penColor="#0F172A"
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                วาดลายเซ็นที่นี่
              </p>
            </div>
          )}
        </div>

        {/* Preview thumbnail */}
        {showPreview && formData.signatureDataUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              ตัวอย่างลายเซ็น:
            </p>
            <img
              src={formData.signatureDataUrl}
              alt="Signature preview"
              className="w-full h-[60px] object-contain bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700"
            />
          </motion.div>
        )}
      </div>

      {/* Confirmation text */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          ข้าพเจ้าขอรับรองว่าข้อมูลทั้งหมดที่กรอกในใบลานี้ถูกต้องและเป็นความจริง
        </p>
      </div>

      {/* Submit button (desktop) */}
      <div className="hidden md:block">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>กำลังส่ง...</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span>ยืนยันและส่งใบลา</span>
            </>
          )}
        </button>
      </div>

      {/* Validation warning */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-slate-500 dark:text-slate-400 text-center"
        >
          กรุณาเซ็นลายเซ็นก่อนส่งใบลา
        </motion.div>
      )}
    </motion.div>
  );
}
