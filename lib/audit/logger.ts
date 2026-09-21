import { prisma } from '@/lib/prisma';

interface AuditLogData {
  userId?: string;
  userType: 'hr' | 'super_admin' | 'system';
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        userType: data.userType,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details ?? undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
