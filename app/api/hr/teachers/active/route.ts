import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current HR user info to filter them out
    const currentHrUser = await prisma.hrUser.findUnique({
      where: { id: session.id },
      select: { firstName: true, lastName: true },
    });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const where: any = {
      isActive: true,
    };

    // Filter out HR user if they have a teacher account with matching name
    if (currentHrUser) {
      where.NOT = {
        AND: [
          { firstName: currentHrUser.firstName },
          { lastName: currentHrUser.lastName },
        ],
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { teacherCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      select: {
        id: true,
        teacherCode: true,
        title: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 50,
    });

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
