import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

// GET /api/public/heatmap?year=2026&month=9
// Returns: array of { date, count, leaves: [...] }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // Validate
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      );
    }

    const targetDate = new Date(year, month - 1, 1);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    // Get all days in month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all approved leaves that overlap with this month
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
            department: true,
          }
        }
      }
    });

    // Build a map: date string -> leaves on that date
    const leavesByDate = new Map<string, typeof leaves>();

    for (const leave of leaves) {
      const leaveStart = leave.startDate > monthStart ? leave.startDate : monthStart;
      const leaveEnd = leave.endDate < monthEnd ? leave.endDate : monthEnd;

      // Generate all dates in the leave range
      const currentDate = new Date(leaveStart);
      while (currentDate <= leaveEnd) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const existing = leavesByDate.get(dateKey) || [];
        if (!existing.find(l => l.id === leave.id)) {
          existing.push(leave);
        }
        leavesByDate.set(dateKey, existing);

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Build heatmap response
    const heatmapData = daysInMonth.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const leavesOnDay = leavesByDate.get(dateKey) || [];

      return {
        date: dateKey,
        count: leavesOnDay.length,
        leaves: leavesOnDay.map(leave => ({
          id: leave.id,
          firstName: leave.teacher.firstName,
          lastName: leave.teacher.lastName,
          teacherCode: leave.teacher.teacherCode,
          department: leave.teacher.department,
          type: leave.type,
          customTypeName: leave.customTypeName,
          isHalfDay: leave.isHalfDay,
          halfDayPeriod: leave.halfDayPeriod,
        })),
      };
    });

    return NextResponse.json(heatmapData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
