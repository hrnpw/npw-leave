import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { formatDateForAPI } from '@/lib/dateFormat';

export async function GET(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const skip = (page - 1) * limit;

    const where: any = {
      teacherId: session.id,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
      prisma.leave.count({ where }),
    ]);

    return NextResponse.json({
      leaves: leaves.map(leave => ({
        ...leave,
        startDate: formatDateForAPI(leave.startDate),
        endDate: formatDateForAPI(leave.endDate),
        createdAt: leave.createdAt.toISOString(),
        approvedAt: leave.approvedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
