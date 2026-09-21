import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';
import type { LeaveStatus, LeaveType } from '@/types/leave';
import { getFiscalRoundDateRange } from '@/lib/fiscalYear';

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as LeaveStatus | 'all' || 'all';
    const type = searchParams.get('type') as LeaveType | 'all' || 'all';
    const submittedBy = searchParams.get('submittedBy') as 'teacher' | 'hr' | 'all' || 'all';
    const department = searchParams.get('department') || '';
    const fiscalYear = searchParams.get('fiscalYear');
    const round = searchParams.get('round') as '1' | '2' | 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Search by teacher name, teacher code, or leave number
    if (search) {
      where.OR = [
        { leaveNo: { contains: search, mode: 'insensitive' } },
        { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
        { teacher: { lastName: { contains: search, mode: 'insensitive' } } },
        { teacher: { teacherCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Filter by status
    if (status !== 'all') {
      where.status = status;
    }

    // Filter by type
    if (type !== 'all') {
      where.type = type;
    }

    // Filter by submitted by
    if (submittedBy !== 'all') {
      where.submittedByType = submittedBy;
    }

    // Filter by department
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

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case 'startDate':
        orderBy = { startDate: sortOrder };
        break;
      case 'teacherName':
        orderBy = { teacher: { firstName: sortOrder } };
        break;
      case 'department':
        orderBy = { teacher: { department: sortOrder } };
        break;
      case 'daysWorking':
        orderBy = { daysWorking: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        select: {
          id: true,
          leaveNo: true,
          fiscalYear: true,
          round: true,
          type: true,
          customTypeName: true,
          startDate: true,
          endDate: true,
          isHalfDay: true,
          halfDayPeriod: true,
          status: true,
          reason: true,
          contactAddress: true,
          rejectionReason: true,
          daysWorking: true,
          daysCalendar: true,
          submittedByType: true,
          approvedAt: true,
          printedAt: true,
          createdAt: true,
          updatedAt: true,
          teacher: {
            select: {
              teacherCode: true,
              title: true,
              firstName: true,
              lastName: true,
              position: true,
              department: true,
            },
          },
          submittedByHr: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.leave.count({ where }),    
    ]);

    return NextResponse.json({
      leaves: leaves.map((leave) => ({
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        customTypeName: leave.customTypeName,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
        daysWorking: leave.daysWorking,
        daysCalendar: leave.daysCalendar,
        reason: leave.reason,
        contactAddress: leave.contactAddress,
        status: leave.status,
        rejectionReason: leave.rejectionReason,
        submittedByType: leave.submittedByType,
        submittedByHr: leave.submittedByHr,
        teacher: leave.teacher,
        attachments: leave.attachments,
        createdAt: leave.createdAt.toISOString(),
        approvedAt: leave.approvedAt?.toISOString(),
        printedAt: leave.printedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch leaves:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
