import { describe, it, expect } from 'vitest';
import { validateCitizenId, formatCitizenId, maskCitizenId } from '../citizenId';

describe('validateCitizenId', () => {
  it('should validate correct citizen ID', () => {
    // Using a valid Thai citizen ID with correct checksum
    expect(validateCitizenId('1101700207951')).toBe(true);
    expect(validateCitizenId('1-1017-00207-95-1')).toBe(true);
  });

  it('should reject invalid length', () => {
    expect(validateCitizenId('123456789012')).toBe(false);
    expect(validateCitizenId('12345678901234')).toBe(false);
  });

  it('should reject non-numeric characters', () => {
    expect(validateCitizenId('123456789012A')).toBe(false);
  });

  it('should reject invalid checksum', () => {
    expect(validateCitizenId('1234567890124')).toBe(false);
  });
});

describe('formatCitizenId', () => {
  it('should format citizen ID with dashes', () => {
    expect(formatCitizenId('1234567890123')).toBe('1-2345-67890-12-3');
  });

  it('should handle already formatted ID', () => {
    expect(formatCitizenId('1-2345-67890-12-3')).toBe('1-2345-67890-12-3');
  });

  it('should return original if invalid length', () => {
    expect(formatCitizenId('12345')).toBe('12345');
  });
});

describe('maskCitizenId', () => {
  it('should mask middle digits', () => {
    expect(maskCitizenId('1234567890123')).toBe('1-2345-xxxxx-xx-3');
  });

  it('should handle formatted input', () => {
    expect(maskCitizenId('1-2345-67890-12-3')).toBe('1-2345-xxxxx-xx-3');
  });
});
