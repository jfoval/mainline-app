import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/init';
import { runCleanup, getCleanupStatus } from '@/lib/maintenance';

export async function GET() {
  await ensureDb();
  const status = await getCleanupStatus();
  return NextResponse.json(status);
}

export async function POST() {
  await ensureDb();
  const stats = await runCleanup();
  const status = await getCleanupStatus();
  return NextResponse.json({ ran: true, stats, ...status });
}
