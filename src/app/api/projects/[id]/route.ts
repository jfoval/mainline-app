import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = [
  'title', 'category', 'purpose', 'key_milestones', 'planning_steps',
  'notes', 'status', 'completed_at',
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
    const { id } = await params;

    const projects = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (projects.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const actions = await sql`
      SELECT * FROM next_actions WHERE project_id = ${id} ORDER BY status, added_at DESC
    `;

    return NextResponse.json({ project: projects[0], actions });
  } catch (err) {
    console.error('GET /api/projects/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
    const { id } = await params;
    const body = await req.json();
    const { _base_updated_at, ...rawUpdates } = body;

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
    console.error('PATCH /api/projects/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
