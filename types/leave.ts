export type LeaveType = 'sick' | 'personal' | 'maternity' | 'religious' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type HalfDayPeriod = 'morning' | 'afternoon';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจส่วนตัว',
  maternity: 'ลาคลอดบุตร',
  religious: 'ลาทางศาสนา',
  other: 'อื่นๆ',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก',
};

export const HALF_DAY_PERIOD_LABELS: Record<HalfDayPeriod, string> = {
  morning: 'ครึ่งเช้า',
  afternoon: 'ครึ่งบ่าย',
};

// Colors for leave types (consistent across the system)
export const LEAVE_TYPE_COLORS = {
  sick: {
    light: 'bg-red-100 text-red-700 border-red-200',
    dark: 'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500',
  },
  personal: {
    light: 'bg-blue-100 text-blue-700 border-blue-200',
    dark: 'dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  maternity: {
    light: 'bg-pink-100 text-pink-700 border-pink-200',
    dark: 'dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800',
    dot: 'bg-pink-500',
  },
  religious: {
    light: 'bg-purple-100 text-purple-700 border-purple-200',
    dark: 'dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  other: {
    light: 'bg-slate-100 text-slate-700 border-slate-200',
    dark: 'dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
    dot: 'bg-slate-500',
  },
} as const;

// Colors for leave status
export const LEAVE_STATUS_COLORS = {
  pending: {
    light: 'bg-amber-100 text-amber-700 border-amber-200',
    dark: 'dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  },
  approved: {
    light: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dark: 'dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  rejected: {
    light: 'bg-rose-100 text-rose-700 border-rose-200',
    dark: 'dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
  },
  cancelled: {
    light: 'bg-slate-100 text-slate-700 border-slate-200',
    dark: 'dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
  },
} as const;
