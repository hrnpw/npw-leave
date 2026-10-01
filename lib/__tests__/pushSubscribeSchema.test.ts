import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirrors the schema in app/api/teacher/push/subscribe/route.ts
const subscribeSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

describe('push subscribe schema', () => {
  it('accepts a valid https push subscription', () => {
    const result = subscribeSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-https endpoint', () => {
    const result = subscribeSchema.safeParse({
      endpoint: 'http://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed endpoint URL', () => {
    const result = subscribeSchema.safeParse({
      endpoint: 'not-a-url',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing keys', () => {
    const result = subscribeSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty auth key', () => {
    const result = subscribeSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: 'p256dh-value', auth: '' },
    });

    expect(result.success).toBe(false);
  });
});
