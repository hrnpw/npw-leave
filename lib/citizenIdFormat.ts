/**
 * Mask citizen ID for display
 * 1-2345-67890-12-3 → 1-2345-xxxxx-xx-3
 */
export function maskCitizenId(citizenId: string): string {
  if (citizenId.length !== 13) return citizenId;
  return `${citizenId.slice(0, 5)}xxxxx${citizenId.slice(10, 12)}x${citizenId.slice(12)}`;
}

/**
 * Format citizen ID with dashes
 * 1234567890123 → 1-2345-67890-12-3
 */
export function formatCitizenId(citizenId: string): string {
  if (citizenId.length !== 13) return citizenId;
  return `${citizenId.slice(0, 1)}-${citizenId.slice(1, 5)}-${citizenId.slice(5, 10)}-${citizenId.slice(10, 12)}-${citizenId.slice(12)}`;
}

/**
 * Format a partially typed citizen ID with dashes as the user types
 * 12345 → 1-2345, 123456 → 1-2345-6
 */
export function formatCitizenIdPartial(digits: string): string {
  const groups = [1, 4, 5, 2, 1];
  const parts: string[] = [];
  let pos = 0;
  for (const size of groups) {
    if (pos >= digits.length) break;
    parts.push(digits.slice(pos, pos + size));
    pos += size;
  }
  return parts.join('-');
}

/**
 * Index in a formatted string right after the nth digit (for caret placement)
 */
export function caretIndexAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digitCount) return i + 1;
  }
  return formatted.length;
}

/**
 * Remove formatting from citizen ID
 * 1-2345-67890-12-3 → 1234567890123
 */
export function normalizeCitizenId(citizenId: string): string {
  return citizenId.replace(/[-\s]/g, '');
}
