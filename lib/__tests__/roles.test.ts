import { describe, it, expect } from 'vitest';
import { canReview, canApprove, canManage, hrRoleLabel } from '../roles';

describe('canReview', () => {
  it('allows hr and super_admin', () => {
    expect(canReview('hr')).toBe(true);
    expect(canReview('super_admin')).toBe(true);
  });

  it('denies director', () => {
    expect(canReview('director')).toBe(false);
  });
});

describe('canApprove', () => {
  it('allows director and super_admin', () => {
    expect(canApprove('director')).toBe(true);
    expect(canApprove('super_admin')).toBe(true);
  });

  it('denies hr', () => {
    expect(canApprove('hr')).toBe(false);
  });
});

describe('canManage', () => {
  it('allows hr, director and super_admin', () => {
    expect(canManage('hr')).toBe(true);
    expect(canManage('director')).toBe(true);
    expect(canManage('super_admin')).toBe(true);
  });
});

describe('hrRoleLabel', () => {
  it('returns Thai labels', () => {
    expect(hrRoleLabel('hr')).toBe('เจ้าหน้าที่ HR');
    expect(hrRoleLabel('director')).toBe('ผู้อำนวยการ');
    expect(hrRoleLabel('super_admin')).toBe('ผู้ดูแลระบบ');
  });
});
