import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowCentral } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = ['content', 'area', 'cadence', 'last_triggered', 'sort_order'];

export async function GET() {
  try {
    await ensureDb();
    const tasks = await sql`SELECT * FROM recurring_tasks ORDER BY cadence, area, sort_order`;
    return NextResponse.json(tasks);
  } catch (err) {
    console.error('GET /api/recurring-tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    if (!body.content || !body.content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const id = uuid();
    await sql`
      INSERT INTO recurring_tasks (id, content, area, cadence, sort_order)
      VALUES (${id}, ${body.content.trim()}, ${body.area || 'business'}, ${body.cadence || 'weekly'}, ${body.sort_order || 0})
    `;
    const rows = await sql`SELECT * FROM recurring_tasks WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/recurring-tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, _base_updated_at, ...rawUpdates } = body;

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM recurring_tasks WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    if (rawUpdates.last_triggered === 'now') {
      rawUpdates.last_triggered = nowCentral().dateStr;
    }
    const update = buildUpdate(rawUpdates, ALLOWED_PATCH_FIELDS);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE recurring_tasks SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM recurring_tasks WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/recurring-tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) await sql`DELETE FROM recurring_tasks WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/recurring-tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
