import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.cookies.get('kleiora_token')) {
    const loginURL = new URL('/studio/login', request.url);
    loginURL.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginURL);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
