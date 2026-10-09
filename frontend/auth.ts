import NextAuth, { User } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';

// ─── Lazy MongoDB singleton ───────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

export function getMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri);
  }
  return global._mongoClient;
}

// ─── Credential schema ────────────────────────────────────────────────────────
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Full Auth.js config (Node.js runtime only) ───────────────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // MongoDB adapter — lazy proxy so builds without MONGODB_URI work fine
  adapter: MongoDBAdapter(
    new Proxy({} as MongoClient, {
      get(_target, prop) {
        return (getMongoClient() as unknown as Record<string, unknown>)[prop as string];
      },
    })
  ),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
          role: 'PATIENT' as const,
        };
      },
    }),

    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const client = getMongoClient();
        await client.connect();
        const db = client.db();
        const user = await db.collection('users').findOne({ email: email.toLowerCase() });

        if (!user || !user.passwordHash) return null;
        if (user.isActive === false) return null;

        const valid = await bcrypt.compare(password, user.passwordHash as string);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name as string,
          email: user.email as string,
          image: (user.image as string | null) ?? null,
          role: (user.role as string) || 'PATIENT',
        };
      },
    }),
  ],

  callbacks: {
    // Spread the edge-safe callbacks (session shape), then override jwt
    // to also hydrate the role from the DB after Google OAuth sign-in.
    ...authConfig.callbacks,

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.role = (user as User & { role?: string }).role ?? 'PATIENT';
      }

      // After Google OAuth: pull the persisted role from the DB
      if (account?.provider === 'google' && token.email) {
        const client = getMongoClient();
        await client.connect();
        const db = client.db();
        const dbUser = await db.collection('users').findOne({ email: token.email });
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = (dbUser.role as string) || 'PATIENT';
        }
      }

      return token;
    },

    // Upsert Google users on first sign-in
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const client = getMongoClient();
        await client.connect();
        const db = client.db();
        await db.collection('users').updateOne(
          { email: user.email },
          {
            $setOnInsert: { role: 'PATIENT', isActive: true, createdAt: new Date() },
            $set: {
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
      return true;
    },
  },

  events: {
    async createUser({ user }) {
      if (!user.email) return;
      const client = getMongoClient();
      await client.connect();
      const db = client.db();
      await db.collection('users').updateOne(
        { email: user.email },
        { $setOnInsert: { role: 'PATIENT', isActive: true } },
        { upsert: false }
      );
    },
  },
});
