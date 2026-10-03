import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { checkTransition } from '@/lib/leaveWorkflow';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';

// POST /api/hr/reviews/[id]/recall - HR ดึงกลับ (reviewed -> pending), ไม่ส่ง push
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
      select: { id: true, leaveNo: true, status: true, teacherId: true },
    });

    if (!leave) {
      return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 });
    }

    const check = checkTransition('recall', leave.status, session.role);
    if (!check.ok) {
      const status = check.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ error: check.error }, { status });
    }

    const result = await prisma.leave.updateMany({
      where: { id: leaveId, status: leave.status },
      data: {
        status: check.toStatus,
        reviewedAt: null,
        reviewedById: null,
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
      action: AuditActions.RECALL_REVIEW,
      resource: AuditResources.LEAVES,
      resourceId: leave.id,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        fromStatus: leave.status,
        toStatus: check.toStatus,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => console.error('[RECALL] Audit log failed (non-blocking):', err));

    return NextResponse.json({ success: true, message: 'ดึงกลับใบลาสำเร็จ' });
  } catch (error) {
    console.error('Recall review error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงกลับใบลา' }, { status: 500 });
  }
}
