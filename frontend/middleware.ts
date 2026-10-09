import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

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
  OWNER: '/admin/dashboard',
};

const ROLE_PREFIXES: Record<string, string[]> = {
  '/patient': ['PATIENT'],
  '/doctor': ['DOCTOR'],
  '/staff': ['STAFF'],
  '/admin': ['ADMIN', 'OWNER'],
};

async function getActiveDatabaseSession(req: NextRequest & { auth?: Session | null }): Promise<{ role: string } | null> {
  if (!req.auth?.user) return null;

  const validationUrl = req.nextUrl.clone();
  validationUrl.pathname = '/api/auth/validate-session';
  validationUrl.search = '';

  try {
    const response = await fetch(validationUrl, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const session = await response.json() as { role?: unknown };
    return typeof session.role === 'string' ? { role: session.role } : null;
  } catch (error) {
    console.error('Database session validation failed:', error instanceof Error ? error.name : 'Unknown error');
    return null;
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const databaseSession = await getActiveDatabaseSession(req);

  // ── /staff-login: redirect authenticated staff to their dashboard ──────────
  if (pathname === '/staff-login') {
    if (databaseSession) {
      const role = databaseSession.role;
      if (['OWNER', 'ADMIN', 'DOCTOR', 'STAFF'].includes(role)) {
        const dest = ROLE_REDIRECTS[role] ?? '/staff-login';
        return NextResponse.redirect(new URL(dest, req.url));
      }
      // Patient signed in at staff-login — kick back to their portal
      return NextResponse.redirect(new URL('/patient/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // ── /login and /register: redirect authenticated patients ─────────────────
  if (pathname === '/login' || pathname === '/register') {
    if (databaseSession) {
      const role = databaseSession.role;
      const dest = ROLE_REDIRECTS[role] ?? '/login';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // ── Protected route prefix enforcement ────────────────────────────────────
  const entry = Object.entries(ROLE_PREFIXES).find(([prefix]) => pathname.startsWith(prefix));
  if (!entry) return NextResponse.next();

  const [prefix, allowedRoles] = entry;

  // Not authenticated → redirect to appropriate login page
  if (!databaseSession) {
    const isStaffRoute = prefix === '/admin' || prefix === '/doctor' || prefix === '/staff';
    const loginPage = isStaffRoute ? '/staff-login' : '/login';
    const url = new URL(loginPage, req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const role = databaseSession.role;

  // Wrong role → redirect to their own dashboard
  if (!allowedRoles.includes(role)) {
    const correct = ROLE_REDIRECTS[role];
    if (correct) return NextResponse.redirect(new URL(correct, req.url));
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}) as (req: NextRequest) => ReturnType<typeof NextResponse.next>;

export const config = {
  matcher: [
    '/patient/:path*',
    '/doctor/:path*',
    '/staff/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/staff-login',
  ],
};
