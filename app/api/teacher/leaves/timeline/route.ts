import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentPeriod } from '@/lib/dateUtils';

export async function GET() {
  try {
    const session = await getTeacherSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    // Get current period
    const now = new Date();
    const period = getCurrentPeriod(now);
    const { startDate, endDate } = period;

    // Determine period label and fiscal year
    const month = now.getMonth(); // 0-indexed
    const year = now.getFullYear();
    const thaiYear = year + 543;

    let periodLabel: string;
    let fiscalYear: number;

    if (month >= 3 && month <= 8) {
      // Period 1 (Apr-Sep): รอบ 1
      periodLabel = 'รอบ 1';
      fiscalYear = thaiYear;
    } else if (month >= 9) {
      // Period 2 (Oct-Dec): รอบ 2
      periodLabel = 'รอบ 2';
      fiscalYear = thaiYear + 1;
    } else {
      // Period 2 (Jan-Mar): รอบ 2
      periodLabel = 'รอบ 2';
      fiscalYear = thaiYear;
    }

    // Get all leaves in current period (all statuses except cancelled)
    const leaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
        status: {
          in: ['pending', 'approved', 'rejected'],
        },
        startDate: {
          gte: startDate,
          lte: endDate,
        },
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
      orderBy: {
        startDate: 'desc', // ใหม่สุดก่อน
      },
    });

    // Group by month
    const monthlyData: Record<string, any[]> = {};
    let totalDays = 0;
    let totalCount = 0;

    leaves.forEach((leave) => {
      const monthKey = leave.startDate.toISOString().substring(0, 7); // YYYY-MM
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

      // Count only approved leaves for stats
      if (leave.status === 'approved') {
        totalDays += leave.daysWorking;
        totalCount += 1;
      }
    });

    return NextResponse.json({
      monthlyData,
      periodLabel,
      fiscalYear,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats: {
        totalDays,
        totalCount,
      },
    });
  } catch (error) {
    console.error('Get leave timeline error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
