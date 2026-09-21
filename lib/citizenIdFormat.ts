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
 * Remove formatting from citizen ID
 * 1-2345-67890-12-3 → 1234567890123
 */
export function normalizeCitizenId(citizenId: string): string {
  return citizenId.replace(/[-\s]/g, '');
}
