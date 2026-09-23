import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';

export const revalidate = 60; // Cache 1 minute

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

    // Get current date in Thailand timezone (UTC+7)
    const nowUTC = new Date();
    const nowThailand = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    const todayYear = nowThailand.getFullYear();
    const todayMonth = nowThailand.getMonth();
    const todayDate = nowThailand.getDate();

    const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    const tomorrowStart = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 0, 0, 0, 0));
    const tomorrowEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 23, 59, 59, 999));

    // Execute all queries in parallel
    const [
      totalTeachers,
      leavesTodayFull,
      leavesTodayAll,
      leavesTomorrow,
      pendingCount,
      settings,
      leavesToday,
      leaveDays,
    ] = await Promise.all([
      // Summary queries
      prisma.teacher.count({
        where: { isActive: true },
      }),
      prisma.leave.count({
        where: {
          status: 'approved',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          isHalfDay: false,
        },
      }),
      prisma.leave.count({
        where: {
          status: 'approved',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
      }),
      prisma.leave.count({
        where: {
          status: 'approved',
          startDate: { lte: tomorrowEnd },
          endDate: { gte: tomorrowStart },
        },
      }),
      prisma.leave.count({
        where: { status: 'pending' },
      }),
      prisma.settings.findUnique({
        where: { id: 'singleton' },
        select: { quotaSickPersonal: true, systemStartDate: true },
      }),

      // Leaves today with full info
      prisma.leave.findMany({
        where: {
          status: 'approved',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
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
      }),

      // Heatmap data
      prisma.leaveDay.findMany({
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
      }),
    ]);

    // Calculate exceeding count
    const quotaSickPersonal = settings?.quotaSickPersonal || 23;
    const systemStartDate = settings?.systemStartDate || new Date('2026-09-07');

    const exceedingTeachers = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "teacher_id") as count
      FROM (
        SELECT "teacher_id", SUM("days_calendar") as total
        FROM "leaves"
        WHERE "status" = 'approved'
          AND "type" IN ('sick', 'personal')
          AND "created_at" >= ${systemStartDate}
        GROUP BY "teacher_id"
        HAVING SUM("days_calendar") > ${quotaSickPersonal}
      ) AS exceeding
    `;

    const exceedingCount = Number(exceedingTeachers[0]?.count || 0);
    const attendingToday = totalTeachers - leavesTodayFull;

    // Format summary
    const summary = {
      totalTeachers,
      attendingToday,
      leavesToday: leavesTodayAll,
      leavesTomorrow,
      pendingCount,
      exceedingCount,
    };

    // Format leaves today
    const leavesTodayFormatted = leavesToday.map((leave) => ({
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
    }));

    // Build heatmap
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leavesByDate = new Map<string, typeof leaveDays>();

    for (const leaveDay of leaveDays) {
      const dateKey = format(leaveDay.date, 'yyyy-MM-dd');
      const existing = leavesByDate.get(dateKey) || [];
      existing.push(leaveDay);
      leavesByDate.set(dateKey, existing);
    }

    const heatmapData = daysInMonth.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const leaveDaysOnDay = leavesByDate.get(dateKey) || [];

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

    return NextResponse.json(
      {
        summary,
        leavesToday: leavesTodayFormatted,
        heatmap: {
          year,
          month: month + 1,
          heatmap: heatmapData,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('HR dashboard all error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
