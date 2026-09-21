/**
 * Client-side date utilities for handling date strings from API
 * API returns dates as "YYYY-MM-DD" format to avoid timezone issues
 */

/**
 * Parse date string from API (YYYY-MM-DD) to local Date object
 * Prevents timezone offset by explicitly setting local time
 *
 * @param dateString - Date string in "YYYY-MM-DD" format from API
 * @returns Date object in local timezone
 */
export function parseDateFromAPI(dateString: string): Date {
  // API returns "YYYY-MM-DD" format
  // Append T00:00:00 to force local timezone interpretation
  return new Date(dateString + 'T00:00:00');
}

/**
 * Format Date object to Thai locale string
 *
 * @param date - Date object or date string from API
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted Thai date string
 */
export function formatThaiDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
): string {
  const dateObj = typeof date === 'string' ? parseDateFromAPI(date) : date;
  return dateObj.toLocaleDateString('th-TH', options);
}

/**
 * Compare two date strings for equality (ignoring time)
 *
 * @param date1 - First date string from API
 * @param date2 - Second date string from API
 * @returns true if dates are the same day
 */
export function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}
