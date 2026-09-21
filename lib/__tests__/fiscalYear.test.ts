import { describe, it, expect } from 'vitest';
import { getFiscalYear, getLeavePeriod, formatLeaveNumber, parseLeaveNumber } from '../fiscalYear';

describe('getFiscalYear', () => {
  it('should return correct fiscal year for dates in Oct-Dec', () => {
    // Oct 1, 2026 → FY 2570 (2026+543+1)
    expect(getFiscalYear(new Date(2026, 9, 1))).toBe(2570);
    expect(getFiscalYear(new Date(2026, 11, 31))).toBe(2570);
  });

  it('should return correct fiscal year for dates in Jan-Sep', () => {
    // Sep 30, 2026 → FY 2569 (2026+543)
    expect(getFiscalYear(new Date(2026, 8, 30))).toBe(2569);
    expect(getFiscalYear(new Date(2026, 0, 1))).toBe(2569);
  });

  it('T13: leave submitted on different dates should have correct fiscal year', () => {
    // Sep 30, 2026 → LEAVE-69/2-xxxx
    expect(getFiscalYear(new Date(2026, 8, 30))).toBe(2569);
    // Oct 1, 2026 → LEAVE-70/1-0001
    expect(getFiscalYear(new Date(2026, 9, 1))).toBe(2570);
  });
});

describe('getLeavePeriod', () => {
  it('should return period 2 for Apr-Sep', () => {
    expect(getLeavePeriod(new Date(2026, 3, 1))).toBe(2); // April 1
    expect(getLeavePeriod(new Date(2026, 8, 30))).toBe(2); // Sep 30
  });

  it('should return period 1 for Oct-Mar', () => {
    expect(getLeavePeriod(new Date(2026, 9, 1))).toBe(1); // Oct 1
    expect(getLeavePeriod(new Date(2027, 2, 31))).toBe(1); // Mar 31
  });
});

describe('formatLeaveNumber', () => {
  it('should format leave number with fiscal year, round, and padding', () => {
    expect(formatLeaveNumber(2569, 1, 1)).toBe('LEAVE-69/1-0001');
    expect(formatLeaveNumber(2569, 2, 123)).toBe('LEAVE-69/2-0123');
    expect(formatLeaveNumber(2570, 1, 9999)).toBe('LEAVE-70/1-9999');
  });
});

describe('parseLeaveNumber', () => {
  it('should parse valid leave number', () => {
    expect(parseLeaveNumber('LEAVE-69/1-0001')).toEqual({
      fiscalYear: 2569,
      round: 1,
      runningNo: 1,
    });
    expect(parseLeaveNumber('LEAVE-69/2-0123')).toEqual({
      fiscalYear: 2569,
      round: 2,
      runningNo: 123,
    });
  });

  it('should return null for invalid format', () => {
    expect(parseLeaveNumber('LEAVE-69/1-001')).toBeNull();
    expect(parseLeaveNumber('LV-2569-0001')).toBeNull();
    expect(parseLeaveNumber('LEAVE-69-0001')).toBeNull();
  });
});
