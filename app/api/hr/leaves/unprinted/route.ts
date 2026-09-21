import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leaves = await prisma.leave.findMany({
      where: {
        status: 'approved',
        printedAt: null,
      },
      include: {
        teacher: {
          select: {
            teacherCode: true,
            title: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        approvedAt: 'asc', // เก่าสุดก่อน
      },
      take: 20,
    });

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error('Failed to get unprinted leaves:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
