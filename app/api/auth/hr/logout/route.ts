import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getHrSession();
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('HR logout error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
