import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/init';
import { exportAsJson } from '@/lib/backup';

export async function GET() {
  try {
    await ensureDb();
    // With Neon, backups are managed by the database provider
    return NextResponse.json({
      message: 'Database is hosted on Neon with automatic backups and point-in-time recovery.',
      provider: 'neon',
    });
  } catch (err) {
    console.error('GET /api/backup error:', err);
    return NextResponse.json({ error: 'Failed to get backup status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    await ensureDb();
    const data = await exportAsJson();
    return NextResponse.json(data);
  } catch (err) {
    console.error('POST /api/backup error:', err);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
