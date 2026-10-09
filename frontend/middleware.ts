import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge-safe middleware.
 *
 * Imports ONLY from auth.config.ts which has zero Node.js built-in dependencies.
 * auth.ts (with mongodb/bcrypt) is never imported here — it runs only in the
 * Node.js runtime (API routes / server components).
 */
const { auth } = NextAuth(authConfig);

const ROLE_REDIRECTS: Record<string, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  STAFF: '/staff/dashboard',
  ADMIN: '/admin/dashboard',
};

const ROLE_PREFIXES: Record<string, string[]> = {
  '/patient': ['PATIENT'],
  '/doctor': ['DOCTOR'],
  '/staff': ['STAFF'],
  '/admin': ['ADMIN'],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const entry = Object.entries(ROLE_PREFIXES).find(([prefix]) => pathname.startsWith(prefix));
  if (!entry) return NextResponse.next();

  const [, allowedRoles] = entry;
  const session = req.auth;

  // Not authenticated → redirect to login
  if (!session?.user) {
    const url = new URL('/login', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const role = (session.user as { role?: string }).role ?? 'PATIENT';

  // Wrong role → redirect to their own dashboard
  if (!allowedRoles.includes(role)) {
    const correct = ROLE_REDIRECTS[role] ?? '/login';
    return NextResponse.redirect(new URL(correct, req.url));
  }

  return NextResponse.next();
}) as (req: NextRequest) => ReturnType<typeof NextResponse.next>;

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*', '/staff/:path*', '/admin/:path*'],
};
