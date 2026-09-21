/**
 * Fiscal year utilities for Thai government fiscal year
 * Thai fiscal year runs from October 1 to September 30
 */

/**
 * Get fiscal year (Buddhist Era) from a date
 * Fiscal year 2569 = Oct 2025 (2568) - Sep 2026 (2569)
 * Example: 2026-09-30 → 2569, 2026-10-01 → 2570
 */
export function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Convert to Buddhist year
  const buddhistYear = year + 543;

  // If month is Oct-Dec (9-11), it's the next fiscal year
  if (month >= 9) {
    return buddhistYear + 1;
  }

  // If month is Jan-Sep (0-8), it's the current Buddhist year
  return buddhistYear;
}

/**
 * Get leave period (1 or 2) for a date
 * Period 1: October 1 - March 31 (รอบที่ 1: ต.ค.-มี.ค.)
 * Period 2: April 1 - September 30 (รอบที่ 2: เม.ย.-ก.ย.)
 */
export function getLeavePeriod(date: Date): 1 | 2 {
  const month = date.getMonth(); // 0-indexed

  // April (3) to September (8) = Period 2
  if (month >= 3 && month <= 8) {
    return 2;
  }

  // October (9) to March (2) = Period 1
  return 1;
}

/**
 * Get date range for a fiscal year period
 * @param fiscalYear - Buddhist Era year (e.g., 2569)
 * @param round - 1 or 2
 * @returns start and end dates for the period
 */
export function getFiscalPeriodDateRange(
  fiscalYear: number,
  round: 1 | 2
): { start: Date; end: Date } {
  const christianYear = fiscalYear - 543;

  if (round === 1) {
    // Round 1: Oct (previous year) - Mar (current year)
    return {
      start: new Date(christianYear - 1, 9, 1), // Oct 1 of previous year
      end: new Date(christianYear, 2, 31),      // Mar 31
    };
  } else {
    // Round 2: Apr - Sep (current year)
    return {
      start: new Date(christianYear, 3, 1),     // Apr 1
      end: new Date(christianYear, 8, 30),      // Sep 30
    };
  }
}

/**
 * Get date range for a leave period (legacy)
 */
export function getPeriodDateRange(year: number, period: 1 | 2): { start: Date; end: Date } {
  // year is in Christian Era (e.g., 2026)

  if (period === 1) {
    // Period 1: October (previous year) - March (current year)
    return {
      start: new Date(year - 1, 9, 1), // October 1 of previous year
      end: new Date(year, 2, 31),      // March 31
    };
  } else {
    // Period 2: April - September (current year)
    return {
      start: new Date(year, 3, 1), // April 1
      end: new Date(year, 8, 30),  // September 30
    };
  }
}

/**
 * Format leave number: LEAVE-{fiscal_year_short}/{round}-{running_no}
 * Example: LEAVE-69/1-0001
 */
export function formatLeaveNumber(fiscalYear: number, round: 1 | 2, runningNo: number): string {
  const yearShort = fiscalYear % 100; // 2569 → 69
  return `LEAVE-${yearShort}/${round}-${runningNo.toString().padStart(4, '0')}`;
}

/**
 * Parse leave number back to components
 */
export function parseLeaveNumber(leaveNo: string): { fiscalYear: number; round: 1 | 2; runningNo: number } | null {
  const match = leaveNo.match(/^LEAVE-(\d{2})\/(\d)-(\d{4})$/);
  if (!match) return null;

  const yearShort = parseInt(match[1], 10);
  const round = parseInt(match[2], 10);
  const runningNo = parseInt(match[3], 10);

  // Validate round
  if (round !== 1 && round !== 2) return null;

  // Convert 2-digit year to 4-digit Buddhist year
  // Assume years 00-99 map to 2500-2599
  const fiscalYear = 2500 + yearShort;

  return {
    fiscalYear,
    round: round as 1 | 2,
    runningNo,
  };
}

/**
 * Get current leave period with date range
 * Returns period name and start/end dates
 */
export function getCurrentLeavePeriod(): { period: 1 | 2; name: string; start: Date; end: Date } {
  const today = new Date();
  const period = getLeavePeriod(today);
  const year = today.getFullYear();
  const { start, end } = getPeriodDateRange(year, period);

  return {
    period,
    name: period === 1 ? 'รอบที่ 1 (ต.ค. - มี.ค.)' : 'รอบที่ 2 (เม.ย. - ก.ย.)',
    start,
    end,
  };
}

/**
 * Get current fiscal year and round based on today's date
 */
export function getCurrentFiscalYearAndRound(): { fiscalYear: number; round: 1 | 2 } {
  const today = new Date();
  const fiscalYear = getFiscalYear(today);
  const month = today.getMonth(); // 0-indexed

  // Round 1: Oct-Mar (9-11, 0-2), Round 2: Apr-Sep (3-8)
  const round = (month >= 3 && month <= 8) ? 2 : 1;

  return { fiscalYear, round };
}

/**
 * Generate list of recent fiscal years (for dropdown)
 */
export function getRecentFiscalYears(count: number = 4): number[] {
  const currentFiscalYear = getFiscalYear(new Date());
  const years: number[] = [];

  for (let i = 0; i < count; i++) {
    years.push(currentFiscalYear - i);
  }

  return years;
}


/**
 * Get date range for a fiscal year round
 * @param fiscalYear - Buddhist Era year (e.g., 2569)
 * @param round - 1 or 2
 */
export function getFiscalRoundDateRange(
  fiscalYear: number,
  round: 1 | 2
): { start: Date; end: Date } {
  const christianYear = fiscalYear - 543;

  if (round === 1) {
    // Round 1: Oct (previous year) - Mar (current year)
    return {
      start: new Date(christianYear - 1, 9, 1), // Oct 1 of previous year
      end: new Date(christianYear, 2, 31),      // Mar 31
    };
  } else {
    // Round 2: Apr - Sep (current year)
    return {
      start: new Date(christianYear, 3, 1),     // Apr 1
      end: new Date(christianYear, 8, 30),      // Sep 30
    };
  }
}
