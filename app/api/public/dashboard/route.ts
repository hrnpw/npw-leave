import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

// Enable ISR with 60 seconds revalidation
export const revalidate = 60;
export const dynamic = 'force-static';
export const dynamicParams = true;

/**
 * GET /api/public/dashboard?year=2026&month=9
 * Heatmap + holidays only (for calendar view)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // Validate
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      );
    }

    // Calculate heatmap date range
    const targetDate = new Date(year, month - 1, 1);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Parallel queries - only heatmap and holidays
    const [heatmapLeaveDays, holidays] = await Promise.all([
      // 1. Heatmap data - get approved leaves in the month with their days
      prisma.leave.findMany({
        where: {
          status: 'approved',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: {
          id: true,
          type: true,
          customTypeName: true,
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              teacherCode: true,
              department: true,
            },
          },
          leaveDays: {
            where: {
              date: { gte: monthStart, lte: monthEnd },
            },
            select: {
              date: true,
              isHalfDay: true,
              halfDayPeriod: true,
            },
          },
        },
      }),

      // 7. Holidays for the requested month
      prisma.holiday.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        select: {
          date: true,
          name: true,
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Process heatmap data - working with leaves and their days
    const leavesByDate = new Map<string, Array<{
      id: string;
      firstName: string;
      lastName: string;
      teacherCode: string;
      department: string | null;
      type: string;
      customTypeName: string | null;
      isHalfDay: boolean;
      halfDayPeriod?: string;
    }>>();

    // Flatten leaves and their days
    for (const leave of heatmapLeaveDays) {
      for (const leaveDay of leave.leaveDays) {
        const dateKey = format(leaveDay.date, 'yyyy-MM-dd');
        const existing = leavesByDate.get(dateKey) || [];

        existing.push({
          id: leave.id,
          firstName: leave.teacher.firstName,
          lastName: leave.teacher.lastName,
          teacherCode: leave.teacher.teacherCode,
          department: leave.teacher.department,
          type: leave.type,
          customTypeName: leave.customTypeName,
          isHalfDay: leaveDay.isHalfDay,
          halfDayPeriod: leaveDay.halfDayPeriod || undefined,
        });

        leavesByDate.set(dateKey, existing);
      }
    }

    const heatmapData = daysInMonth.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const leavesOnDay = leavesByDate.get(dateKey) || [];

      return {
        date: dateKey,
        count: leavesOnDay.length,
        leaves: leavesOnDay,
      };
    });

    // Format holidays
    const holidaysFormatted = holidays.map(h => ({
      date: format(h.date, 'yyyy-MM-dd'),
      name: h.name,
    }));

    return NextResponse.json(
      {
        heatmap: heatmapData,
        holidays: holidaysFormatted,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Public dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
