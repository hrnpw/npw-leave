import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCodes } from '@/lib/apiResponse';
import { checkTransition } from '@/lib/leaveWorkflow';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';
import { sendPushToTeacher } from '@/lib/push/send';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id || !session.role) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const { reason } = await request.json();
    const { id: leaveId } = await params;

    // Get leave
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leave) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'ไม่พบใบลา', 404);
    }

    // Endpoint นี้สำหรับขั้นอนุมัติ (ผอ.) เท่านั้น — ขั้นตรวจของ HR ใช้ /api/hr/reviews/[id]/reject
    if (leave.status !== 'reviewed') {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        'สามารถไม่อนุมัติได้เฉพาะใบลาที่รอ ผอ. อนุมัติเท่านั้น',
        400
      );
    }

    const check = checkTransition('reject', leave.status, session.role, { reason });
    if (!check.ok) {
      const status = check.code === 'FORBIDDEN' ? 403 : 400;
      return errorResponse(
        check.code === 'FORBIDDEN' ? ErrorCodes.FORBIDDEN : ErrorCodes.BAD_REQUEST,
        check.error!,
        status
      );
    }

    // Update leave (conditional on current status to prevent double-reject)
    const updateResult = await prisma.leave.updateMany({
      where: { id: leaveId, status: leave.status },
      data: {
        status: check.toStatus,
        rejectionReason: reason.trim(),
      },
    });

    if (updateResult.count === 0) {
      return errorResponse(ErrorCodes.CONFLICT, 'ใบลานี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า', 409);
    }

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: session.role,
      action: AuditActions.REJECT_LEAVE,
      resource: AuditResources.LEAVES,
      resourceId: leaveId,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        teacherName: `${leave.teacher.firstName} ${leave.teacher.lastName}`,
        rejectionReason: reason.trim(),
        previousStatus: leave.status,
        stage: check.stage,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    after(() =>
      sendPushToTeacher(leave.teacherId, {
        title: 'ใบลาไม่ได้รับการอนุมัติ',
        body: `ใบลาเลขที่ ${leave.leaveNo} - ${leave.teacher.firstName} ${leave.teacher.lastName} ไม่ได้รับการอนุมัติ แตะเพื่อดูรายละเอียด`,
        url: `/teacher/leaves/${leave.id}`,
        tag: `leave-${leave.id}`,
      })
    );

    return NextResponse.json({
      success: true,
      message: 'บันทึกการไม่อนุมัติสำเร็จ',
    });
  } catch (error) {
    console.error('Reject leave error:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'เกิดข้อผิดพลาดในการไม่อนุมัติใบลา',
      500,
      error
    );
  }
}
