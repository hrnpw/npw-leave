import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCodes } from '@/lib/apiResponse';
import { createAuditLog, AuditActions, AuditResources } from '@/lib/auditLog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'ไม่ได้รับอนุญาต', 401);
    }

    const { reason } = await request.json();

    if (!reason || reason.trim().length < 10) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร',
        400
      );
    }

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

    if (leave.status !== 'pending') {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        'สามารถไม่อนุมัติได้เฉพาะใบลาที่รออนุมัติเท่านั้น',
        400
      );
    }

    // Update leave
    await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: 'rejected',
        rejectionReason: reason.trim(),
      },
    });

    // Audit log
    await createAuditLog({
      userId: session.id,
      userType: 'hr',
      action: AuditActions.REJECT_LEAVE,
      resource: AuditResources.LEAVES,
      resourceId: leaveId,
      details: {
        leaveNo: leave.leaveNo,
        teacherId: leave.teacherId,
        teacherName: `${leave.teacher.firstName} ${leave.teacher.lastName}`,
        rejectionReason: reason.trim(),
        previousStatus: leave.status,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

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
