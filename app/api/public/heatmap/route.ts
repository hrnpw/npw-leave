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
                firstName: true,
                lastName: true,
                teacherCode: true,
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
            firstName: leaveDay.leave.teacher.firstName,
            lastName: leaveDay.leave.teacher.lastName,
            teacherCode: leaveDay.leave.teacher.teacherCode,
            department: leaveDay.leave.teacher.department,
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
