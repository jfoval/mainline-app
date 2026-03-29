import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal, validateRequired } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'name', 'description', 'sort_order', 'horizon_type',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const items = type
      ? await sql`SELECT * FROM horizon_items WHERE horizon_type = ${type} ORDER BY sort_order, name`
      : await sql`SELECT * FROM horizon_items ORDER BY horizon_type, sort_order, name`;

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/horizon-items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    const missing = validateRequired(body, ['name', 'horizon_type']);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const now = nowLocal();
    await sql`
      INSERT INTO horizon_items (id, horizon_type, name, description, sort_order, created_at, updated_at)
      VALUES (${id}, ${body.horizon_type}, ${body.name}, ${body.description || null},
              ${body.sort_order || 0}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM horizon_items WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/horizon-items error:', err);
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
      `UPDATE horizon_items SET ${upd.fields} WHERE id = $${upd.paramOffset + 1}`,
      [...upd.values, id]
    );

    const rows = await sql`SELECT * FROM horizon_items WHERE id = ${id}`;
    if (!rows[0]) return NextResponse.json({ error: 'Record not found after update' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/horizon-items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sql`DELETE FROM horizon_items WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/horizon-items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
