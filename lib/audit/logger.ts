import { prisma } from '@/lib/prisma';
import type { AuditUserType } from '@/lib/roles';

interface AuditLogData {
  userId?: string;
  userType: AuditUserType;
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
