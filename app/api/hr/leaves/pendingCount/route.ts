import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.leave.count({
      where: {
        status: 'pending',
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to fetch pending count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending count' },
      { status: 500 }
    );
  }
}
