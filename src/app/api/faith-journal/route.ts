import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { nowLocal } from '@/lib/api-helpers';

export async function GET() {
  try {
    await ensureDb();
    const entries = await sql`SELECT * FROM faith_journal ORDER BY month DESC`;
    return NextResponse.json(entries);
  } catch (err) {
    console.error('GET /api/faith-journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const { month, content } = await req.json();

    if (!month || !month.trim()) {
      return NextResponse.json({ error: 'month is required' }, { status: 400 });
    }
    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const existing = await sql`SELECT * FROM faith_journal WHERE month = ${month}`;
    const now = nowLocal();

    if (existing.length > 0) {
      await sql`UPDATE faith_journal SET content = ${content}, updated_at = ${now} WHERE month = ${month}`;
    } else {
      const id = uuid();
      await sql`INSERT INTO faith_journal (id, month, content) VALUES (${id}, ${month}, ${content})`;
    }

    const rows = await sql`SELECT * FROM faith_journal WHERE month = ${month}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/faith-journal error:', err);
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

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM faith_journal WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const now = nowLocal();
    await sql`UPDATE faith_journal SET content = ${content}, updated_at = ${now} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM faith_journal WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/faith-journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
