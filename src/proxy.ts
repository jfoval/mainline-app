import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/jwt-secret';

const PUBLIC_PATHS = [
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/setup',
  '/api/setup/test-key',
  '/_next',
  '/manifest.json',
  '/sw.js',
  '/icons',
  '/favicon.ico',
  '/branding',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = req.cookies.get('mainline-auth')?.value;

  if (!token) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verify JWT
  try {
    const jwtSecret = await getJwtSecret();
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Check if token was issued before a password change (session invalidation)
    if (payload.iat) {
      const { checkSessionValidity } = await import('@/lib/session-validity');
      const isValid = await checkSessionValidity(payload.iat);
      if (!isValid) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete('mainline-auth');
        return response;
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid/expired token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('mainline-auth');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
