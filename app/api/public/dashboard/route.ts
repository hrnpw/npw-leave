import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

// Mark as dynamic route to prevent static generation errors
export const dynamic = 'force-dynamic';
// Cache for 60 seconds
export const revalidate = 60;

interface LeaveTypeCount {
  type: string;
  customTypeName?: string;
  count: number;
  teachers: {
    id: string;
    firstName: string;
    lastName: string;
    teacherCode: string;
    department: string | null;
    isHalfDay: boolean;
    halfDayPeriod?: 'morning' | 'afternoon';
  }[];
}

/**
 * GET /api/public/dashboard?year=2026&month=9
 * รวม summary + heatmap + holidays ใน 1 API call
 */
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

    // Get current date in Thailand timezone
    const nowUTC = new Date();
    const nowThailand = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    const todayYear = nowThailand.getFullYear();
    const todayMonth = nowThailand.getMonth();
    const todayDate = nowThailand.getDate();

    const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    const tomorrowStart = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 0, 0, 0, 0));
    const tomorrowEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 23, 59, 59, 999));

    // Calculate heatmap date range
    const targetDate = new Date(year, month - 1, 1);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Parallel queries for better performance
    const [
      totalTeachers,
      todayHoliday,
      tomorrowHoliday,
      leavesToday,
      leavesTomorrow,
      heatmapLeaveDays,
      holidays
    ] = await Promise.all([
      // 1. Total active teachers
      prisma.teacher.count({
        where: { isActive: true },
      }),

      // 2. Today's holiday
      prisma.holiday.findUnique({
        where: { date: todayStart },
        select: { name: true },
      }),

      // 3. Tomorrow's holiday
      prisma.holiday.findUnique({
        where: { date: tomorrowStart },
        select: { name: true },
      }),

      // 4. Leaves for today
      prisma.leave.findMany({
        where: {
          status: 'approved',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
        select: {
          id: true,
          type: true,
          customTypeName: true,
          isHalfDay: true,
          halfDayPeriod: true,
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
      }),

      // 5. Leaves for tomorrow (just count)
      prisma.leave.findMany({
        where: {
          status: 'approved',
          startDate: { lte: tomorrowEnd },
          endDate: { gte: tomorrowStart },
        },
        select: {
          id: true,
        },
      }),

      // 6. Heatmap data - get approved leaves in the month with their days
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

    // Process summary data
    const fullDayLeavesToday = leavesToday.filter(leave => !leave.isHalfDay);
    const attendingToday = totalTeachers - fullDayLeavesToday.length;

    // Group leaves by type for today
    const leavesByType: Record<string, LeaveTypeCount> = {};

    leavesToday.forEach(leave => {
      const key = leave.type === 'other' && leave.customTypeName
        ? `other_${leave.customTypeName}`
        : leave.type;

      if (!leavesByType[key]) {
        leavesByType[key] = {
          type: leave.type,
          customTypeName: leave.customTypeName || undefined,
          count: 0,
          teachers: [],
        };
      }

      leavesByType[key].count++;
      leavesByType[key].teachers.push({
        id: leave.teacher.id,
        firstName: leave.teacher.firstName,
        lastName: leave.teacher.lastName,
        teacherCode: leave.teacher.teacherCode,
        department: leave.teacher.department,
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod || undefined,
      });
    });

    const leavesGrouped = Object.values(leavesByType).sort((a, b) => b.count - a.count);

    // Process heatmap data - now working with leaves instead of leaveDays
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
        summary: {
          date: nowUTC.toISOString(),
          totalTeachers,
          attendingToday,
          leavesToday: leavesToday.length,
          leavesTomorrow: leavesTomorrow.length,
          todayHoliday: todayHoliday?.name || null,
          tomorrowHoliday: tomorrowHoliday?.name || null,
          leavesByType: leavesGrouped,
        },
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
