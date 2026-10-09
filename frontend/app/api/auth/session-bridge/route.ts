import { NextResponse } from 'next/server';
import { auth, getMongoClient } from '@/auth';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { isCurrentSessionVersion } from '@shared/authSecurity';

/**
 * POST /api/auth/session-bridge
 * Called client-side after Auth.js sign-in to mint an Express-compatible
 * JWT cookie so all existing backend API calls continue to work.
 *
 * Staff portal → sets `staff_token` cookie (8-hour expiry)
 * Patient portal → sets `token` cookie (7-day expiry)
 */
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: 'Session service unavailable' }, { status: 500 });
  }

  const su = session.user as {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    hospitalId?: string;
    mustChangePassword?: boolean;
    portal?: string;
    sessionVersion?: number;
  };

  if (!su.id || !ObjectId.isValid(su.id)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const client = getMongoClient();
  await client.connect();
  const dbUser = await client.db().collection('users').findOne({ _id: new ObjectId(su.id) });
  if (
    !dbUser ||
    dbUser.status !== 'ACTIVE' ||
    !isCurrentSessionVersion(su.sessionVersion, dbUser.sessionVersion)
  ) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const role = typeof dbUser.role === 'string' ? dbUser.role : 'PATIENT';
  const portal = role === 'PATIENT' ? 'patient' : 'staff';

  const payload = {
    id: dbUser._id.toString(),
    email: typeof dbUser.email === 'string' ? dbUser.email : '',
    role,
    name: typeof dbUser.name === 'string' ? dbUser.name : '',
    hospitalId: dbUser.hospitalId?.toString(),
    portal,
    sessionVersion: typeof dbUser.sessionVersion === 'number' &&
      Number.isSafeInteger(dbUser.sessionVersion)
      ? dbUser.sessionVersion
      : 0,
  };

  const isStaff = portal === 'staff';
  const expiresIn = isStaff ? '8h' : '7d';
  const maxAge = isStaff ? 8 * 60 * 60 : 7 * 24 * 60 * 60;
  const cookieName = isStaff ? 'staff_token' : 'token';

  const token = jwt.sign(payload, secret, { expiresIn });

  const response = NextResponse.json({ success: true, role, portal });
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  return response;
}
