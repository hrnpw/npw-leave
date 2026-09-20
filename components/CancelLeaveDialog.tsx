'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CancelLeaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveId: string;
  leaveNo: string;
}

export default function CancelLeaveDialog({
  isOpen,
  onClose,
  onSuccess,
  leaveId,
  leaveNo,
}: CancelLeaveDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (reason.length < 10) {
      toast.error('เหตุผลการยกเลิกต้องมีอย่างน้อย 10 ตัวอักษร');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/hr/leaves/${leaveId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถยกเลิกใบลาได้');
      }

      toast.success('ยกเลิกใบลาสำเร็จ');
      onSuccess();
      onClose();
      setReason('');
    } catch (error) {
      console.error('Failed to cancel leave:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-xl"
        >
          {/* Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  ยกเลิกใบลา
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{leaveNo}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Warning */}
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-900 dark:text-red-100">
                <strong>คำเตือน:</strong> การยกเลิกใบลาที่อนุมัติแล้วจะเปลี่ยนสถานะเป็น
                "ไม่อนุมัติ" และไม่สามารถย้อนกลับได้
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                เหตุผลการยกเลิก <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="กรุณาระบุเหตุผลที่ต้องยกเลิกใบลานี้ (อย่างน้อย 10 ตัวอักษร)"
                required
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {reason.length} / 10 ตัวอักษรขั้นต่ำ
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || reason.length < 10}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    กำลังยกเลิก...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    ยืนยันยกเลิกใบลา
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
