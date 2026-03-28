import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal, validateRequired } from '@/lib/api-helpers';

// Context validation removed — users can define their own context lists (Phase 5)
// Any non-empty string is valid as a context

const ALLOWED_PATCH_FIELDS = [
  'content', 'context', 'project_id', 'status', 'completed_at',
  'waiting_on_person', 'waiting_since', 'agenda_person', 'sort_order',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context');
    const status = searchParams.get('status') || 'active';

    let items;
    if (context) {
      items = await sql`
        SELECT na.*, p.title as project_title
        FROM next_actions na LEFT JOIN projects p ON na.project_id = p.id
        WHERE na.status = ${status} AND na.context = ${context}
        ORDER BY na.sort_order, na.added_at DESC
      `;
    } else {
      items = await sql`
        SELECT na.*, p.title as project_title
        FROM next_actions na LEFT JOIN projects p ON na.project_id = p.id
        WHERE na.status = ${status}
        ORDER BY na.sort_order, na.added_at DESC
      `;
    }

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/actions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    const missing = validateRequired(body, ['content', 'context']);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const {
      content,
      context,
      project_id = null,
      waiting_on_person = null,
      waiting_since = null,
      agenda_person = null,
    } = body;

    await sql`
      INSERT INTO next_actions (id, content, context, project_id, waiting_on_person, waiting_since, agenda_person)
      VALUES (${id}, ${content}, ${context}, ${project_id}, ${waiting_on_person}, ${waiting_since}, ${agenda_person})
    `;

    const rows = await sql`SELECT * FROM next_actions WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/actions error:', err);
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

    if (rawUpdates.status === 'completed') {
      rawUpdates.completed_at = nowLocal();
    }
    rawUpdates.updated_at = nowLocal();

    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM next_actions WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE next_actions SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM next_actions WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/actions error:', err);
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

    await sql`DELETE FROM next_actions WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/actions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
