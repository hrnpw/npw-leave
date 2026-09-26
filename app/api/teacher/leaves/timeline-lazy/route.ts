import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentPeriod } from '@/lib/dateUtils';

/**
 * GET /api/teacher/leaves/timeline-lazy
 * Lazy load timeline data แยกจาก dashboard
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
    const period = getCurrentPeriod(now);

    // Query เฉพาะ timeline data
    const timelineLeaves = await prisma.leave.findMany({
      where: {
        teacherId,
        status: { in: ['pending', 'approved', 'rejected'] },
        startDate: { gte: period.startDate, lte: period.endDate },
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
      },
      orderBy: { startDate: 'desc' },
    });

    // Group by month
    const monthlyData: Record<string, any[]> = {};
    let totalDays = 0;
    let totalCount = 0;

    timelineLeaves.forEach(leave => {
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
    });

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

    return NextResponse.json(
      {
        monthlyData,
        periodLabel,
        fiscalYear,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        stats: { totalDays, totalCount },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60', // Cache 1 นาที
        },
      }
    );
  } catch (error) {
    console.error('[Timeline API] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
