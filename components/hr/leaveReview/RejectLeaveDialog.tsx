'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MIN_REJECTION_REASON_LENGTH } from '@/lib/leaveWorkflow';
import type { ReviewLeave } from './types';

interface RejectLeaveDialogProps {
  leave: ReviewLeave | null;
  title: string;
  reasonLabel: string;
  confirmLabel: string;
  processing: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function RejectLeaveDialog({
  leave,
  title,
  reasonLabel,
  confirmLabel,
  processing,
  onConfirm,
  onClose,
}: RejectLeaveDialogProps) {
  const [reason, setReason] = useState('');
  const trimmedLength = reason.trim().length;
  const remaining = MIN_REJECTION_REASON_LENGTH - trimmedLength;

  // ล้างเหตุผลทุกครั้งที่เปิดใบใหม่
  useEffect(() => {
    setReason('');
  }, [leave?.id]);

  useEffect(() => {
    if (!leave) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave, processing, onClose]);

  return (
    <AnimatePresence>
      {leave && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !processing && onClose()}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-leave-dialog-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  id="reject-leave-dialog-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  disabled={processing}
                  aria-label="ปิด"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {leave.teacher.title}{leave.teacher.firstName} {leave.teacher.lastName}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{leave.leaveNo}</p>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="reject-leave-reason"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2"
                >
                  {reasonLabel} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reject-leave-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`กรุณาระบุเหตุผลอย่างละเอียด (อย่างน้อย ${MIN_REJECTION_REASON_LENGTH} ตัวอักษร)`}
                  rows={4}
                  aria-describedby="reject-leave-reason-hint"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
                />
                <p
                  id="reject-leave-reason-hint"
                  className={`text-xs mt-1 ${
                    remaining > 0 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {remaining > 0 ? `ต้องการอีก ${remaining} ตัวอักษร` : '✓ เหตุผลครบถ้วน'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => onConfirm(reason.trim())}
                  disabled={remaining > 0 || processing}
                  className="py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>{confirmLabel}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
