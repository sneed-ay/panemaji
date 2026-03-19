import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Redirect old Render subdomain to new custom domain
  if (host.includes('onrender.com')) {
    const url = request.nextUrl.clone();
    url.host = 'panemaji.com';
    url.protocol = 'https';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // Redirect www to non-www
  if (host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = 'panemaji.com';
    url.protocol = 'https';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api
    '/((?!_next/static|_next/image|favicon|icon|apple-touch-icon|.*\\.png$).*)',
  ],
};
