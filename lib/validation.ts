/**
 * Common validation schemas and utilities
 */

import { z } from 'zod';

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(128, 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร');

// Username validation
export const usernameSchema = z
  .string()
  .min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
  .max(50, 'ชื่อผู้ใช้ต้องไม่เกิน 50 ตัวอักษร')
  .regex(/^[a-zA-Z0-9_]+$/, 'ชื่อผู้ใช้ต้องเป็นตัวอักษร ตัวเลข หรือ _ เท่านั้น');

// Citizen ID validation
export const citizenIdSchema = z
  .string()
  .length(13, 'เลขบัตรประชาชนต้องมี 13 หลัก')
  .regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น');

// Date validation (YYYY-MM-DD)
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง');

// Thai name validation
export const thaiNameSchema = z
  .string()
  .min(1, 'กรุณากรอกชื่อ')
  .max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร');

// Leave number format: LV-YYYY-NNNN
export const leaveNumberSchema = z
  .string()
  .regex(/^LV-\d{4}-\d{4}$/, 'รูปแบบเลขที่ใบลาไม่ถูกต้อง (LV-YYYY-NNNN)');

// Fiscal year validation (2560-2600)
export const fiscalYearSchema = z
  .number()
  .int()
  .min(2560, 'ปีงบประมาณต้องไม่น้อยกว่า 2560')
  .max(2600, 'ปีงบประมาณต้องไม่เกิน 2600');

// Quota validation (1-365 days)
export const quotaDaysSchema = z
  .number()
  .int()
  .min(1, 'จำนวนวันต้องไม่น้อยกว่า 1')
  .max(365, 'จำนวนวันต้องไม่เกิน 365');

// Backdate limit validation (0-90 days)
export const backdateLimitSchema = z
  .number()
  .int()
  .min(0, 'จำนวนวันต้องไม่น้อยกว่า 0')
  .max(90, 'จำนวนวันต้องไม่เกิน 90');

/**
 * Validate ID format (cuid)
 */
export function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validate enum value
 */
export function isValidEnum<T extends Record<string, string>>(
  value: string,
  enumObj: T
): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}
