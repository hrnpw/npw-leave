import { NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getTeacherSession();
    session.destroy();

    // Create response with explicit cookie clearing for Safari
    const response = NextResponse.json({ success: true });

    // Clear the session cookie explicitly
    response.cookies.set('teacher_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Teacher logout error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
