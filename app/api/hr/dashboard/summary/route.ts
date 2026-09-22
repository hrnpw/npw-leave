import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { shortCacheHeaders } from '@/lib/cacheHeaders';

export async function GET() {
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

    // Create UTC dates for today and tomorrow (midnight UTC, representing the calendar day)
    const todayYear = nowThailand.getFullYear();
    const todayMonth = nowThailand.getMonth();
    const todayDate = nowThailand.getDate();

    const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    const tomorrowStart = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 0, 0, 0, 0));
    const tomorrowEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1, 23, 59, 59, 999));

    // Total active teachers
    const totalTeachers = await prisma.teacher.count({
      where: { isActive: true },
    });

    // Leaves today (full day only for attendance calculation)
    const leavesTodayFull = await prisma.leave.count({
      where: {
        status: 'approved',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
        isHalfDay: false,
      },
    });

    // All leaves today (including half day)
    const leavesTodayAll = await prisma.leave.count({
      where: {
        status: 'approved',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
    });

    // Leaves tomorrow
    const leavesTomorrow = await prisma.leave.count({
      where: {
        status: 'approved',
        startDate: { lte: tomorrowEnd },
        endDate: { gte: tomorrowStart },
      },
    });

    // Pending leaves
    const pendingCount = await prisma.leave.count({
      where: { status: 'pending' },
    });

    // Leaves exceeding quota (sick + personal > 23)
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { quotaSickPersonal: true, systemStartDate: true },
    });

    const quotaSickPersonal = settings?.quotaSickPersonal || 23;
    const systemStartDate = settings?.systemStartDate || new Date('2026-09-07');

    // Count teachers exceeding quota using SQL aggregation
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

    return NextResponse.json({
      totalTeachers,
      attendingToday,
      leavesToday: leavesTodayAll,
      leavesTomorrow,
      pendingCount,
      exceedingCount,
    }, {
      headers: shortCacheHeaders,
    });
  } catch (error) {
    console.error('HR dashboard summary error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
