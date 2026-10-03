export type HrRole = 'hr' | 'director' | 'super_admin';

// ใช้ร่วมกันระหว่าง lib/auditLog.ts และ lib/audit/logger.ts ให้ type ตรงกัน
export type AuditUserType = HrRole | 'teacher' | 'system';

export const HR_ROLE_LABELS: Record<HrRole, string> = {
  hr: 'เจ้าหน้าที่ HR',
  director: 'ผู้อำนวยการ',
  super_admin: 'ผู้ดูแลระบบ',
};

export function hrRoleLabel(role: HrRole): string {
  return HR_ROLE_LABELS[role];
}

// ตรวจใบลา (pending -> reviewed / rejected)
export function canReview(role: HrRole): boolean {
  return role === 'hr' || role === 'super_admin';
}

// อนุมัติใบลา (reviewed -> approved / rejected)
export function canApprove(role: HrRole): boolean {
  return role === 'director' || role === 'super_admin';
}

// งานจัดการ: ครู, ตั้งค่า, signatories, ยื่นแทนครู, แก้ไข/ยกเลิกใบลา, พิมพ์ PDF
// ผอ. ทำได้เหมือน HR (หน้า admin / danger zone ยังเป็นของ super_admin เท่านั้น)
export function canManage(role: HrRole): boolean {
  return role === 'hr' || role === 'director' || role === 'super_admin';
}

// หน้าคิวหลักของแต่ละ role (bottom nav, dashboard quick action)
// ผอ. -> หน้าอนุมัติ (ยอด reviewed), hr/super_admin -> หน้าตรวจ (ยอด pending)
export interface LeaveQueue {
  href: '/hr/reviews' | '/hr/approvals';
  label: string;
  countKey: 'pending' | 'reviewed';
}

export function primaryLeaveQueue(role: HrRole): LeaveQueue {
  return role === 'director'
    ? { href: '/hr/approvals', label: 'รออนุมัติ', countKey: 'reviewed' }
    : { href: '/hr/reviews', label: 'รอตรวจสอบ', countKey: 'pending' };
}
