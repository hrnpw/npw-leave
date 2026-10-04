import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { noCacheHeaders } from '@/lib/cacheHeaders';

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
      leavesTomorrow,
      queueCounts,
      leavesToday,
    ] = await Promise.all([
      // Summary queries
      prisma.teacher.count({
        where: { isActive: true },
      }),
      prisma.leave.count({
        where: {
          status: { in: ['reviewed', 'approved'] },
          startDate: { lte: tomorrowEnd },
          endDate: { gte: tomorrowStart },
          teacher: { isActive: true },
        },
      }),
      prisma.leave.groupBy({
        by: ['status'],
        where: { status: { in: ['pending', 'reviewed'] } },
        _count: { _all: true },
      }),

      // Leaves today with full info
      prisma.leave.findMany({
        where: {
          status: { in: ['reviewed', 'approved'] },
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          teacher: { isActive: true },
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
          status: true,
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

    const pendingCount = queueCounts.find((c) => c.status === 'pending')?._count._all ?? 0;
    const reviewedCount = queueCounts.find((c) => c.status === 'reviewed')?._count._all ?? 0;
    const leavesTodayFull = leavesToday.filter((leave) => !leave.isHalfDay).length;
    const attendingToday = totalTeachers - leavesTodayFull;

    // Format summary
    const summary = {
      totalTeachers,
      attendingToday,
      leavesToday: leavesToday.length,
      leavesTomorrow,
      pendingCount,
      reviewedCount,
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
      status: leave.status,
    }));

    return NextResponse.json(
      {
        summary,
        leavesToday: leavesTodayFormatted,
      },
      { headers: noCacheHeaders }
    );
  } catch (error) {
    console.error('HR dashboard all error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
