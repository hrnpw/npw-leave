import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { teacherSessionOptions, hrSessionOptions, isSessionExpired, isSessionNearExpiry, TeacherSession, HrSession } from './lib/session';

/**
 * Re-stamp the session so an active user is not logged out mid-task.
 *
 * iron-session does not refresh `ttl` on read, so without this the cookie dies a
 * fixed interval after login no matter how much the user is doing. We only save
 * when the session is close to expiring to avoid writing a Set-Cookie header on
 * every single navigation.
 */
async function refreshIfNearExpiry<T extends TeacherSession | HrSession>(
  session: Awaited<ReturnType<typeof getIronSession<T>>>
) {
  if (!session.createdAt || !isSessionNearExpiry(session.createdAt)) {
    return;
  }

  try {
    session.createdAt = Date.now();
    await session.save();
  } catch (error) {
    // A failed refresh must not break the navigation - the session is still
    // valid at this point, the user just won't get the extension.
    console.error('[Proxy] Failed to refresh session:', error);
  }
}

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

      if (!session.id || !session.createdAt || isSessionExpired(session.createdAt)) {
        console.warn('[Proxy] Invalid/expired teacher session - redirecting to /verify');
        // Session expired - clear cookie and redirect
        response.cookies.delete('teacher_session');
        const url = request.nextUrl.clone();
        url.pathname = '/verify';
        url.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(url);
      }

      await refreshIfNearExpiry(session);

      return response;
    } catch (error) {
      console.error('[Middleware] Session validation error:', error);
      // Invalid session - redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/verify';
      url.searchParams.set('returnUrl', pathname);
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
        // Session expired - clear cookie and redirect
        response.cookies.delete('hr_session');
        const url = request.nextUrl.clone();
        url.pathname = '/hr/login';
        url.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(url);
      }

      await refreshIfNearExpiry(session);

      return response;
    } catch (error) {
      // Invalid session - redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
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
        // Session expired - clear cookie and send to login, not the public
        // dashboard, so the user can get back to what they were doing.
        response.cookies.delete('hr_session');
        const url = request.nextUrl.clone();
        url.pathname = '/hr/login';
        url.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(url);
      }

      await refreshIfNearExpiry(session);

      return response;
    } catch (error) {
      // Invalid session - redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher/:path*', '/hr/:path*'],
};
