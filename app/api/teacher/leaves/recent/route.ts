import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getTeacherSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    // Get recent 3 leaves
    const leaves = await prisma.leave.findMany({
      where: {
        teacherId: session.id,
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
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
    });

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error('Get recent leaves error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
