/**
 * Thai Citizen ID validation utilities
 */

/**
 * Validate Thai citizen ID checksum (13 digits)
 * Algorithm: MOD 11
 */
export function validateCitizenId(citizenId: string): boolean {
  // Remove any formatting (dashes, spaces)
  const cleaned = citizenId.replace(/[-\s]/g, '');

  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleaned)) {
    return false;
  }

  // Calculate checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * (13 - i);
  }

  const mod = sum % 11;
  const checkDigit = mod <= 1 ? 1 - mod : 11 - mod;
  const lastDigit = parseInt(cleaned[12]);

  return checkDigit === lastDigit;
}

/**
 * Format citizen ID with dashes: 1-2345-67890-12-3
 */
export function formatCitizenId(citizenId: string): string {
  const cleaned = citizenId.replace(/[-\s]/g, '');

  if (cleaned.length !== 13) {
    return citizenId;
  }

  return `${cleaned[0]}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned[12]}`;
}

/**
 * Mask citizen ID for display: 1-2345-xxxxx-xx-3
 */
export function maskCitizenId(citizenId: string): string {
  const cleaned = citizenId.replace(/[-\s]/g, '');

  if (cleaned.length !== 13) {
    return citizenId;
  }

  return `${cleaned[0]}-${cleaned.slice(1, 5)}-xxxxx-xx-${cleaned[12]}`;
}

/**
 * Remove formatting from citizen ID
 * 1-2345-67890-12-3 → 1234567890123
 */
export function normalizeCitizenId(citizenId: string): string {
  return citizenId.replace(/[-\s]/g, '');
}
