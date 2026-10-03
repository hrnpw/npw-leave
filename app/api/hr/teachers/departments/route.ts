import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

export async function GET() {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.teacher.findMany({
      where: { isActive: true, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });

    const departments = rows
      .map((r) => r.department)
      .filter((d): d is string => !!d);

    return NextResponse.json(
      { departments },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
