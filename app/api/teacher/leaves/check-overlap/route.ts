import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

/**
 * Check if leave dates overlap with existing leaves
 * Used before submitting to show warning
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, excludeLeaveId } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    // Convert to UTC dates to prevent timezone shift
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');

    console.log('[CHECK-OVERLAP] Input:', { startDate, endDate });
    console.log('[CHECK-OVERLAP] Parsed:', { start, end });
    console.log('[CHECK-OVERLAP] ISO:', { start: start.toISOString(), end: end.toISOString() });

    // Find overlapping leaves (status pending or approved)
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
        status: {
          in: ['pending', 'approved'],
        },
        ...(excludeLeaveId && { id: { not: excludeLeaveId } }),
        OR: [
          // Case 1: Existing leave starts within new range
          {
            startDate: {
              gte: start,
              lte: end,
            },
          },
          // Case 2: Existing leave ends within new range
          {
            endDate: {
              gte: start,
              lte: end,
            },
          },
          // Case 3: Existing leave completely contains new range
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: end } },
            ],
          },
        ],
      },
      select: {
        id: true,
        leaveNo: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true,
        isHalfDay: true,
        halfDayPeriod: true,
      },
    });

    // Check if it's same-day half-day conflict
    // Allow morning + afternoon on the same day
    if (overlappingLeaves.length > 0) {
      const isSingleDay = start.getTime() === end.getTime();

      if (isSingleDay) {
        // Check if we can fit half-days
        const existingHalfDay = overlappingLeaves.find(l =>
          l.isHalfDay &&
          l.startDate.getTime() === start.getTime()
        );

        // If requesting half-day and existing is also half-day, check periods
        // This will be handled in the submission - just return the conflict
      }
    }

    return NextResponse.json({
      hasOverlap: overlappingLeaves.length > 0,
      overlappingLeaves: overlappingLeaves.map(leave => ({
        id: leave.id,
        leaveNo: leave.leaveNo,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        status: leave.status,
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
      })),
    });
  } catch (error) {
    console.error('Check overlap error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบ' },
      { status: 500 }
    );
  }
}
