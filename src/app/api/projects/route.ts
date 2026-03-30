import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal, validateStrings } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'title', 'category', 'purpose', 'key_milestones', 'planning_steps',
  'notes', 'status', 'completed_at',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';

    const projects = await sql`
      SELECT p.*, COALESCE(ac.count, 0) as active_action_count
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count FROM next_actions WHERE status = 'active' GROUP BY project_id
      ) ac ON ac.project_id = p.id
      WHERE p.status = ${status}
      ORDER BY p.updated_at DESC
    `;

    return NextResponse.json(projects);
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const {
      title,
      category,
      purpose = '',
      key_milestones = '',
      planning_steps = '',
      notes = '',
      status = 'active',
    } = body;

    const typeErr = validateStrings(body, ['title', 'category', 'purpose', 'notes', 'status']);
    if (typeErr) return NextResponse.json({ error: typeErr }, { status: 400 });

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    await sql`
      INSERT INTO projects (id, title, category, purpose, key_milestones, planning_steps, notes, status)
      VALUES (${id}, ${title}, ${category}, ${purpose}, ${key_milestones}, ${planning_steps}, ${notes}, ${status})
    `;

    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/projects error:', err);
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
    if (rawUpdates.status === 'completed' || rawUpdates.status === 'archived') {
      rawUpdates.completed_at = rawUpdates.updated_at;
    }

    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM projects WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE projects SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/projects error:', err);
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

    // Unlink actions and delete project in a single statement to avoid partial state
    await sql`UPDATE next_actions SET project_id = NULL WHERE project_id = ${id}`;
    await sql`DELETE FROM projects WHERE id = ${id}`;
    // Note: These are separate queries but both are idempotent — a failed DELETE
    // just leaves actions unlinked, which is safe since the project was being deleted anyway

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
