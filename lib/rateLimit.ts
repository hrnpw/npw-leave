// Database-backed rate limiter for authentication endpoints
// Key format: "type:identifier:ip" (e.g., "teacher:1234567890123:127.0.0.1")

import { prisma } from '@/lib/prisma';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

// Clean up old entries periodically (run once on startup, then every hour)
async function cleanupExpiredRateLimits() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    await prisma.rateLimit.deleteMany({
      where: {
        OR: [
          // Delete expired locks
          {
            lockedUntil: {
              not: null,
              lt: now
            }
          },
          // Delete entries not updated in the last hour (no recent activity)
          {
            lockedUntil: null,
            updatedAt: {
              lt: oneHourAgo
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Rate limit cleanup error:', error);
  }
}

// Run cleanup on startup and then every hour
cleanupExpiredRateLimits();
setInterval(cleanupExpiredRateLimits, 60 * 60 * 1000);

export function getRateLimitKey(type: 'teacher' | 'hr', identifier: string, ip: string): string {
  return `${type}:${identifier}:${ip}`;
}

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; remainingTime?: number }> {
  const now = new Date();

  try {
    const entry = await prisma.rateLimit.findUnique({
      where: { key }
    });

    if (!entry) {
      return { allowed: true };
    }

    // Check if locked
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const remainingTime = Math.ceil((entry.lockedUntil.getTime() - now.getTime()) / 1000);
      return { allowed: false, remainingTime };
    }

    // Lock expired, delete entry and allow
    if (entry.lockedUntil && entry.lockedUntil <= now) {
      await prisma.rateLimit.delete({ where: { key } });
      return { allowed: true };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow the request if database is unavailable
    return { allowed: true };
  }
}

export async function recordFailedAttempt(key: string): Promise<void> {
  const now = new Date();

  try {
    const entry = await prisma.rateLimit.findUnique({
      where: { key }
    });

    const attempts = (entry?.attempts || 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCK_DURATION)
      : null;

    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        attempts,
        lockedUntil
      },
      update: {
        attempts,
        lockedUntil
      }
    });
  } catch (error) {
    console.error('Record failed attempt error:', error);
  }
}

export async function recordSuccessfulAttempt(key: string): Promise<void> {
  try {
    await prisma.rateLimit.delete({
      where: { key }
    }).catch(() => {
      // Ignore error if entry doesn't exist
    });
  } catch (error) {
    console.error('Record successful attempt error:', error);
  }
}

export async function getRemainingAttempts(key: string): Promise<number> {
  try {
    const entry = await prisma.rateLimit.findUnique({
      where: { key }
    });

    if (!entry) return MAX_ATTEMPTS;
    return Math.max(0, MAX_ATTEMPTS - entry.attempts);
  } catch (error) {
    console.error('Get remaining attempts error:', error);
    return MAX_ATTEMPTS;
  }
}
