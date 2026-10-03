import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { checkTransition } from '@/lib/leaveWorkflow';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';
import { sendPushToTeacher } from '@/lib/push/send';

// POST /api/hr/reviews/[id]/approve - HR ตรวจผ่าน (pending -> reviewed)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id || !session.role) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { id: leaveId } = await params;

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      select: {
        id: true,
        leaveNo: true,
        status: true,
        teacherId: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    const check = checkTransition('review', leave.status, session.role);
    if (!check.ok) {
      const status = check.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ error: check.error }, { status });
    }

    const result = await prisma.leave.updateMany({
      where: { id: leaveId, status: leave.status },
      data: {
        status: check.toStatus,
        reviewedAt: new Date(),
        reviewedById: session.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'ใบลานี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า' },
        { status: 409 }
      );
    }

    const actorRole = session.role;
    after(() => createAuditLog({
      userId: session.id,
      userType: actorRole,
      action: AuditActions.REVIEW_LEAVE,
      resource: AuditResources.LEAVES,
      resourceId: leave.id,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        stage: 'review',
        fromStatus: leave.status,
        toStatus: check.toStatus,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => console.error('[REVIEW] Audit log failed (non-blocking):', err)));

    after(() =>
      sendPushToTeacher(leave.teacherId, {
        title: 'ใบลาผ่านการตรวจสอบแล้ว',
        body: `ใบลาเลขที่ ${leave.leaveNo} ผ่านการตรวจสอบแล้ว รอผู้อำนวยการอนุมัติ`,
        url: `/teacher/leaves/${leave.id}`,
        tag: `leave-${leave.id}`,
      })
    );

    return NextResponse.json({ success: true, message: 'ตรวจผ่านใบลาสำเร็จ' });
  } catch (error) {
    console.error('Review approve error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจใบลา' }, { status: 500 });
  }
}
