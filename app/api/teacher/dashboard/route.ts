import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentLeavePeriod } from '@/lib/fiscalYear';
import { getCurrentPeriod } from '@/lib/dateUtils';
import type { LeaveType } from '@/types/leave';

/**
 * GET /api/teacher/dashboard
 * รวมข้อมูลทั้งหมดที่ dashboard ต้องการใน 1 query
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

    // Single query to fetch ALL leaves we need with proper indexes
    const allLeaves = await prisma.leave.findMany({
      where: {
        teacherId,
        OR: [
          // For recent (last 3 leaves, any status)
          { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
          // For stats (approved in current period)
          {
            status: 'approved',
            startDate: { gte: currentPeriod.start, lte: currentPeriod.end },
          },
          // For timeline (pending/approved/rejected in current period)
          {
            status: { in: ['pending', 'approved', 'rejected'] },
            startDate: { gte: period.startDate, lte: period.endDate },
          },
          // For upcoming (approved, starts in next 30 days)
          {
            status: 'approved',
            startDate: { gte: today, lte: futureDate },
          },
        ],
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
        isHalfDay: true,
        halfDayPeriod: true,
        rejectionReason: true,
        createdAt: true,
        leaveDays: {
          select: {
            isHalfDay: true,
            halfDayPeriod: true,
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Process data for each section
    const recentLeaves = allLeaves
      .slice(0, 3)
      .map(leave => ({
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

    // Stats: aggregate approved leaves in current period
    const stats: Record<LeaveType, { count: number; days: number }> = {
      sick: { count: 0, days: 0 },
      personal: { count: 0, days: 0 },
      maternity: { count: 0, days: 0 },
      religious: { count: 0, days: 0 },
      other: { count: 0, days: 0 },
    };

    allLeaves.forEach(leave => {
      if (
        leave.status === 'approved' &&
        leave.startDate >= currentPeriod.start &&
        leave.startDate <= currentPeriod.end
      ) {
        if (stats[leave.type]) {
          stats[leave.type].count++;
          stats[leave.type].days += leave.daysWorking;
        }
      }
    });

    // Timeline: group by month for current period
    const monthlyData: Record<string, any[]> = {};
    let totalDays = 0;
    let totalCount = 0;

    allLeaves.forEach(leave => {
      if (
        ['pending', 'approved', 'rejected'].includes(leave.status) &&
        leave.startDate >= period.startDate &&
        leave.startDate <= period.endDate
      ) {
        const monthKey = leave.startDate.toISOString().substring(0, 7);
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push({
          id: leave.id,
          leaveNo: leave.leaveNo,
          type: leave.type,
          customTypeName: leave.customTypeName,
          status: leave.status,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          daysWorking: leave.daysWorking,
          isHalfDay: leave.isHalfDay,
          halfDayPeriod: leave.halfDayPeriod,
        });

        if (leave.status === 'approved') {
          totalDays += leave.daysWorking;
          totalCount += 1;
        }
      }
    });

    // Upcoming: approved leaves starting in next 30 days
    const upcomingLeaves = allLeaves
      .filter(
        leave =>
          leave.status === 'approved' &&
          leave.startDate >= today &&
          leave.startDate <= futureDate
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 5)
      .map(leave => ({
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        status: leave.status,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        daysWorking: leave.daysWorking,
        isHalfDay: leave.leaveDays[0]?.isHalfDay || false,
        halfDayPeriod: leave.leaveDays[0]?.halfDayPeriod || null,
      }));

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
          monthlyData,
          periodLabel,
          fiscalYear,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          stats: { totalDays, totalCount },
        },
        upcoming: { leaves: upcomingLeaves },
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Get teacher dashboard error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
