import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DEBUG ONLY - ตรวจสอบข้อมูลวันที่ในฐานข้อมูล
export async function GET() {
  try {
    const leaves = await prisma.leave.findMany({
      where: {
        status: { in: ['pending', 'approved'] },
      },
      select: {
        id: true,
        leaveNo: true,
        teacherId: true,
        startDate: true,
        endDate: true,
        status: true,
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
      take: 10,
    });

    // Debug: show raw data types and values
    const debug = leaves.map((leave) => {
      const startDateObj = new Date(leave.startDate);
      const endDateObj = new Date(leave.endDate);

      return {
        leaveNo: leave.leaveNo,
        teacher: `${leave.teacher.firstName} ${leave.teacher.lastName}`,
        startDate: {
          raw: leave.startDate,
          type: typeof leave.startDate,
          iso: startDateObj.toISOString(),
          localTH: startDateObj.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          date: startDateObj.toISOString().split('T')[0],
        },
        endDate: {
          raw: leave.endDate,
          type: typeof leave.endDate,
          iso: endDateObj.toISOString(),
          localTH: endDateObj.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          date: endDateObj.toISOString().split('T')[0],
        },
        status: leave.status,
      };
    });

    return NextResponse.json({
      count: debug.length,
      leaves: debug
    }, { status: 200 });
  } catch (error) {
    console.error('[DEBUG LEAVES ERROR]', error);
    return NextResponse.json({
      error: 'เกิดข้อผิดพลาด',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
