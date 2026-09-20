import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export async function GET() {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    const tomorrow = addDays(new Date(), 1);
    const tomorrowStart = startOfDay(tomorrow);
    const tomorrowEnd = endOfDay(tomorrow);

    // Get all leaves tomorrow with full teacher info
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: tomorrowEnd },
        endDate: { gte: tomorrowStart },
      },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            title: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response
    const leavesTomorrow = leaves.map((leave) => ({
      id: leave.id,
      leaveNo: leave.leaveNo,
      teacher: {
        id: leave.teacher.id,
        code: leave.teacher.teacherCode,
        name: `${leave.teacher.title}${leave.teacher.firstName} ${leave.teacher.lastName}`,
        department: leave.teacher.department,
      },
      type: leave.type,
      customTypeName: leave.customTypeName,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      daysWorking: leave.daysWorking,
      daysCalendar: leave.daysCalendar,
      isHalfDay: leave.isHalfDay,
      halfDayPeriod: leave.halfDayPeriod,
      reason: leave.reason,
      contactAddress: leave.contactAddress,
      submittedByType: leave.submittedByType,
      status: leave.status,
    }));

    return NextResponse.json({ leaves: leavesTomorrow });
  } catch (error) {
    console.error('Leaves tomorrow error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
