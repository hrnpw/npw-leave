import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Uses cookies for auth

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session.id || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // pending = รอ HR ตรวจ, reviewed = รอ ผอ. อนุมัติ
    const [pending, reviewed] = await Promise.all([
      prisma.leave.count({ where: { status: 'pending' } }),
      prisma.leave.count({ where: { status: 'reviewed' } }),
    ]);

    // count = ยอดหลักตาม role (ผอ. ใช้ reviewed ส่วน hr/super_admin ใช้ pending)
    const count = session.role === 'director' ? reviewed : pending;

    return NextResponse.json({ count, pending, reviewed });
  } catch (error) {
    console.error('Failed to fetch pending count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending count' },
      { status: 500 }
    );
  }
}
