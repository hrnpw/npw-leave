import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTeacherSession();
    const { id } = await params;

    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch leave with all details
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            firstName: true,
            lastName: true,
          },
        },
        submittedByHr: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            blobUrl: true,
          },
        },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Check ownership - only allow teacher to view their own leaves
    if (leave.teacherId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Format response
    const response = {
      leave: {
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        reason: leave.reason,
        contactAddress: leave.contactAddress,
        contactPhone: leave.contactPhone,
        status: leave.status,
        rejectionReason: leave.rejectionReason,
        submittedByType: leave.submittedByType,
        submittedByHr: leave.submittedByHr,
        proxyReason: leave.proxyReason,
        teacher: leave.teacher,
        attachments: leave.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          fileUrl: att.blobUrl,
        })),
        createdAt: leave.createdAt.toISOString(),
        approvedAt: leave.approvedAt?.toISOString() || null,
        printedAt: leave.printedAt?.toISOString() || null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get leave error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
