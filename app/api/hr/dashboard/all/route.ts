import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

export async function GET(request: Request) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

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

    // Execute only essential queries in parallel (removed heatmap - it's lazy loaded separately)
    const [
      totalTeachers,
      leavesTodayFull,
      leavesTodayAll,
      leavesTomorrow,
      pendingCount,
      settings,
      leavesToday,
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
        select: {
          id: true,
          leaveNo: true,
          type: true,
          customTypeName: true,
          startDate: true,
          endDate: true,
          daysWorking: true,
          daysCalendar: true,
          isHalfDay: true,
          halfDayPeriod: true,
          reason: true,
          contactAddress: true,
          submittedByType: true,
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
    ]);

    // Calculate exceeding count (optimized with indexed query)
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

    return NextResponse.json(
      {
        summary,
        leavesToday: leavesTodayFormatted,
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
