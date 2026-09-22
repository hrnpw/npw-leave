import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { shortCacheHeaders } from '@/lib/cacheHeaders';

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

    // Get leave days in this month with leave and teacher info (single query with joins)
    const leaveDays = await prisma.leaveDay.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        leave: { status: 'approved' },
      },
      include: {
        leave: {
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
        },
      },
    });

    // Build a map: date string -> leaves on that date
    const leavesByDate = new Map<string, typeof leaveDays>();

    for (const leaveDay of leaveDays) {
      const dateKey = format(leaveDay.date, 'yyyy-MM-dd');
      const existing = leavesByDate.get(dateKey) || [];
      existing.push(leaveDay);
      leavesByDate.set(dateKey, existing);
    }

    // Build heatmap response
    const heatmapData = daysInMonth.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const leaveDaysOnDay = leavesByDate.get(dateKey) || [];

      // Group by leave to avoid duplicates (one leave can have multiple days)
      const uniqueLeaves = new Map();
      for (const leaveDay of leaveDaysOnDay) {
        if (!uniqueLeaves.has(leaveDay.leave.id)) {
          uniqueLeaves.set(leaveDay.leave.id, {
            id: leaveDay.leave.id,
            leaveNo: leaveDay.leave.leaveNo,
            teacher: {
              id: leaveDay.leave.teacher.id,
              code: leaveDay.leave.teacher.teacherCode,
              name: `${leaveDay.leave.teacher.title}${leaveDay.leave.teacher.firstName} ${leaveDay.leave.teacher.lastName}`,
              department: leaveDay.leave.teacher.department,
            },
            type: leaveDay.leave.type,
            customTypeName: leaveDay.leave.customTypeName,
            isHalfDay: leaveDay.isHalfDay,
            halfDayPeriod: leaveDay.halfDayPeriod,
          });
        }
      }

      return {
        date: dateKey,
        count: uniqueLeaves.size,
        leaves: Array.from(uniqueLeaves.values()),
      };
    });

    return NextResponse.json({
      year,
      month: month + 1,
      heatmap: heatmapData,
    }, {
      headers: shortCacheHeaders,
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
