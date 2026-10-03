'use client';

import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, FileText, Calendar } from 'lucide-react';
import type { ReviewLeave } from './types';
import { formatLeaveDateRange } from './LeaveReviewCard';

type Tone = 'emerald' | 'sky' | 'amber';

const TONE_CLASSES: Record<Tone, { box: string; icon: string; iconBg: string; button: string }> = {
  emerald: {
    box: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-500 hover:bg-emerald-600',
  },
  sky: {
    box: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    icon: 'text-sky-600 dark:text-sky-400',
    button: 'bg-sky-500 hover:bg-sky-600',
  },
  amber: {
    box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-500 hover:bg-amber-600',
  },
};

interface ConfirmLeaveDialogProps {
  leave: ReviewLeave | null;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon: ReactNode;
  processingLabel: string;
  processing: boolean;
  tone: Tone;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmLeaveDialog({
  leave,
  title,
  message,
  confirmLabel,
  confirmIcon,
  processingLabel,
  processing,
  tone,
  onConfirm,
  onClose,
}: ConfirmLeaveDialogProps) {
  const colors = TONE_CLASSES[tone];

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
              aria-labelledby="confirm-leave-dialog-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  id="confirm-leave-dialog-title"
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

              <div className={`mb-6 p-4 border rounded-xl ${colors.box}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.iconBg}`}
                  >
                    <User className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {leave.teacher.title}{leave.teacher.firstName} {leave.teacher.lastName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {leave.teacher.position}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{leave.leaveNo}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{formatLeaveDateRange(leave)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{leave.daysWorking} วันทำการ</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{message}</p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={onConfirm}
                  disabled={processing}
                  className={`py-3 ${colors.button} disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{processingLabel}</span>
                    </>
                  ) : (
                    <>
                      {confirmIcon}
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
