/**
 * Security utilities for request validation and sanitization
 */

import { NextRequest } from 'next/server';

/**
 * Get client IP address from request headers
 * Handles Vercel's forwarding headers
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Validate return URL to prevent open redirect attacks
 * Only allow relative paths within the application
 */
export function validateReturnUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    // Only allow relative URLs starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      // Prevent protocol-relative URLs like //evil.com
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.\.+/g, '_')
    .substring(0, 255);
}

/**
 * Check if request is from Vercel Cron
 */
export function isVercelCron(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitive(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return '*'.repeat(data.length);
  }
  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}

/**
 * Validate SQL-like input to prevent injection
 * Used for search/filter inputs that might be used in queries
 */
export function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[;'"\\]/g, '') // Remove SQL special chars
    .trim()
    .substring(0, 200); // Limit length
}
