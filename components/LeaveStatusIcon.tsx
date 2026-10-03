import { CheckCircle2, Hourglass } from 'lucide-react';

// ไอคอนสถานะต่อท้ายประเภทการลา: ตรวจสอบแล้ว (รอ ผอ.) / อนุมัติแล้ว
export function LeaveStatusIcon({ status }: { status?: string }) {
  if (status !== 'reviewed' && status !== 'approved') return null;
  const label = status === 'approved' ? 'อนุมัติแล้ว' : 'ตรวจสอบแล้ว รอ ผอ. อนุมัติ';
  const Icon = status === 'approved' ? CheckCircle2 : Hourglass;
  const color = status === 'approved'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-sky-600 dark:text-sky-400';
  return (
    <span title={label} className="inline-flex flex-shrink-0">
      <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
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
