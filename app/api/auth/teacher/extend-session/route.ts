import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getTeacherSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่พบเซสชัน' },
        { status: 401 }
      );
    }

    // Update session timestamp
    session.createdAt = Date.now();
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Extend teacher session error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
