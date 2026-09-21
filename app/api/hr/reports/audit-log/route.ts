import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { exportToExcel, createExcelResponse } from '@/lib/excel/export';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const formatType = searchParams.get('format');
    const days = parseInt(searchParams.get('days') || '90');

    const isSuperAdmin = session.role === 'super_admin';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (isSuperAdmin ? 36500 : days));

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: cutoffDate },
      },
      include: {
        hrUser: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000,
    });

    const total = await prisma.auditLog.count({
      where: {
        createdAt: { gte: cutoffDate },
      },
    });

    const report = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user: log.hrUser
        ? `${log.hrUser.firstName} ${log.hrUser.lastName} (${log.hrUser.username})`
        : log.userType === 'system' ? 'System' : 'Unknown',
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      details: log.details,
    }));

    if (formatType === 'excel') {
      const excelData = report.map((r) => ({
        วันเวลา: format(new Date(r.timestamp), 'dd MMM yyyy HH:mm:ss', {
          locale: th,
        }),
        ผู้ใช้: r.user,
        การกระทำ: r.action,
        Resource: r.resource || '-',
        'Resource ID': r.resourceId || '-',
        'IP Address': r.ipAddress || '-',
        รายละเอียด: r.details ? JSON.stringify(r.details) : '-',
      }));

      const buffer = exportToExcel(excelData, 'audit-log.xlsx', 'Audit Log');

      return createExcelResponse(buffer, 'audit-log.xlsx');
    }

    return NextResponse.json({ logs: report, total });
  } catch (error) {
    console.error('Failed to generate audit log:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
