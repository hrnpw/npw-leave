import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentLeavePeriod } from '@/lib/fiscalYear';
import { getCurrentPeriod } from '@/lib/dateUtils';
import type { LeaveType } from '@/types/leave';

/**
 * GET /api/teacher/dashboard
 * Optimized: แยก queries เป็น parallel requests และลด data ที่ดึง
 */
export async function GET() {
  try {
    const session = await getTeacherSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    const teacherId = session.id;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Calculate date ranges
    const currentPeriod = getCurrentLeavePeriod();
    const period = getCurrentPeriod(now);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);

    // Determine period label and fiscal year
    const month = now.getMonth();
    const year = now.getFullYear();
    const thaiYear = year + 543;

    let periodLabel: string;
    let fiscalYear: number;

    if (month >= 3 && month <= 8) {
      periodLabel = 'รอบ 1';
      fiscalYear = thaiYear;
    } else if (month >= 9) {
      periodLabel = 'รอบ 2';
      fiscalYear = thaiYear + 1;
    } else {
      periodLabel = 'รอบ 2';
      fiscalYear = thaiYear;
    }

    // OPTIMIZATION: แยก queries ออกเป็น parallel requests แทนที่จะใช้ OR ที่ซับซ้อน
    const [recentLeavesData, statsData, upcomingLeavesData] = await Promise.all([
      // Query 1: Recent leaves (เร็วที่สุด - limit 3)
      prisma.leave.findMany({
        where: { teacherId },
        select: {
          id: true,
          leaveNo: true,
          type: true,
          customTypeName: true,
          status: true,
          startDate: true,
          endDate: true,
          daysWorking: true,
          rejectionReason: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),

      // Query 2: Stats - เฉพาะ approved ใน current period
      prisma.leave.findMany({
        where: {
          teacherId,
          status: 'approved',
          startDate: { gte: currentPeriod.start, lte: currentPeriod.end },
        },
        select: {
          type: true,
          daysWorking: true,
        },
      }),

      // Query 3: Upcoming leaves - เฉพาะที่กำลังจะมา
      prisma.leave.findMany({
        where: {
          teacherId,
          status: 'approved',
          startDate: { gte: today, lte: futureDate },
        },
        select: {
          id: true,
          leaveNo: true,
          type: true,
          customTypeName: true,
          status: true,
          startDate: true,
          endDate: true,
          daysWorking: true,
        },
        orderBy: { startDate: 'asc' },
        take: 5,
      }),
    ]);

    // Process recent leaves
    const recentLeaves = recentLeavesData.map(leave => ({
      id: leave.id,
      leaveNo: leave.leaveNo,
      type: leave.type,
      customTypeName: leave.customTypeName,
      status: leave.status,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      daysWorking: leave.daysWorking,
      rejectionReason: leave.rejectionReason,
      createdAt: leave.createdAt.toISOString(),
    }));

    // Process stats
    const stats: Record<LeaveType, { count: number; days: number }> = {
      sick: { count: 0, days: 0 },
      personal: { count: 0, days: 0 },
      maternity: { count: 0, days: 0 },
      religious: { count: 0, days: 0 },
      other: { count: 0, days: 0 },
    };

    statsData.forEach(leave => {
      if (stats[leave.type]) {
        stats[leave.type].count++;
        stats[leave.type].days += leave.daysWorking;
      }
    });

    // Fetch leaveDays only for upcoming leaves
    const upcomingLeaveIds = upcomingLeavesData.map(l => l.id);
    const leaveDaysForUpcoming = upcomingLeaveIds.length > 0
      ? await prisma.leaveDay.findMany({
          where: { leaveId: { in: upcomingLeaveIds } },
          select: {
            leaveId: true,
            isHalfDay: true,
            halfDayPeriod: true,
          },
          distinct: ['leaveId'],
        })
      : [];

    const leaveDaysMap = new Map(
      leaveDaysForUpcoming.map(ld => [ld.leaveId, ld])
    );

    // Process upcoming leaves
    const upcomingLeaves = upcomingLeavesData.map(leave => {
      const leaveDay = leaveDaysMap.get(leave.id);
      return {
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        status: leave.status,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        daysWorking: leave.daysWorking,
        isHalfDay: leaveDay?.isHalfDay || false,
        halfDayPeriod: leaveDay?.halfDayPeriod || null,
      };
    });

    // Timeline data - ย้ายไปเป็น separate API endpoint แทน
    // เพื่อให้ dashboard โหลดเร็วขึ้น

    return NextResponse.json(
      {
        recent: { leaves: recentLeaves },
        stats: {
          stats,
          periodName: currentPeriod.name,
          periodStart: currentPeriod.start.toISOString(),
          periodEnd: currentPeriod.end.toISOString(),
        },
        timeline: {
          monthlyData: {},
          periodLabel,
          fiscalYear,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          stats: { totalDays: 0, totalCount: 0 },
        },
        upcoming: { leaves: upcomingLeaves },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30', // Cache 30 วินาที
        },
      }
    );
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
