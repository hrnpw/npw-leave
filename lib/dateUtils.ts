/**
 * Parse ISO date string or YYYY-MM-DD to local Date object without timezone issues
 * Handles both "2024-09-17" and "2024-09-17T00:00:00.000Z" formats
 * Returns Date(2024, 8, 17) in local time
 */
export function parseISODateSafe(dateString: string): Date {
  // If it's ISO format with T, extract date part
  // If it's already YYYY-MM-DD, use as is
  const dateStr = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Get current leave period (รอบการลา)
 * Period 1: April 1 - September 30
 * Period 2: October 1 - March 31
 */
export function getCurrentPeriod(date: Date = new Date()): {
  name: string;
  startDate: Date;
  endDate: Date;
} {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  if (month >= 3 && month <= 8) {
    // Period 1: April 1 - September 30
    return {
      name: 'รอบที่ 1',
      startDate: new Date(year, 3, 1), // April 1
      endDate: new Date(year, 8, 30), // September 30
    };
  } else {
    // Period 2: October 1 - March 31
    if (month >= 9) {
      // October-December: Oct 1 this year - Mar 31 next year
      return {
        name: 'รอบที่ 2',
        startDate: new Date(year, 9, 1), // October 1
        endDate: new Date(year + 1, 2, 31), // March 31 next year
      };
    } else {
      // January-March: Oct 1 last year - Mar 31 this year
      return {
        name: 'รอบที่ 2',
        startDate: new Date(year - 1, 9, 1), // October 1 last year
        endDate: new Date(year, 2, 31), // March 31 this year
      };
    }
  }
}

/**
 * Generate array of dates between start and end (inclusive)
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date is weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Get fiscal year (ปีงบประมาณ) from a date
 * Thai fiscal year runs from October 1 to September 30
 * Returns Buddhist Era year (e.g., 2570)
 */
export function getFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  const buddhistYear = year + 543;

  // If October-December, fiscal year is next Buddhist year
  // If January-September, fiscal year is current Buddhist year
  return month >= 9 ? buddhistYear + 1 : buddhistYear;
}
