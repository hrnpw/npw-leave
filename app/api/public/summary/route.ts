import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Enable ISR with 60 seconds revalidation
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
 * GET /api/public/summary
 * Fast endpoint for above-the-fold data only
 */
export async function GET() {
  try {
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

    // Parallel queries - only essential data
    const [
      totalTeachers,
      todayHoliday,
      tomorrowHoliday,
      leavesToday,
      leavesTomorrow,
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
      prisma.leave.count({
        where: {
          status: 'approved',
          startDate: { lte: tomorrowEnd },
          endDate: { gte: tomorrowStart },
        },
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

    return NextResponse.json(
      {
        date: nowUTC.toISOString(),
        totalTeachers,
        attendingToday,
        leavesToday: leavesToday.length,
        leavesTomorrow,
        todayHoliday: todayHoliday?.name || null,
        tomorrowHoliday: tomorrowHoliday?.name || null,
        leavesByType: leavesGrouped,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Public summary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
