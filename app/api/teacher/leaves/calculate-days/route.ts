import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession, getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { calculateLeaveDays } from '@/lib/leaveCalculator';

export async function POST(request: NextRequest) {
  try {
    // Allow both teacher and HR to use this endpoint
    const teacherSession = await getTeacherSession();
    const hrSession = await getHrSession();

    if (!teacherSession.id && !hrSession.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, isHalfDay, halfDayPeriod } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get holidays
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const holidayDates = holidays.map(h => h.date);

    // Calculate
    const calculation = calculateLeaveDays(
      start,
      end,
      holidayDates,
      isHalfDay || false,
      halfDayPeriod || undefined
    );

    return NextResponse.json({
      daysWorking: calculation.daysWorking,
      daysCalendar: calculation.daysCalendar,
    });
  } catch (error) {
    console.error('Calculate days error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคำนวณ' },
      { status: 500 }
    );
  }
}
