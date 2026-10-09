import NextAuth, { User } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  createFailedLoginUpdatePipeline,
  isCurrentSessionVersion,
  LOGIN_LOCKOUT_DURATION_MS,
} from '@shared/authSecurity';
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

// ─── Credential schemas ───────────────────────────────────────────────────────
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  hospitalId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

const STAFF_ROLES = ['OWNER', 'ADMIN', 'DOCTOR', 'STAFF'] as const;
type StaffRole = typeof STAFF_ROLES[number];

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
    // ── Google OAuth — patient portal only ────────────────────────────────────
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
          portal: 'patient',
        };
      },
    }),

    // ── Credentials: Patient portal (/login) ──────────────────────────────────
    Credentials({
      id: 'patient-credentials',
      name: 'patient-credentials',
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

        if (!user || !user.passwordHash || user.role !== 'PATIENT' || user.status !== 'ACTIVE') return null;
        if (user.lockedUntil && new Date(user.lockedUntil as Date) > new Date()) return null;

        const valid = await bcrypt.compare(password, user.passwordHash as string);
        if (!valid) {
          const now = new Date();
          await db.collection('users').updateOne(
            {
              _id: user._id,
              $or: [
                { lockedUntil: { $exists: false } },
                { lockedUntil: null },
                { lockedUntil: { $lte: now } },
              ],
            },
            createFailedLoginUpdatePipeline(new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS))
          );
          return null;
        }

        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }
        );

        return {
          id: user._id.toString(),
          name: user.name as string,
          email: user.email as string,
          image: (user.image as string | null) ?? null,
          role: 'PATIENT',
          portal: 'patient',
          sessionVersion: typeof user.sessionVersion === 'number' &&
            Number.isSafeInteger(user.sessionVersion)
            ? user.sessionVersion
            : 0,
        };
      },
    }),

    // ── Credentials: Staff portal (/staff-login) ──────────────────────────────
    Credentials({
      id: 'staff-credentials',
      name: 'staff-credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        hospitalId: { label: 'Hospital ID', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, hospitalId } = parsed.data;
        const client = getMongoClient();
        await client.connect();
        const db = client.db();
        const users = await db.collection('users').find({
          email: email.toLowerCase(),
          role: { $in: STAFF_ROLES },
          ...(hospitalId ? { hospitalId: new ObjectId(hospitalId) } : {}),
        }).limit(2).toArray();
        const user = users.length === 1 ? users[0] : null;

        // Only staff roles can sign in at the staff portal
        if (!user || !user.passwordHash) return null;
        if (!STAFF_ROLES.includes(user.role as StaffRole)) return null;
        // Reject REMOVED accounts with the same generic null
        if (user.status !== 'ACTIVE') return null;

        // Check lockout
        if (user.lockedUntil && new Date(user.lockedUntil as Date) > new Date()) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash as string);
        if (!valid) {
          // Increment failure count (best-effort, no await needed for Auth.js flow)
          const now = new Date();
          await db.collection('users').updateOne(
            {
              _id: user._id,
              $or: [
                { lockedUntil: { $exists: false } },
                { lockedUntil: null },
                { lockedUntil: { $lte: now } },
              ],
            },
            createFailedLoginUpdatePipeline(new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS))
          );
          return null;
        }

        // Reset on success
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }
        );

        return {
          id: user._id.toString(),
          name: user.name as string,
          email: user.email as string,
          image: null,
          role: user.role as string,
          hospitalId: user.hospitalId?.toString(),
          mustChangePassword: (user.mustChangePassword as boolean) ?? false,
          portal: 'staff',
          sessionVersion: Number.isSafeInteger(user.sessionVersion) ? user.sessionVersion as number : 0,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.role = (user as User & { role?: string }).role ?? 'PATIENT';
        token.hospitalId = (user as User & { hospitalId?: string }).hospitalId;
        token.mustChangePassword = (user as User & { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.portal = (user as User & { portal?: string }).portal ?? 'patient';
        token.sessionVersion = Number.isSafeInteger((user as User & { sessionVersion?: number }).sessionVersion)
          ? (user as User & { sessionVersion?: number }).sessionVersion
          : 0;
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
          token.portal = 'patient';
          token.sessionVersion = typeof dbUser.sessionVersion === 'number' &&
            Number.isSafeInteger(dbUser.sessionVersion)
            ? dbUser.sessionVersion
            : 0;
        }
      }

      if (token.id && ObjectId.isValid(token.id)) {
        const client = getMongoClient();
        await client.connect();
        const dbUser = await client.db().collection('users').findOne(
          { _id: new ObjectId(token.id) },
          { projection: { status: 1, sessionVersion: 1 } }
        );
        if (
          !dbUser ||
          dbUser.status !== 'ACTIVE' ||
          !isCurrentSessionVersion(token.sessionVersion, dbUser.sessionVersion)
        ) {
          return null;
        }
      }

      return token;
    },

    // Upsert Google users on first sign-in (patient portal only)
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const emailVerified = (user as { emailVerified?: Date | null }).emailVerified;
        if (!(emailVerified instanceof Date)) return false;
        const client = getMongoClient();
        await client.connect();
        const db = client.db();
        // Check if a staff account with this email exists — block them from Google patient login
        const normalizedEmail = user.email.toLowerCase();
        const existing = await db.collection('users').findOne({ email: normalizedEmail });
        if (existing && STAFF_ROLES.includes(existing.role as StaffRole)) {
          // Staff member trying to sign in via Google patient portal — block
          return false;
        }
        if (existing && existing.status !== 'ACTIVE') return false;

        await db.collection('users').updateOne(
          { email: normalizedEmail },
          {
            $setOnInsert: { role: 'PATIENT', createdAt: new Date() },
            $set: {
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        await db.collection('users').updateOne(
          { email: normalizedEmail, role: 'PATIENT', status: { $exists: false } },
          {
            $set: {
              status: 'ACTIVE',
              sessionVersion: 0,
              failedLoginCount: 0,
            },
          }
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
        { $setOnInsert: { role: 'PATIENT' } },
        { upsert: false }
      );
    },
  },
});
