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

    // Use single groupBy query instead of 8 separate counts
    const allLeaves = await prisma.leave.findMany({
      where,
      select: {
        status: true,
        type: true,
      },
    });

    // Calculate counts in memory (faster than 8 DB queries)
    let pending = 0, approved = 0, rejected = 0;
    let sick = 0, personal = 0, maternity = 0, religious = 0, other = 0;

    for (const leave of allLeaves) {
      // Count by status
      if (leave.status === 'pending') pending++;
      else if (leave.status === 'approved') approved++;
      else if (leave.status === 'rejected') rejected++;

      // Count by type
      if (leave.type === 'sick') sick++;
      else if (leave.type === 'personal') personal++;
      else if (leave.type === 'maternity') maternity++;
      else if (leave.type === 'religious') religious++;
      else if (leave.type === 'other') other++;
    }

    return NextResponse.json({
      byStatus: {
        pending,
        approved,
        rejected,
        total: allLeaves.length,
      },
      byType: {
        sick,
        personal,
        maternity,
        religious,
        other,
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
