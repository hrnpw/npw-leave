'use client';

import { AnimatePresence } from 'framer-motion';
import { Loader2, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';

interface ConfirmCancelSheetProps {
  open: boolean;
  leaveNo?: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmCancelSheet({ open, leaveNo, loading, onConfirm, onClose }: ConfirmCancelSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <BottomSheet title="ยกเลิกใบลา?" onClose={loading ? () => {} : onClose}>
          <p className="text-body-sm text-secondary mb-4">
            {leaveNo ? `ใบลา ${leaveNo} ` : 'ใบลานี้'}จะถูกยกเลิกและไม่สามารถย้อนกลับได้
          </p>
          <div className="grid grid-cols-2 gap-2 pb-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg shadow-red-500/30 transition-colors active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>กำลังยกเลิก...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>ยืนยันยกเลิก</span>
                </>
              )}
            </button>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
