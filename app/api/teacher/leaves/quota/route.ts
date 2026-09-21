import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentPeriod } from '@/lib/dateUtils';

/**
 * Get teacher's leave quota usage for current period
 * Shows warning when approaching/exceeding limits
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const currentPeriod = getCurrentPeriod(now);

    // Get settings for quotas
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const quotas = {
      sickPersonal: settings?.quotaSickPersonal || 23,
      maternity: settings?.quotaMaternity || 90,
      religious: settings?.quotaReligious || 120,
    };

    // Get leaves that overlap with current period (including cross-period leaves)
    const leaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
        status: {
          in: ['approved', 'pending'],
        },
        AND: [
          { startDate: { lte: currentPeriod.endDate } },
          { endDate: { gte: currentPeriod.startDate } },
        ],
      },
      select: {
        type: true,
        startDate: true,
        endDate: true,
        daysCalendar: true,
        status: true,
      },
    });

    // Sum by category, counting only days within current period
    let sickPersonalUsed = 0;
    let maternityUsed = 0;
    let religiousUsed = 0;

    for (const leave of leaves) {
      // Calculate days in current period only
      const leaveStart = leave.startDate < currentPeriod.startDate ? currentPeriod.startDate : leave.startDate;
      const leaveEnd = leave.endDate > currentPeriod.endDate ? currentPeriod.endDate : leave.endDate;

      // Calculate days in this period range
      const daysInPeriod = Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // For cross-period leaves, use proportional days
      const daysToCount = leave.startDate >= currentPeriod.startDate && leave.endDate <= currentPeriod.endDate
        ? leave.daysCalendar
        : daysInPeriod;

      if (leave.type === 'sick' || leave.type === 'personal') {
        sickPersonalUsed += daysToCount;
      } else if (leave.type === 'maternity') {
        maternityUsed += daysToCount;
      } else if (leave.type === 'religious') {
        religiousUsed += daysToCount;
      }
    }

    return NextResponse.json({
      period: {
        name: currentPeriod.name,
        startDate: currentPeriod.startDate.toISOString(),
        endDate: currentPeriod.endDate.toISOString(),
      },
      quotas,
      used: {
        sickPersonal: sickPersonalUsed,
        maternity: maternityUsed,
        religious: religiousUsed,
      },
      warnings: {
        sickPersonal: sickPersonalUsed > quotas.sickPersonal,
        maternity: maternityUsed > quotas.maternity,
        religious: religiousUsed > quotas.religious,
      },
    });
  } catch (error) {
    console.error('Get quota error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
