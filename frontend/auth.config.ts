import type { NextAuthConfig, User } from 'next-auth';

/**
 * Edge-compatible auth config.
 *
 * MUST NOT import anything that pulls in Node.js built-ins
 * (mongodb, bcryptjs, crypto, etc.).
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
      }
      return token;
    },

    session({ session, token }) {
      if (token && session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = (token.role as string) || 'PATIENT';
      }
      return session;
    },

    authorized({ auth: session, request: { nextUrl } }) {
      const protectedPrefixes = ['/patient', '/doctor', '/staff', '/admin'];
      const isProtected = protectedPrefixes.some((p) => nextUrl.pathname.startsWith(p));
      if (isProtected && !session?.user) return false;
      return true;
    },
  },

  pages: {
    signIn: '/login',
    error: '/error',
  },
};
