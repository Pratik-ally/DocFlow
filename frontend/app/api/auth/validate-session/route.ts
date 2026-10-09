import { auth, getMongoClient } from '@/auth';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const client = getMongoClient();
    await client.connect();
    const user = await client.db().collection('users').findOne(
      { _id: new ObjectId(userId), status: 'ACTIVE' },
      { projection: { role: 1 } }
    );
    if (!user || typeof user.role !== 'string') {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    return NextResponse.json({ role: user.role }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Session validation failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
