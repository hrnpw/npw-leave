'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dragControls = useDragControls();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.3, ease: EASE }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) onClose();
        }}
        className="flex w-full max-w-md max-h-[85vh] flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl shadow-slate-300/50 dark:shadow-slate-950/90 border border-slate-200 dark:border-slate-800 outline-none"
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="touch-none shrink-0 px-4 pt-2 sm:pt-4"
        >
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
          <div className="flex items-center justify-between gap-2 pb-3">
            <h3 id={titleId} className="text-heading-md min-w-0">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="ปิด"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-safe">{children}</div>
      </motion.div>
    </motion.div>
  );
}
