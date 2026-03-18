import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'title', 'category', 'purpose', 'key_milestones', 'planning_steps',
  'notes', 'status', 'completed_at',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';

    const projects = await sql`SELECT * FROM projects WHERE status = ${status} ORDER BY updated_at DESC`;

    const result = [];
    for (const p of projects) {
      const countResult = await sql`SELECT COUNT(*) as count FROM next_actions WHERE project_id = ${p.id} AND status = 'active'`;
      result.push({ ...p, active_action_count: Number(countResult[0].count) });
    }

    return NextResponse.json(result);
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
