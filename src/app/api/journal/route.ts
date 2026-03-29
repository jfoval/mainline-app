import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = ['content', 'tag', 'updated_at'];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }
      const items = await sql`SELECT * FROM journal_entries WHERE entry_date = ${date} ORDER BY created_at ASC`;
      return NextResponse.json(items);
    }

    // No date param: return last 30 days for sync
    const items = await sql`SELECT * FROM journal_entries ORDER BY entry_date DESC, created_at ASC LIMIT 500`;
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const { entry_date, content, tag } = body;

    if (!entry_date || !content) {
      return NextResponse.json({ error: 'entry_date and content are required' }, { status: 400 });
    }

    const now = nowLocal();

    await sql`
      INSERT INTO journal_entries (id, entry_date, content, tag, created_at, updated_at)
      VALUES (${id}, ${entry_date}, ${content}, ${tag || null}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM journal_entries WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    rawUpdates.updated_at = nowLocal();
    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS]);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE journal_entries SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM journal_entries WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await sql`DELETE FROM journal_entries WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/journal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
