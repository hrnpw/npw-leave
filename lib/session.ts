import { SessionOptions } from 'iron-session';

export interface TeacherSession {
  id: string;
  teacherCode: string;
  firstName: string;
  lastName: string;
  createdAt: number;
}

export interface HrSession {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'hr' | 'super_admin';
  createdAt: number;
}

// Session configuration - 1 hour sliding window
const SESSION_TTL = 60 * 60; // 1 hour in seconds
const SESSION_WARNING_TIME = 5 * 60; // 5 minutes before expiry

export const teacherSessionOptions: SessionOptions = {
  cookieName: 'teacher_session',
  password: process.env.SESSION_SECRET!,
  ttl: SESSION_TTL,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/',
  },
};

export const hrSessionOptions: SessionOptions = {
  cookieName: 'hr_session',
  password: process.env.SESSION_SECRET!,
  ttl: SESSION_TTL,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/',
  },
};

// Helper to check if session is about to expire (within 5 minutes)
export function isSessionNearExpiry(createdAt: number): boolean {
  const now = Date.now();
  const elapsed = (now - createdAt) / 1000; // seconds
  return elapsed >= SESSION_TTL - SESSION_WARNING_TIME;
}

// Helper to check if session is expired
export function isSessionExpired(createdAt: number): boolean {
  const now = Date.now();
  const elapsed = (now - createdAt) / 1000;
  return elapsed >= SESSION_TTL;
}
