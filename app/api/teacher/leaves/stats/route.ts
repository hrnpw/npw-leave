import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentLeavePeriod } from '@/lib/fiscalYear';
import type { LeaveType } from '@/types/leave';

export async function GET() {
  try {
    const session = await getTeacherSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    const currentPeriod = getCurrentLeavePeriod();

    // Get all approved leaves in current period
    const leaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
        status: 'approved',
        startDate: {
          gte: currentPeriod.start,
          lte: currentPeriod.end,
        },
      },
      select: {
        type: true,
        daysWorking: true,
      },
    });

    // Calculate stats by type
    const stats: Record<LeaveType, { count: number; days: number }> = {
      sick: { count: 0, days: 0 },
      personal: { count: 0, days: 0 },
      maternity: { count: 0, days: 0 },
      religious: { count: 0, days: 0 },
      other: { count: 0, days: 0 },
    };

    leaves.forEach((leave) => {
      if (stats[leave.type]) {
        stats[leave.type].count++;
        stats[leave.type].days += leave.daysWorking;
      }
    });

    return NextResponse.json({
      stats,
      periodName: currentPeriod.name,
      periodStart: currentPeriod.start.toISOString(),
      periodEnd: currentPeriod.end.toISOString(),
    });
  } catch (error) {
    console.error('Get leave stats error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
