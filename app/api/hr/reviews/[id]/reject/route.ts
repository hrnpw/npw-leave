import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { checkTransition } from '@/lib/leaveWorkflow';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';
import { sendPushToTeacher } from '@/lib/push/send';

// POST /api/hr/reviews/[id]/reject - HR ตีกลับ (pending -> rejected)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id || !session.role) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
    }

    const { reason } = await request.json();
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

    const check = checkTransition('reject', leave.status, session.role, { reason });
    if (!check.ok) {
      const status = check.code === 'FORBIDDEN' ? 403 : check.code === 'VALIDATION' ? 400 : 400;
      return NextResponse.json({ error: check.error }, { status });
    }

    const result = await prisma.leave.updateMany({
      where: { id: leaveId, status: leave.status },
      data: {
        status: check.toStatus,
        rejectionReason: reason.trim(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'ใบลานี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า' },
        { status: 409 }
      );
    }

    createAuditLog({
      userId: session.id,
      userType: session.role,
      action: AuditActions.REJECT_LEAVE,
      resource: AuditResources.LEAVES,
      resourceId: leave.id,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        stage: check.stage,
        rejectionReason: reason.trim(),
        fromStatus: leave.status,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => console.error('[REVIEW REJECT] Audit log failed (non-blocking):', err));

    after(() =>
      sendPushToTeacher(leave.teacherId, {
        title: 'ใบลาไม่ได้รับการอนุมัติ',
        body: `ใบลาเลขที่ ${leave.leaveNo} - ${leave.teacher.firstName} ${leave.teacher.lastName} ไม่ได้รับการอนุมัติ แตะเพื่อดูรายละเอียด`,
        url: `/teacher/leaves/${leave.id}`,
        tag: `leave-${leave.id}`,
      })
    );

    return NextResponse.json({ success: true, message: 'บันทึกการตีกลับสำเร็จ' });
  } catch (error) {
    console.error('Review reject error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตีกลับใบลา' }, { status: 500 });
  }
}
