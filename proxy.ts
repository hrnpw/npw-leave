import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { teacherSessionOptions, hrSessionOptions, isSessionExpired, TeacherSession, HrSession } from './lib/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Teacher routes - check cookie exists and validate expiry
  if (pathname.startsWith('/teacher')) {
    const teacherCookie = request.cookies.get('teacher_session');

    if (!teacherCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/verify';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Validate session expiry
    try {
      const response = NextResponse.next();
      const session = await getIronSession<TeacherSession>(request, response, teacherSessionOptions);

      console.log('[Middleware] Teacher session check:', {
        pathname,
        hasId: !!session.id,
        hasCreatedAt: !!session.createdAt,
        isExpired: session.createdAt ? isSessionExpired(session.createdAt) : 'N/A'
      });

      if (!session.id || !session.createdAt || isSessionExpired(session.createdAt)) {
        console.warn('[Middleware] Invalid/expired session - redirecting to home');
        // Session expired - clear cookie and redirect to home page
        response.cookies.delete('teacher_session');
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.searchParams.delete('returnUrl'); // Remove returnUrl for expired sessions
        return NextResponse.redirect(url);
      }

      return response;
    } catch (error) {
      console.error('[Middleware] Session validation error:', error);
      // Invalid session - redirect to home page
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.delete('returnUrl');
      return NextResponse.redirect(url);
    }
  }

  // Super Admin routes - check cookie exists and validate expiry
  if (pathname.startsWith('/hr/admin')) {
    const hrCookie = request.cookies.get('hr_session');

    if (!hrCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Validate session expiry
    try {
      const response = NextResponse.next();
      const session = await getIronSession<HrSession>(request, response, hrSessionOptions);

      if (!session.id || !session.createdAt || isSessionExpired(session.createdAt)) {
        // Session expired - clear cookie and redirect to home page
        response.cookies.delete('hr_session');
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.searchParams.delete('returnUrl');
        return NextResponse.redirect(url);
      }

      return response;
    } catch (error) {
      // Invalid session - redirect to home page
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.delete('returnUrl');
      return NextResponse.redirect(url);
    }
  }

  // HR routes require HR session
  if (pathname.startsWith('/hr') && pathname !== '/hr/login') {
    const hrCookie = request.cookies.get('hr_session');

    if (!hrCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Validate session expiry
    try {
      const response = NextResponse.next();
      const session = await getIronSession<HrSession>(request, response, hrSessionOptions);

      if (!session.id || !session.createdAt || isSessionExpired(session.createdAt)) {
        // Session expired - clear cookie and redirect to home page
        response.cookies.delete('hr_session');
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.searchParams.delete('returnUrl');
        return NextResponse.redirect(url);
      }

      return response;
    } catch (error) {
      // Invalid session - redirect to home page
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.delete('returnUrl');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher/:path*', '/hr/:path*'],
};
