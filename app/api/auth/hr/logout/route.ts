import { NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';

export async function POST() {
  try {
    const session = await getHrSession();
    session.destroy();

    // Create response with explicit cookie clearing for Safari
    const response = NextResponse.json({ success: true });

    // Clear the session cookie explicitly
    response.cookies.set('hr_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('HR logout error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
