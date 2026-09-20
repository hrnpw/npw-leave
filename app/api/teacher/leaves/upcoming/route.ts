import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/teacher/leaves/upcoming
 * ดึงใบลาที่อนุมัติแล้วและกำลังจะถึง (วันเริ่มลาในอนาคต 30 วันข้างหน้า)
 */
export async function GET(request: NextRequest) {
  try {
    // ตรวจสอบ session
    const session = await getTeacherSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const teacherId = session.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // วันที่ 30 วันข้างหน้า
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);

    // ดึงใบลาที่อนุมัติแล้ว และวันเริ่มลาอยู่ระหว่างวันนี้ - 30 วันข้างหน้า
    const upcomingLeaves = await prisma.leave.findMany({
      where: {
        teacherId,
        status: 'approved',
        startDate: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: {
        startDate: 'asc', // เรียงจากใกล้สุดไปไกลสุด
      },
      select: {
        id: true,
        leaveNo: true,
        type: true,
        customTypeName: true,
        status: true,
        startDate: true,
        endDate: true,
        daysWorking: true,
        leaveDays: {
          select: {
            isHalfDay: true,
            halfDayPeriod: true,
          },
          take: 1, // ดึงวันแรกเพื่อเช็คว่าเป็นครึ่งวันหรือไม่
        },
      },
      take: 5, // จำกัดสูงสุด 5 ใบ
    });

    // แปลงข้อมูลให้ตรงกับที่ Frontend ต้องการ
    const formattedLeaves = upcomingLeaves.map(leave => ({
      id: leave.id,
      leaveNo: leave.leaveNo,
      type: leave.type,
      customTypeName: leave.customTypeName,
      status: leave.status,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      daysWorking: leave.daysWorking,
      isHalfDay: leave.leaveDays[0]?.isHalfDay || false,
      halfDayPeriod: leave.leaveDays[0]?.halfDayPeriod || null,
    }));

    return NextResponse.json({
      leaves: formattedLeaves,
    });
  } catch (error) {
    console.error('Error fetching upcoming leaves:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
