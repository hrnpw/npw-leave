import { getDateRange, isWeekend } from './dateUtils';

/**
 * Calculate leave days (working days and calendar days)
 * This is the CORE LOGIC of the system - must match spec exactly
 */

export interface LeaveDayResult {
  date: Date;
  isWorkingDay: boolean;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
}

export interface LeaveCalculation {
  daysWorking: number;
  daysCalendar: number;
  leaveDays: LeaveDayResult[];
}

/**
 * Calculate leave days between start and end date
 *
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param holidays - Array of holiday dates
 * @param isHalfDay - Whether this is a half-day leave
 * @param halfDayPeriod - Which half (only valid if isHalfDay=true and single day)
 *
 * Returns:
 * - daysWorking: Working days (excluding weekends and holidays)
 * - daysCalendar: All days (including weekends and holidays)
 * - leaveDays: Detailed breakdown per day
 */
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[],
  isHalfDay: boolean = false,
  halfDayPeriod?: 'morning' | 'afternoon'
): LeaveCalculation {
  const dateRange = getDateRange(startDate, endDate);

  // Normalize holiday dates for comparison (strip time)
  const holidaySet = new Set(
    holidays.map(h => new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString())
  );

  const leaveDays: LeaveDayResult[] = [];
  let daysWorking = 0;
  let daysCalendar = 0;

  for (const date of dateRange) {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateKey = normalizedDate.toISOString();

    const isHoliday = holidaySet.has(dateKey);
    const isWeekendDay = isWeekend(date);
    const isWorkingDay = !isWeekendDay && !isHoliday;

    // Half-day logic (only valid for single-day leave)
    const isSingleDay = dateRange.length === 1;
    const isThisDayHalf = isHalfDay && isSingleDay;

    if (isThisDayHalf) {
      // Half-day leave
      if (isWorkingDay) {
        daysWorking += 0.5;
        daysCalendar += 0.5;
      } else {
        // Half-day on weekend/holiday: calendar=0.5, working=0
        daysCalendar += 0.5;
        daysWorking += 0;
      }
    } else {
      // Full-day leave
      daysCalendar += 1;
      if (isWorkingDay) {
        daysWorking += 1;
      }
    }

    leaveDays.push({
      date,
      isWorkingDay,
      isHalfDay: isThisDayHalf,
      halfDayPeriod: isThisDayHalf ? halfDayPeriod : undefined,
    });
  }

  return {
    daysWorking,
    daysCalendar,
    leaveDays,
  };
}

/**
 * Check if a leave period spans across two leave periods
 * Returns the days in each period
 */
export function splitLeaveAcrossPeriods(
  startDate: Date,
  endDate: Date,
  holidays: Date[],
  isHalfDay: boolean = false,
  halfDayPeriod?: 'morning' | 'afternoon'
): {
  period1Days: number;
  period2Days: number;
} {
  const dateRange = getDateRange(startDate, endDate);

  // Period 1: April 1 - September 30
  // Period 2: October 1 - March 31

  let period1Days = 0;
  let period2Days = 0;

  const holidaySet = new Set(
    holidays.map(h => new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString())
  );

  const isSingleDay = dateRange.length === 1;
  const isThisDayHalf = isHalfDay && isSingleDay;
  const dayValue = isThisDayHalf ? 0.5 : 1;

  for (const date of dateRange) {
    const month = date.getMonth(); // 0-indexed
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateKey = normalizedDate.toISOString();

    const isHoliday = holidaySet.has(dateKey);
    const isWeekendDay = isWeekend(date);

    // Use calendar days for quota checking (spec 3.2)
    const calendarDayValue = dayValue;

    // Period 1: April (3) to September (8)
    if (month >= 3 && month <= 8) {
      period1Days += calendarDayValue;
    } else {
      // Period 2: October (9) to March (2)
      period2Days += calendarDayValue;
    }
  }

  return {
    period1Days,
    period2Days,
  };
}
