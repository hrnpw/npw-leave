import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { getR2Stats } from '@/lib/r2/upload';

export async function GET() {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getR2Stats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get R2 stats:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
