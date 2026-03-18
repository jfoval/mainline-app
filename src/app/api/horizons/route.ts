import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowLocal } from '@/lib/api-helpers';

export async function GET() {
  try {
    await ensureDb();
    const horizons = await sql`SELECT * FROM horizons ORDER BY type`;
    return NextResponse.json(horizons);
  } catch (err) {
    console.error('GET /api/horizons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, content, _base_updated_at } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM horizons WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const now = nowLocal();
    await sql`UPDATE horizons SET content = ${content}, updated_at = ${now} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM horizons WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/horizons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
