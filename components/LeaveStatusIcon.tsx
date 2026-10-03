'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Hourglass } from 'lucide-react';

// ไอคอนสถานะต่อท้ายประเภทการลา: ตรวจสอบแล้ว (รอ ผอ.) / อนุมัติแล้ว
export function LeaveStatusIcon({ status }: { status?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (status !== 'reviewed' && status !== 'approved') return null;
  const label = status === 'approved' ? 'อนุมัติแล้ว' : 'ตรวจสอบแล้ว รอ ผอ. อนุมัติ';
  const Icon = status === 'approved' ? CheckCircle2 : Hourglass;
  const color = status === 'approved'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-sky-600 dark:text-sky-400';

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-describedby={open ? tooltipId : undefined}
      onClick={() => setOpen((v) => !v)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className="relative inline-flex flex-shrink-0 items-center justify-center rounded-full cursor-pointer"
    >
      <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-normal text-white shadow-lg dark:bg-slate-700"
        >
          {label}
        </span>
      )}
    </button>
  );
}

// คำอธิบายไอคอน ใช้ใต้ปฏิทิน
export function LeaveStatusIconLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap ${className}`}>
      <div className="flex items-center gap-1">
        <Hourglass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        <span>ตรวจสอบแล้ว รอ ผอ. อนุมัติ</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>อนุมัติแล้ว</span>
      </div>
    </div>
  );
}
