import { createHash } from 'node:crypto';
import { handlers } from '@/auth';
import { getMongoClient } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 50;
let expiryIndexPromise: Promise<string> | undefined;

async function rejectIfRateLimited(request: NextRequest): Promise<NextResponse | null> {
  if (!/^\/api\/auth\/(?:signin|callback)(?:\/|$)/.test(request.nextUrl.pathname)) {
    return null;
  }

  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const forwardedIps = forwarded?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const ipAddress = forwardedIps[forwardedIps.length - 1] || request.headers.get('x-real-ip')?.trim() || 'unknown';
    const windowStart = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const expiresAt = new Date(windowStart + RATE_LIMIT_WINDOW_MS);
    const key = createHash('sha256').update(`${ipAddress}:${windowStart}`).digest('hex');
    const client = getMongoClient();
    await client.connect();
    const collection = client.db().collection<{ _id: string; count: number; expiresAt: Date }>('auth_rate_limits');

    if (!expiryIndexPromise) {
      expiryIndexPromise = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    }
    try {
      await expiryIndexPromise;
    } catch (error) {
      expiryIndexPromise = undefined;
      throw error;
    }

    await collection.updateOne(
      { _id: key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true }
    );
    const counter = await collection.findOne({ _id: key }, { projection: { count: 1 } });
    if ((counter?.count ?? 0) > RATE_LIMIT_MAX) {
      const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, message: 'Too many sign-in attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
      );
    }
    return null;
  } catch (error) {
    console.error('Auth.js rate limiter failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { success: false, message: 'Authentication is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimited = await rejectIfRateLimited(request);
  if (rateLimited) return rateLimited;
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const rateLimited = await rejectIfRateLimited(request);
  if (rateLimited) return rateLimited;
  return handlers.POST(request);
}
