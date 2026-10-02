import { validateCitizenId } from './citizenId';

/**
 * Validates Thai citizen ID using Modulus 11 algorithm (delegates to lib/citizenId)
 * @param id Citizen ID (13 digits, with or without dashes)
 * @returns true if valid, false otherwise
 */
export function validateThaiCitizenId(id: string): boolean {
  return validateCitizenId(id);
}

/**
 * Returns a user-friendly error message for invalid citizen IDs
 */
export function getCitizenIdErrorMessage(id: string): string | null {
  const cleaned = id.replace(/[-\s]/g, '');

  if (cleaned.length === 0) {
    return 'กรุณากรอกเลขบัตรประชาชน';
  }

  if (cleaned.length < 13) {
    return `กรุณากรอกให้ครบ 13 หลัก (ปัจจุบันกรอก ${cleaned.length} หลัก)`;
  }

  if (cleaned.length > 13) {
    return 'เลขบัตรประชาชนต้องมี 13 หลักเท่านั้น';
  }

  if (!/^\d{13}$/.test(cleaned)) {
    return 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น';
  }

  if (!validateThaiCitizenId(cleaned)) {
    return 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }

  return null;
}
