import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getHrSession();

    if (!session.id) {
      return NextResponse.json(
        { error: 'ไม่พบเซสชัน' },
        { status: 401 }
      );
    }

    // Update session timestamp (sliding window)
    session.createdAt = Date.now();
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('HR session extend error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
