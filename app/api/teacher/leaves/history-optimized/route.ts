import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

/**
 * Optimized history with cursor-based pagination
 * GET /api/teacher/leaves/history-optimized?cursor=<id>&limit=20&status=<status>&type=<type>
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); // ID of last item from previous page
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where: any = {
      teacherId: session.id,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // Cursor-based pagination: much faster than skip/take for large datasets
    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check if there's a next page
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor item itself
      }),
      select: {
        id: true,
        leaveNo: true,
        type: true,
        customTypeName: true,
        startDate: true,
        endDate: true,
        isHalfDay: true,
        halfDayPeriod: true,
        daysWorking: true,
        daysCalendar: true,
        reason: true,
        contactAddress: true,
        status: true,
        rejectionReason: true,
        submittedByType: true,
        submittedByHr: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        createdAt: true,
        approvedAt: true,
      },
    });

    const hasNextPage = leaves.length > limit;
    const items = hasNextPage ? leaves.slice(0, -1) : leaves;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return NextResponse.json({
      leaves: items.map(leave => ({
        ...leave,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        createdAt: leave.createdAt.toISOString(),
        approvedAt: leave.approvedAt?.toISOString(),
      })),
      pagination: {
        limit,
        nextCursor,
        hasNextPage,
      },
    });
  } catch (error) {
    console.error('Get leaves history error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
