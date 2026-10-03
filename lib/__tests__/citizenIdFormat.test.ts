import { describe, it, expect } from 'vitest';
import { formatCitizenIdPartial, caretIndexAfterDigits } from '../citizenIdFormat';

describe('formatCitizenIdPartial', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatCitizenIdPartial('')).toBe('');
    expect(formatCitizenIdPartial('1')).toBe('1');
    expect(formatCitizenIdPartial('12')).toBe('1-2');
    expect(formatCitizenIdPartial('12345')).toBe('1-2345');
    expect(formatCitizenIdPartial('123456')).toBe('1-2345-6');
    expect(formatCitizenIdPartial('123456789012')).toBe('1-2345-67890-12');
    expect(formatCitizenIdPartial('1234567890123')).toBe('1-2345-67890-12-3');
  });
});

describe('caretIndexAfterDigits', () => {
  it('places the caret right after the nth digit, skipping dashes', () => {
    const formatted = '1-2345-67890-12-3';
    expect(caretIndexAfterDigits(formatted, 0)).toBe(0);
    expect(caretIndexAfterDigits(formatted, 1)).toBe(1);
    expect(caretIndexAfterDigits(formatted, 2)).toBe(3);
    expect(caretIndexAfterDigits(formatted, 6)).toBe(8);
    expect(caretIndexAfterDigits(formatted, 13)).toBe(formatted.length);
  });
});
