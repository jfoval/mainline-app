import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/init';
import { runCleanup, getCleanupStatus } from '@/lib/maintenance';

export async function GET() {
  try {
    await ensureDb();
    const status = await getCleanupStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error('Maintenance GET failed:', err);
    return NextResponse.json({ error: 'Failed to get maintenance status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    await ensureDb();
    const stats = await runCleanup();
    const status = await getCleanupStatus();
    return NextResponse.json({ ran: true, stats, ...status });
  } catch (err) {
    console.error('Maintenance POST failed:', err);
    return NextResponse.json({ error: 'Failed to run maintenance' }, { status: 500 });
  }
}
