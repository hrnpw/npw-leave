import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { findOverlappingLeaves } from '@/lib/leaveOverlap';

export async function POST(request: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teacherId, startDate, endDate } = await request.json();

    if (!teacherId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const conflicts = await findOverlappingLeaves({
      teacherId,
      startDate,
      endDate,
    });

    return NextResponse.json({
      hasOverlap: conflicts.length > 0,
      overlappingLeaves: conflicts.map((leave) => ({
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
    console.error('HR check overlap error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบ' },
      { status: 500 }
    );
  }
}
