import { describe, it, expect } from 'vitest';
import { canReview, canApprove, canManage, hrRoleLabel, primaryLeaveQueue } from '../roles';

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

describe('primaryLeaveQueue', () => {
  it('sends director to approvals with reviewed count', () => {
    expect(primaryLeaveQueue('director')).toEqual({
      href: '/hr/approvals',
      label: 'รออนุมัติ',
      countKey: 'reviewed',
    });
  });

  it('sends hr and super_admin to reviews with pending count', () => {
    for (const role of ['hr', 'super_admin'] as const) {
      expect(primaryLeaveQueue(role)).toEqual({
        href: '/hr/reviews',
        label: 'รอตรวจสอบ',
        countKey: 'pending',
      });
    }
  });
});
