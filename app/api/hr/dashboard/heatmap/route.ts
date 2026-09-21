import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) - 1 : now.getMonth();

    const targetDate = new Date(year, month, 1);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    // Get all days in month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all approved leaves in this month
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
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
    });

    // Count leaves per day
    const heatmapData = daysInMonth.map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const leavesOnDay = leaves.filter((leave) => {
        return leave.startDate <= dayEnd && leave.endDate >= dayStart;
      });

      return {
        date: format(day, 'yyyy-MM-dd'),
        count: leavesOnDay.length,
        leaves: leavesOnDay.map((leave) => ({
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
          isHalfDay: leave.isHalfDay,
          halfDayPeriod: leave.halfDayPeriod,
        })),
      };
    });

    return NextResponse.json({
      year,
      month: month + 1,
      heatmap: heatmapData,
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
