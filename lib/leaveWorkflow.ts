import type { HrRole } from './roles';
import { canReview, canApprove } from './roles';

export type LeaveStatus = 'pending' | 'reviewed' | 'approved' | 'rejected' | 'cancelled';

export type ReviewStage = 'review' | 'approval';

export type WorkflowAction = 'review' | 'reject' | 'recall' | 'approve' | 'cancel' | 'revert';

export type WorkflowErrorCode = 'FORBIDDEN' | 'INVALID_STATUS' | 'VALIDATION';

export interface WorkflowCheckResult {
  ok: boolean;
  toStatus?: LeaveStatus;
  stage?: ReviewStage; // บอกว่าตีกลับจากขั้นตรวจ หรือไม่อนุมัติจากขั้น ผอ.
  error?: string;
  code?: WorkflowErrorCode;
}

export const MIN_REJECTION_REASON_LENGTH = 10;

interface CheckTransitionOptions {
  reason?: string;
}

/**
 * ตรวจว่า action ที่จะทำกับใบลาถูกต้องตาม flow หรือไม่
 * (role, สถานะปัจจุบัน, เหตุผลถ้าจำเป็น) -> อนุญาตหรือไม่ และสถานะปลายทาง
 * `cancel` ไม่เช็ค role ที่นี่ เพราะเป็นสิทธิ์ของเจ้าของใบลา (เช็คความเป็นเจ้าของที่ caller)
 */
export function checkTransition(
  action: WorkflowAction,
  currentStatus: LeaveStatus,
  role?: HrRole,
  opts: CheckTransitionOptions = {}
): WorkflowCheckResult {
  switch (action) {
    case 'review': {
      if (!role || !canReview(role)) {
        return { ok: false, error: 'ไม่มีสิทธิ์ตรวจใบลา', code: 'FORBIDDEN' };
      }
      if (currentStatus !== 'pending') {
        return {
          ok: false,
          error: 'สามารถตรวจผ่านได้เฉพาะใบลาที่รอตรวจสอบเท่านั้น',
          code: 'INVALID_STATUS',
        };
      }
      return { ok: true, toStatus: 'reviewed' };
    }

    case 'reject': {
      let stage: ReviewStage;
      if (currentStatus === 'pending') {
        if (!role || !canReview(role)) {
          return { ok: false, error: 'ไม่มีสิทธิ์ตีกลับใบลา', code: 'FORBIDDEN' };
        }
        stage = 'review';
      } else if (currentStatus === 'reviewed') {
        if (!role || !canApprove(role)) {
          return { ok: false, error: 'ไม่มีสิทธิ์ไม่อนุมัติใบลา', code: 'FORBIDDEN' };
        }
        stage = 'approval';
      } else {
        return {
          ok: false,
          error: 'สถานะใบลาไม่ถูกต้องสำหรับการตีกลับ/ไม่อนุมัติ',
          code: 'INVALID_STATUS',
        };
      }

      const reason = opts.reason?.trim() ?? '';
      if (reason.length < MIN_REJECTION_REASON_LENGTH) {
        return {
          ok: false,
          error: `กรุณาระบุเหตุผลอย่างน้อย ${MIN_REJECTION_REASON_LENGTH} ตัวอักษร`,
          code: 'VALIDATION',
        };
      }

      return { ok: true, toStatus: 'rejected', stage };
    }

    case 'recall': {
      if (!role || !canReview(role)) {
        return { ok: false, error: 'ไม่มีสิทธิ์ดึงกลับใบลา', code: 'FORBIDDEN' };
      }
      if (currentStatus !== 'reviewed') {
        return {
          ok: false,
          error: 'สามารถดึงกลับได้เฉพาะใบลาที่ส่งต่อให้ ผอ. แล้วเท่านั้น',
          code: 'INVALID_STATUS',
        };
      }
      return { ok: true, toStatus: 'pending' };
    }

    case 'approve': {
      if (!role || !canApprove(role)) {
        return { ok: false, error: 'ไม่มีสิทธิ์อนุมัติใบลา', code: 'FORBIDDEN' };
      }
      if (currentStatus !== 'reviewed') {
        return {
          ok: false,
          error: 'สามารถอนุมัติได้เฉพาะใบลาที่รอ ผอ. อนุมัติเท่านั้น',
          code: 'INVALID_STATUS',
        };
      }
      return { ok: true, toStatus: 'approved' };
    }

    case 'cancel': {
      if (currentStatus !== 'pending') {
        return {
          ok: false,
          error: 'สามารถยกเลิกได้เฉพาะใบลาที่รอตรวจสอบเท่านั้น',
          code: 'INVALID_STATUS',
        };
      }
      return { ok: true, toStatus: 'cancelled' };
    }

    case 'revert': {
      if (role !== 'super_admin') {
        return { ok: false, error: 'ไม่มีสิทธิ์ย้อนสถานะใบลา', code: 'FORBIDDEN' };
      }
      if (currentStatus !== 'approved') {
        return {
          ok: false,
          error: 'สามารถย้อนสถานะได้เฉพาะใบลาที่อนุมัติแล้วเท่านั้น',
          code: 'INVALID_STATUS',
        };
      }
      return { ok: true, toStatus: 'pending' };
    }

    default:
      return { ok: false, error: 'ไม่รู้จัก action นี้', code: 'VALIDATION' };
  }
}
