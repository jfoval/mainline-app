import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/init';
import { exportAsJson } from '@/lib/backup';

export async function GET() {
  try {
    ensureDb();
    const data = exportAsJson();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/backup/export error:', err);
    return NextResponse.json({ error: 'Failed to export database' }, { status: 500 });
  }
}
