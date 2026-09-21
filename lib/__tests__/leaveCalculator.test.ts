import { describe, it, expect } from 'vitest';
import { calculateLeaveDays, splitLeaveAcrossPeriods } from '../leaveCalculator';

describe('calculateLeaveDays', () => {
  it('T1: Sat Sep 11 - Mon Sep 14, 2026 should return calendar=4, working=2', () => {
    const result = calculateLeaveDays(
      new Date(2026, 8, 11), // Sep 11 (Sat)
      new Date(2026, 8, 14), // Sep 14 (Mon)
      []
    );

    expect(result.daysCalendar).toBe(4);
    expect(result.daysWorking).toBe(2); // Mon, Tue (Sun, Sat excluded)
  });

  it('T2: half-day on working day should return both=0.5', () => {
    const result = calculateLeaveDays(
      new Date(2026, 8, 8), // Mon Sep 8
      new Date(2026, 8, 8),
      [],
      true, // half-day
      'morning'
    );

    expect(result.daysCalendar).toBe(0.5);
    expect(result.daysWorking).toBe(0.5);
  });

  it('half-day on weekend should return calendar=0.5, working=0', () => {
    const result = calculateLeaveDays(
      new Date(2026, 8, 13), // Sun Sep 13
      new Date(2026, 8, 13),
      [],
      true,
      'afternoon'
    );

    expect(result.daysCalendar).toBe(0.5);
    expect(result.daysWorking).toBe(0);
  });

  it('should exclude holidays from working days', () => {
    const holidays = [new Date(2026, 8, 8)]; // Mon Sep 8 is holiday

    const result = calculateLeaveDays(
      new Date(2026, 8, 8), // Mon (holiday)
      new Date(2026, 8, 9), // Tue
      holidays
    );

    expect(result.daysCalendar).toBe(2);
    expect(result.daysWorking).toBe(1); // Only Tue counts
  });

  it('should handle multi-day leave correctly', () => {
    const result = calculateLeaveDays(
      new Date(2026, 8, 8), // Mon
      new Date(2026, 8, 10), // Wed
      []
    );

    expect(result.daysCalendar).toBe(3);
    expect(result.daysWorking).toBe(3);
    expect(result.leaveDays).toHaveLength(3);
  });

  it('full weekend should return calendar=2, working=0', () => {
    const result = calculateLeaveDays(
      new Date(2026, 8, 5), // Sat Sep 5
      new Date(2026, 8, 6), // Sun Sep 6
      []
    );

    expect(result.daysCalendar).toBe(2);
    expect(result.daysWorking).toBe(0);
  });
});

describe('splitLeaveAcrossPeriods', () => {
  it('T3: Sep 28 - Oct 3, 2026 should split correctly', () => {
    // Sep 28 (Sun), 29 (Mon), 30 (Tue) = Period 1
    // Oct 1 (Wed), 2 (Thu), 3 (Fri) = Period 2
    const result = splitLeaveAcrossPeriods(
      new Date(2026, 8, 28),
      new Date(2026, 9, 3),
      []
    );

    expect(result.period1Days).toBe(3); // Sep 28-30
    expect(result.period2Days).toBe(3); // Oct 1-3
  });

  it('leave entirely in period 1 should have period2Days=0', () => {
    const result = splitLeaveAcrossPeriods(
      new Date(2026, 4, 1), // May 1
      new Date(2026, 4, 5), // May 5
      []
    );

    expect(result.period1Days).toBe(5);
    expect(result.period2Days).toBe(0);
  });

  it('leave entirely in period 2 should have period1Days=0', () => {
    const result = splitLeaveAcrossPeriods(
      new Date(2026, 10, 1), // Nov 1
      new Date(2026, 10, 5), // Nov 5
      []
    );

    expect(result.period1Days).toBe(0);
    expect(result.period2Days).toBe(5);
  });

  it('half-day leave should count as 0.5 in the correct period', () => {
    const result = splitLeaveAcrossPeriods(
      new Date(2026, 4, 15), // May 15 (Period 1)
      new Date(2026, 4, 15),
      [],
      true,
      'morning'
    );

    expect(result.period1Days).toBe(0.5);
    expect(result.period2Days).toBe(0);
  });
});
