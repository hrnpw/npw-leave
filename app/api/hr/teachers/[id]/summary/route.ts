import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getCurrentPeriod } from '@/lib/dateUtils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
        isActive: true,
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (!teacher.isActive) {
      return NextResponse.json(
        { error: 'ครูท่านนี้ถูกปิดใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Get current period
    const period = getCurrentPeriod();

    // Get all approved and pending leaves in current period
    const leaves = await prisma.leave.findMany({
      where: {
        teacherId: id,
        status: {
          in: ['approved', 'pending'],
        },
        startDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      select: {
        type: true,
        daysCalendar: true,
      },
    });

    // Calculate totals by type
    let sickPersonalDays = 0;
    let maternityDays = 0;
    let religiousDays = 0;
    let otherDays = 0;

    leaves.forEach((leave) => {
      switch (leave.type) {
        case 'sick':
        case 'personal':
          sickPersonalDays += leave.daysCalendar;
          break;
        case 'maternity':
          maternityDays += leave.daysCalendar;
          break;
        case 'religious':
          religiousDays += leave.daysCalendar;
          break;
        case 'other':
          otherDays += leave.daysCalendar;
          break;
      }
    });

    return NextResponse.json({
      teacher,
      period: {
        name: period.name,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
      },
      summary: {
        sickPersonal: {
          used: sickPersonalDays,
          quota: 23,
          remaining: Math.max(0, 23 - sickPersonalDays),
          exceeds: Math.max(0, sickPersonalDays - 23),
        },
        maternity: {
          used: maternityDays,
          quota: 90,
          remaining: Math.max(0, 90 - maternityDays),
          exceeds: Math.max(0, maternityDays - 90),
        },
        religious: {
          used: religiousDays,
          quota: 120,
          remaining: Math.max(0, 120 - religiousDays),
          exceeds: Math.max(0, religiousDays - 120),
        },
        other: {
          used: otherDays,
          quota: null, // No quota
          remaining: null,
          exceeds: 0,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch teacher summary:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
