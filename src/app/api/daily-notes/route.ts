import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'reflection_showed_up', 'reflection_fell_short', 'reflection_noticed',
  'reflection_grateful', 'top3_first', 'top3_second', 'top3_third',
  'notes', 'tomorrow',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'date must be in YYYY-MM-DD format' }, { status: 400 });
      }
      let rows = await sql`SELECT * FROM daily_notes WHERE date = ${date}`;
      if (rows.length === 0) {
        const id = uuid();
        await sql`INSERT INTO daily_notes (id, date) VALUES (${id}, ${date})`;
        rows = await sql`SELECT * FROM daily_notes WHERE id = ${id}`;
      }
      return NextResponse.json(rows[0]);
    }

    const notes = await sql`SELECT * FROM daily_notes ORDER BY date DESC LIMIT 30`;
    return NextResponse.json(notes);
  } catch (err) {
    console.error('GET /api/daily-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, _base_updated_at, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    rawUpdates.updated_at = nowLocal();

    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM daily_notes WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE daily_notes SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM daily_notes WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/daily-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
