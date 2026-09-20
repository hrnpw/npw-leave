import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit/logger';

// POST /api/hr/admin/danger/revert-leave-status - ย้อนสถานะใบลา (super admin เท่านั้น)
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { leaveId, confirmation } = body;

    if (!leaveId) {
      return NextResponse.json(
        { error: 'กรุณาระบุเลขที่ใบลา' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลใบลา
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: { firstName: true, lastName: true, teacherCode: true },
        },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลานี้' }, { status: 404 });
    }

    if (leave.status !== 'approved') {
      return NextResponse.json(
        { error: 'ใบลานี้ไม่ได้อยู่ในสถานะ "อนุมัติแล้ว"' },
        { status: 400 }
      );
    }

    // ต้องพิมพ์เลขที่ใบลาตรงตัว
    if (confirmation !== leave.leaveNo) {
      return NextResponse.json(
        { error: 'กรุณากรอกเลขที่ใบลาให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // ย้อนสถานะเป็น pending
    await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: 'pending',
        approvedAt: null,
        printedAt: null,
        // ไม่ลบ snapshot signatories — เก็บไว้เป็นหลักฐาน
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: 'REVERT_LEAVE_STATUS',
      resource: 'leave',
      resourceId: leaveId,
      details: {
        leaveNo: leave.leaveNo,
        teacher: `${leave.teacher.firstName} ${leave.teacher.lastName} (${leave.teacher.teacherCode})`,
        fromStatus: 'approved',
        toStatus: 'pending',
        executor: session.id,
        reason: 'Super admin reverted status',
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/hr/admin/danger/revert-leave-status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
