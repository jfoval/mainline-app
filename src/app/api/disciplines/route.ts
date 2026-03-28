import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal, validateRequired, validateEnum } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'name', 'type', 'description', 'frequency', 'time_of_day',
  'is_active', 'sort_order',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('include_inactive') === '1';
    const type = searchParams.get('type');

    let items;
    if (type) {
      items = includeInactive
        ? await sql`SELECT * FROM disciplines WHERE type = ${type} ORDER BY sort_order, name`
        : await sql`SELECT * FROM disciplines WHERE is_active = 1 AND type = ${type} ORDER BY sort_order, name`;
    } else {
      items = includeInactive
        ? await sql`SELECT * FROM disciplines ORDER BY sort_order, name`
        : await sql`SELECT * FROM disciplines WHERE is_active = 1 ORDER BY sort_order, name`;
    }

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/disciplines error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    const missing = validateRequired(body, ['name']);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const typeErr = validateEnum(body.type, ['discipline', 'value'], 'type');
    if (typeErr) return NextResponse.json({ error: typeErr }, { status: 400 });

    const freqErr = validateEnum(body.frequency, ['daily', 'weekly'], 'frequency');
    // frequency can also be a JSON days array, so only validate if it's a simple string
    if (freqErr && !body.frequency?.startsWith('[')) {
      return NextResponse.json({ error: freqErr }, { status: 400 });
    }

    const todErr = validateEnum(body.time_of_day, ['morning', 'shutdown'], 'time_of_day');
    if (todErr) return NextResponse.json({ error: todErr }, { status: 400 });

    const now = nowLocal();
    await sql`
      INSERT INTO disciplines (id, name, type, description, frequency, time_of_day, is_active, sort_order, created_at, updated_at)
      VALUES (${id}, ${body.name}, ${body.type || 'discipline'}, ${body.description || null},
              ${body.frequency || 'daily'}, ${body.time_of_day || 'morning'},
              ${body.is_active ?? 1}, ${body.sort_order || 0}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM disciplines WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/disciplines error:', err);
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
      `UPDATE disciplines SET ${upd.fields} WHERE id = $${upd.paramOffset + 1}`,
      [...upd.values, id]
    );

    const rows = await sql`SELECT * FROM disciplines WHERE id = ${id}`;
    return NextResponse.json(rows[0] || { id });
  } catch (err) {
    console.error('PATCH /api/disciplines error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sql`DELETE FROM disciplines WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/disciplines error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
