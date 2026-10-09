import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';

/**
 * POST /api/auth/session-bridge
 * Called client-side after Auth.js sign-in to mint an Express-compatible
 * JWT cookie so all existing backend API calls continue to work.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: 'JWT_SECRET not configured' }, { status: 500 });
  }

  const payload = {
    id: (session.user as { id?: string }).id ?? '',
    email: session.user.email ?? '',
    role: (session.user as { role?: string }).role ?? 'PATIENT',
    name: session.user.name ?? '',
  };

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });

  const response = NextResponse.json({ success: true, role: payload.role });
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
