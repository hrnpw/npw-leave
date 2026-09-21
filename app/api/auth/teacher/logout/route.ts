import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getTeacherSession();
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Teacher logout error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
