import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { LeaveType, HalfDayPeriod } from '@/types/leave';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Missing date parameter' },
        { status: 400 }
      );
    }

    const targetDate = new Date(dateParam);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Find all approved leaves that overlap with the target date
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teacherCode: true,
            department: true,
          },
        },
      },
      orderBy: [
        { teacher: { firstName: 'asc' } },
        { teacher: { lastName: 'asc' } },
      ],
    });

    // Map to response format
    const result = leaves.map((leave) => ({
      id: leave.id,
      firstName: leave.teacher.firstName,
      lastName: leave.teacher.lastName,
      teacherCode: leave.teacher.teacherCode,
      department: leave.teacher.department,
      type: leave.type as LeaveType,
      customTypeName: leave.type === 'other' ? undefined : leave.customTypeName ?? undefined,
      isHalfDay: leave.isHalfDay,
      halfDayPeriod: leave.halfDayPeriod as HalfDayPeriod | undefined,
    }));

    return NextResponse.json({
      date: dateParam,
      count: result.length,
      leaves: result,
    });
  } catch (error) {
    console.error('Error fetching leaves by date:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
