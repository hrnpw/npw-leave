import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Teacher routes - check cookie exists
  if (pathname.startsWith('/teacher')) {
    const teacherSession = request.cookies.get('teacher_session');

    if (!teacherSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/verify';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // Super Admin routes - check cookie exists and will be validated in page
  if (pathname.startsWith('/hr/admin')) {
    const hrSession = request.cookies.get('hr_session');

    if (!hrSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Role check happens in the page component
    return NextResponse.next();
  }

  // HR routes require HR session
  if (pathname.startsWith('/hr') && pathname !== '/hr/login') {
    const hrSession = request.cookies.get('hr_session');

    if (!hrSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/hr/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher/:path*', '/hr/:path*'],
};
