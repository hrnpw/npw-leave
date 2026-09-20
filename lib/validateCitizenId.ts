/**
 * Validates Thai citizen ID using Modulus 11 algorithm
 * @param id Citizen ID (13 digits, with or without dashes)
 * @returns true if valid, false otherwise
 */
export function validateThaiCitizenId(id: string): boolean {
  // Remove dashes and spaces
  const cleaned = id.replace(/[-\s]/g, '');

  // Must be exactly 13 digits
  if (cleaned.length !== 13 || !/^\d{13}$/.test(cleaned)) {
    return false;
  }

  const digits = cleaned.split('').map(Number);
  const checkDigit = digits[12];

  // Calculate sum with weights 13 down to 2
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (13 - i);
  }

  // Calculate check digit
  const mod = sum % 11;
  const calculated = (11 - mod) % 10;

  return calculated === checkDigit;
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
