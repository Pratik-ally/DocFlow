import type { NextAuthConfig, User } from 'next-auth';

/**
 * Edge-compatible auth config.
 *
 * MUST NOT import anything that pulls in Node.js built-ins
 * (mongodb, bcrypt, crypto, etc.).
 *
 * Used by:
 *  - middleware.ts  (Edge Runtime)
 *  - auth.ts        (Node.js Runtime, extends this config with providers + adapter)
 */
export const authConfig: NextAuthConfig = {
  providers: [], // providers are added in auth.ts (Node-only)

  trustHost: true,
  session: { strategy: 'jwt' },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.role = (user as User & { role?: string }).role ?? 'PATIENT';
        token.hospitalId = (user as User & { hospitalId?: string }).hospitalId;
        token.mustChangePassword = (user as User & { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.portal = (user as User & { portal?: string }).portal;
        token.sessionVersion = (user as User & { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },

    session({ session, token }) {
      if (token && session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = (token.role as string) || 'PATIENT';
        (session.user as { hospitalId?: string }).hospitalId = token.hospitalId as string | undefined;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword = token.mustChangePassword as boolean | undefined;
        (session.user as { portal?: string }).portal = token.portal as string | undefined;
        (session.user as { sessionVersion?: number }).sessionVersion = token.sessionVersion as number | undefined;
      }
      return session;
    },

    authorized({ auth: session, request: { nextUrl } }) {
      const { pathname } = nextUrl;

      // Protected route prefixes
      const protectedPrefixes = ['/patient', '/doctor', '/staff', '/admin'];
      const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
      if (isProtected && !session?.user) return false;
      return true;
    },
  },

  pages: {
    signIn: '/login',
    error: '/error',
  },
};
