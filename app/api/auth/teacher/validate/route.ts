import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getTeacherSession();

    // Check if session exists and has required fields
    if (!session.id || !session.createdAt) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลเซสชัน' },
        { status: 401 }
      );
    }

    // Check if session is expired
    if (isSessionExpired(session.createdAt)) {
      // Destroy the session
      session.destroy();
      return NextResponse.json(
        { error: 'เซสชันหมดอายุ' },
        { status: 401 }
      );
    }

    // Session is valid
    return NextResponse.json({
      valid: true,
      user: {
        id: session.id,
        firstName: session.firstName,
        lastName: session.lastName,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบเซสชัน' },
      { status: 500 }
    );
  }
}
