import { prisma } from '@/lib/prisma';

export interface AuditLogParams {
  userId?: string | null;
  userType: 'hr' | 'teacher' | 'system';
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * Should be called for all critical operations
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        userType: params.userType,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        details: params.details || undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    // Don't throw - audit log failure shouldn't break the operation
    console.error('[AUDIT LOG ERROR]', error);
  }
}

/**
 * Common audit log actions
 */
export const AuditActions = {
  // Leave operations
  CREATE_LEAVE: 'CREATE_LEAVE',
  APPROVE_LEAVE: 'APPROVE_LEAVE',
  REJECT_LEAVE: 'REJECT_LEAVE',
  DELETE_LEAVE: 'DELETE_LEAVE',
  UPDATE_LEAVE: 'UPDATE_LEAVE',

  // Teacher operations
  CREATE_TEACHER: 'CREATE_TEACHER',
  UPDATE_TEACHER: 'UPDATE_TEACHER',
  DELETE_TEACHER: 'DELETE_TEACHER',
  IMPORT_TEACHERS: 'IMPORT_TEACHERS',
  EXPORT_TEACHERS: 'EXPORT_TEACHERS',

  // HR operations
  CREATE_HR: 'CREATE_HR',
  UPDATE_HR: 'UPDATE_HR',
  DELETE_HR: 'DELETE_HR',

  // Settings operations
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',

  // Authentication
  HR_LOGIN: 'HR_LOGIN',
  HR_LOGIN_FAILED: 'HR_LOGIN_FAILED',
  HR_LOGOUT: 'HR_LOGOUT',

  // Bulk operations
  BULK_DELETE_LEAVES: 'BULK_DELETE_LEAVES',
  BULK_IMPORT: 'BULK_IMPORT',

  // System operations
  GENERATE_PDF: 'GENERATE_PDF',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
} as const;

/**
 * Common resource types
 */
export const AuditResources = {
  LEAVES: 'leaves',
  TEACHERS: 'teachers',
  HR_USERS: 'hr_users',
  SETTINGS: 'settings',
  HOLIDAYS: 'holidays',
  SIGNATORIES: 'signatories',
} as const;
