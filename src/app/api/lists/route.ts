import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = ['title', 'tier', 'status', 'url', 'notes', 'sort_order'];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const listType = searchParams.get('type');

    if (listType) {
      const items = await sql`
        SELECT * FROM list_items WHERE list_type = ${listType} ORDER BY sort_order, created_at DESC
      `;
      return NextResponse.json(items);
    }

    const counts = await sql`SELECT list_type, COUNT(*) as count FROM list_items GROUP BY list_type`;
    return NextResponse.json(counts);
  } catch (err) {
    console.error('GET /api/lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const { title, list_type, tier, status, url, notes } = body;

    if (!title || (typeof title === 'string' && !title.trim())) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!list_type || (typeof list_type === 'string' && !list_type.trim())) {
      return NextResponse.json({ error: 'list_type is required' }, { status: 400 });
    }

    const now = nowLocal();
    await sql`
      INSERT INTO list_items (id, list_type, title, tier, status, url, notes, created_at, updated_at)
      VALUES (${id}, ${list_type}, ${title}, ${tier || null}, ${status || null}, ${url || null}, ${notes || null}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM list_items WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/lists error:', err);
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
    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE list_items SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM list_items WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/lists error:', err);
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
    await sql`DELETE FROM list_items WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
