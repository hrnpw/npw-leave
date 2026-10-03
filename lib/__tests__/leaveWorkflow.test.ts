import { describe, it, expect } from 'vitest';
import { checkTransition } from '../leaveWorkflow';

const LONG_REASON = 'เหตุผลยาวพอสมควร'; // >= 10 chars

describe('review: pending -> reviewed', () => {
  it('hr can review a pending leave', () => {
    const result = checkTransition('review', 'pending', 'hr');
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('reviewed');
  });

  it('super_admin can review a pending leave', () => {
    expect(checkTransition('review', 'pending', 'super_admin').ok).toBe(true);
  });

  it('director cannot review', () => {
    const result = checkTransition('review', 'pending', 'director');
    expect(result.ok).toBe(false);
  });

  it('cannot review a leave that is not pending', () => {
    const result = checkTransition('review', 'reviewed', 'hr');
    expect(result.ok).toBe(false);
  });
});

describe('reject: pending -> rejected (review stage)', () => {
  it('hr can reject a pending leave with a valid reason', () => {
    const result = checkTransition('reject', 'pending', 'hr', { reason: LONG_REASON });
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('rejected');
    expect(result.stage).toBe('review');
  });

  it('director cannot reject a pending leave', () => {
    const result = checkTransition('reject', 'pending', 'director', { reason: LONG_REASON });
    expect(result.ok).toBe(false);
  });

  it('rejects when reason is too short', () => {
    const result = checkTransition('reject', 'pending', 'hr', { reason: 'สั้น' });
    expect(result.ok).toBe(false);
  });

  it('rejects when reason is missing', () => {
    const result = checkTransition('reject', 'pending', 'hr');
    expect(result.ok).toBe(false);
  });
});

describe('reject: reviewed -> rejected (approval stage)', () => {
  it('director can reject a reviewed leave with a valid reason', () => {
    const result = checkTransition('reject', 'reviewed', 'director', { reason: LONG_REASON });
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('rejected');
    expect(result.stage).toBe('approval');
  });

  it('super_admin can reject a reviewed leave', () => {
    const result = checkTransition('reject', 'reviewed', 'super_admin', { reason: LONG_REASON });
    expect(result.ok).toBe(true);
  });

  it('hr cannot reject a reviewed leave', () => {
    const result = checkTransition('reject', 'reviewed', 'hr', { reason: LONG_REASON });
    expect(result.ok).toBe(false);
  });
});

describe('reject: invalid current status', () => {
  it('cannot reject an approved leave', () => {
    const result = checkTransition('reject', 'approved', 'super_admin', { reason: LONG_REASON });
    expect(result.ok).toBe(false);
  });
});

describe('recall: reviewed -> pending', () => {
  it('hr can recall a reviewed leave', () => {
    const result = checkTransition('recall', 'reviewed', 'hr');
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('pending');
  });

  it('director cannot recall', () => {
    expect(checkTransition('recall', 'reviewed', 'director').ok).toBe(false);
  });

  it('cannot recall a pending leave', () => {
    expect(checkTransition('recall', 'pending', 'hr').ok).toBe(false);
  });
});

describe('approve: reviewed -> approved', () => {
  it('director can approve a reviewed leave', () => {
    const result = checkTransition('approve', 'reviewed', 'director');
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('approved');
  });

  it('super_admin can approve a reviewed leave', () => {
    expect(checkTransition('approve', 'reviewed', 'super_admin').ok).toBe(true);
  });

  it('hr cannot approve', () => {
    expect(checkTransition('approve', 'reviewed', 'hr').ok).toBe(false);
  });

  it('cannot approve a pending leave (must be reviewed first)', () => {
    expect(checkTransition('approve', 'pending', 'director').ok).toBe(false);
  });
});

describe('cancel: pending -> cancelled', () => {
  it('allows cancelling a pending leave', () => {
    const result = checkTransition('cancel', 'pending');
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('cancelled');
  });

  it('disallows cancelling a reviewed leave', () => {
    expect(checkTransition('cancel', 'reviewed').ok).toBe(false);
  });

  it('disallows cancelling an approved leave', () => {
    expect(checkTransition('cancel', 'approved').ok).toBe(false);
  });
});

describe('revert: approved -> pending (danger zone)', () => {
  it('super_admin can revert an approved leave', () => {
    const result = checkTransition('revert', 'approved', 'super_admin');
    expect(result.ok).toBe(true);
    expect(result.toStatus).toBe('pending');
  });

  it('director cannot revert', () => {
    expect(checkTransition('revert', 'approved', 'director').ok).toBe(false);
  });

  it('hr cannot revert', () => {
    expect(checkTransition('revert', 'approved', 'hr').ok).toBe(false);
  });

  it('cannot revert a non-approved leave', () => {
    expect(checkTransition('revert', 'reviewed', 'super_admin').ok).toBe(false);
  });
});
