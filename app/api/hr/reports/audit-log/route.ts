import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
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

    const action = searchParams.get('action')?.trim();
    const userType = searchParams.get('userType')?.trim();
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20)
    );
    const isExcel = formatType === 'excel';

    const isSuperAdmin = session.role === 'super_admin';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (isSuperAdmin ? 36500 : days));

    const where: Prisma.AuditLogWhereInput = {
      createdAt: { gte: cutoffDate },
    };

    // action ใน DB เป็นรูป UPPER_SNAKE (เช่น CREATE_HR_USER) จึงค้นแบบ contains ไม่สนตัวพิมพ์
    // เพื่อให้ตัวเลือก "create" / "approve" ฯลฯ ในหน้า admin จับกลุ่ม action ที่เกี่ยวข้องได้
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userType) where.userType = userType;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { hrUser: { username: { contains: search, mode: 'insensitive' } } },
        { hrUser: { firstName: { contains: search, mode: 'insensitive' } } },
        { hrUser: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          hrUser: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        // Excel ส่งออกชุดที่กรองแล้ว (สูงสุด 1000 แถว) ส่วนหน้าจอแบ่งหน้าตาม page/limit
        skip: isExcel ? 0 : (page - 1) * limit,
        take: isExcel ? 1000 : limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const report = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      createdAt: log.createdAt.toISOString(), // AdminClient อ่านจากฟิลด์นี้
      userId: log.userId,
      userType: log.userType,
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
