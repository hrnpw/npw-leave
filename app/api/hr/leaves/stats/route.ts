import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import type { LeaveStatus, LeaveType } from '@/types/leave';
import { getFiscalRoundDateRange } from '@/lib/fiscalYear';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as LeaveStatus | 'all' || 'all';
    const type = searchParams.get('type') as LeaveType | 'all' || 'all';
    const submittedBy = searchParams.get('submittedBy') as 'teacher' | 'hr' | 'all' || 'all';
    const department = searchParams.get('department') || '';
    const fiscalYear = searchParams.get('fiscalYear');
    const round = searchParams.get('round') as '1' | '2' | 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause (same as main leaves route)
    const where: any = {};

    if (search) {
      where.OR = [
        { leaveNo: { contains: search, mode: 'insensitive' } },
        { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
        { teacher: { lastName: { contains: search, mode: 'insensitive' } } },
        { teacher: { teacherCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status !== 'all') {
      where.status = status;
    }

    if (type !== 'all') {
      where.type = type;
    }

    if (submittedBy !== 'all') {
      where.submittedByType = submittedBy;
    }

    if (department) {
      where.teacher = {
        ...where.teacher,
        department: { contains: department, mode: 'insensitive' },
      };
    }

    // Filter by fiscal year and round (takes precedence over manual date range)
    if (fiscalYear && round && round !== 'all') {
      const fiscalYearNum = parseInt(fiscalYear, 10);
      const roundNum = parseInt(round, 10) as 1 | 2;
      const { start, end } = getFiscalRoundDateRange(fiscalYearNum, roundNum);

      where.startDate = {
        gte: start,
        lte: end,
      };
    } else if (fiscalYear) {
      // If only fiscal year is selected (round = 'all'), filter both rounds
      const fiscalYearNum = parseInt(fiscalYear, 10);
      const round1 = getFiscalRoundDateRange(fiscalYearNum, 1);
      const round2 = getFiscalRoundDateRange(fiscalYearNum, 2);

      where.startDate = {
        gte: round1.start,
        lte: round2.end,
      };
    } else if (startDate || endDate) {
      // Manual date range filter (only if fiscal year not set)
      where.startDate = {};
      if (startDate) {
        where.startDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate);
      }
    }

    const [statusGroups, typeGroups] = await Promise.all([
      prisma.leave.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.leave.groupBy({ by: ['type'], where, _count: { _all: true } }),
    ]);

    const statusCount = (s: string) =>
      statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const typeCount = (t: string) =>
      typeGroups.find((g) => g.type === t)?._count._all ?? 0;

    return NextResponse.json({
      byStatus: {
        pending: statusCount('pending'),
        reviewed: statusCount('reviewed'),
        approved: statusCount('approved'),
        rejected: statusCount('rejected'),
        total: statusGroups.reduce((sum, g) => sum + g._count._all, 0),
      },
      byType: {
        sick: typeCount('sick'),
        personal: typeCount('personal'),
        maternity: typeCount('maternity'),
        religious: typeCount('religious'),
        other: typeCount('other'),
      },
    });
  } catch (error) {
    console.error('Failed to fetch leave stats:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงสถิติ' },
      { status: 500 }
    );
  }
}
