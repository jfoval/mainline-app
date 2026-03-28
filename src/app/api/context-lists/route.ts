import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal, validateRequired } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'name', 'key', 'color', 'icon', 'sort_order', 'is_active',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('include_inactive') === '1';

    const items = includeInactive
      ? await sql`SELECT * FROM context_lists ORDER BY sort_order, name`
      : await sql`SELECT * FROM context_lists WHERE is_active = 1 ORDER BY sort_order, name`;

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/context-lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    const missing = validateRequired(body, ['name', 'key']);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    // Sanitize key to slug format
    const key = (body.key as string).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    const now = nowLocal();
    await sql`
      INSERT INTO context_lists (id, name, key, color, icon, sort_order, is_active, created_at, updated_at)
      VALUES (${id}, ${body.name}, ${key}, ${body.color || null}, ${body.icon || null},
              ${body.sort_order || 0}, ${body.is_active ?? 1}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM context_lists WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/context-lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, ...rawUpdates } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    rawUpdates.updated_at = nowLocal();
    const upd = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!upd) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    await sql.query(
      `UPDATE context_lists SET ${upd.fields} WHERE id = $${upd.paramOffset + 1}`,
      [...upd.values, id]
    );

    const rows = await sql`SELECT * FROM context_lists WHERE id = ${id}`;
    return NextResponse.json(rows[0] || { id });
  } catch (err) {
    console.error('PATCH /api/context-lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sql`DELETE FROM context_lists WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/context-lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
