import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function GET() {
  try {
    await ensureDb();
    const rows = await sql`SELECT key, value FROM settings`;
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key as string] = row.value as string;
    }
    return NextResponse.json(settings);
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${String(value)})
        ON CONFLICT (key) DO UPDATE SET value = ${String(value)}
      `;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
