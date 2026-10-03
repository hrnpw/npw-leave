import type { LeaveType, HalfDayPeriod } from '@/types/leave';

// ใบลาในหน้าตรวจ (/hr/reviews) และหน้าอนุมัติ (/hr/approvals)
export interface ReviewLeave {
  id: string;
  leaveNo: string;
  type: LeaveType;
  customTypeName?: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
  daysWorking: number;
  daysCalendar: number;
  reason: string;
  contactAddress: string;
  submittedByType: 'teacher' | 'hr';
  submittedByHr?: {
    firstName: string;
    lastName: string;
  };
  teacher: {
    teacherCode: string;
    title: string;
    firstName: string;
    lastName: string;
    position: string;
    department?: string;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  createdAt: string;
  reviewedAt?: string | null;
  // มีเฉพาะจาก /api/hr/approvals/pending
  exceedsQuota?: boolean;
  quotaDetails?: {
    type: string;
    used: number;
    quota: number;
    exceeds: number;
  };
}
