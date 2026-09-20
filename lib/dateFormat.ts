/**
 * Format date to YYYY-MM-DD using local date components
 * Use this to send date strings to API that will be interpreted as UTC midnight
 * This prevents timezone shift: local Sept 30 → "2024-09-30" → UTC Sept 30 00:00
 */
export function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to YYYY-MM-DD HH:mm:ss without timezone conversion
 */
export function formatDateTimeForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
