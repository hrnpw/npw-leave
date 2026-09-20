import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.leave.count({
      where: {
        status: 'approved',
        printedAt: null,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to get unprinted count:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
