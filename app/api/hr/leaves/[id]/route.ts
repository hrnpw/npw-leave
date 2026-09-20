import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            title: true,
            firstName: true,
            lastName: true,
            position: true,
            department: true,
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
            mimeType: true,
            blobUrl: true,
            uploadedAt: true,
          },
        },
        leaveDays: {
          orderBy: { date: 'asc' },
          select: {
            date: true,
            isWorkingDay: true,
            isHalfDay: true,
            halfDayPeriod: true,
          },
        },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    return NextResponse.json({
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
        proxyNote: leave.proxyNote,
        teacher: leave.teacher,
        attachments: leave.attachments,
        leaveDays: leave.leaveDays.map((day) => ({
          date: formatDateForAPI(day.date),
          isWorkingDay: day.isWorkingDay,
          isHalfDay: day.isHalfDay,
          halfDayPeriod: day.halfDayPeriod,
        })),
        approverNameSnapshot: leave.approverNameSnapshot,
        approverPositionSnapshot: leave.approverPositionSnapshot,
        directorNameSnapshot: leave.directorNameSnapshot,
        directorPositionSnapshot: leave.directorPositionSnapshot,
        teacherSignatureUrl: leave.teacherSignatureUrl,
        createdAt: leave.createdAt.toISOString(),
        approvedAt: leave.approvedAt?.toISOString(),
        printedAt: leave.printedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch leave details:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
