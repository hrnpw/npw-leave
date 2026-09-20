import { NextResponse } from 'next/server';

/**
 * Standardized error response format
 * Always returns Thai messages for user-facing errors
 * Only includes details in development mode
 */
export function errorResponse(
  code: string,
  messageTH: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message: messageTH,
        ...(process.env.NODE_ENV === 'development' && details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Standardized success response format
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Common error codes for consistency
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;
