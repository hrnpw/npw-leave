/**
 * Centralized Session Configuration
 *
 * เปลี่ยนเวอร์ชัน cookie name เมื่อต้องการ force logout users ทั้งหมด
 * ตัวอย่าง: teacher_session_v2, teacher_session_v3, etc.
 */

export const SESSION_CONFIG = {
  // Cookie names - เปลี่ยนเวอร์ชันเพื่อ force logout ทุกคน
  TEACHER_COOKIE_NAME: 'teacher_session_v2',
  HR_COOKIE_NAME: 'hr_session_v2',

  // Session duration
  MAX_AGE: 60 * 60, // 1 hour in seconds
} as const;
