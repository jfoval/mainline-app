import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { nowLocal } from '@/lib/api-helpers';

export async function GET() {
  try {
    await ensureDb();
    const patterns = await sql`
      SELECT wp.*,
        (SELECT COUNT(*) FROM week_pattern_blocks WHERE pattern_id = wp.id) as block_count
      FROM week_patterns wp
      ORDER BY wp.sort_order, wp.name
    `;

    // For each pattern, include its blocks
    const result = [];
    for (const p of patterns) {
      const blocks = await sql`
        SELECT * FROM week_pattern_blocks WHERE pattern_id = ${p.id} ORDER BY day_of_week, start_time, sort_order
      `;
      result.push({ ...p, blocks });
    }

    // Also get the active rotation
    const rotationRows = await sql`SELECT * FROM week_pattern_rotation WHERE is_active = 1 LIMIT 1`;
    const rotation = rotationRows[0] || null;

    return NextResponse.json({ patterns: result, rotation });
  } catch (err) {
    console.error('GET /api/week-patterns error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const now = nowLocal();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    await sql`
      INSERT INTO week_patterns (id, name, description, sort_order, created_at, updated_at)
      VALUES (${id}, ${body.name}, ${body.description || null}, ${body.sort_order || 0}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM week_patterns WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/week-patterns error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const now = nowLocal();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push('name'); values.push(body.name); }
    if (body.description !== undefined) { fields.push('description'); values.push(body.description); }
    if (body.sort_order !== undefined) { fields.push('sort_order'); values.push(body.sort_order); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at');
    values.push(now);

    // Build dynamic update
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await sql.query(
      `UPDATE week_patterns SET ${setClauses} WHERE id = $1`,
      [body.id, ...values]
    );

    const rows = await sql`SELECT * FROM week_patterns WHERE id = ${body.id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/week-patterns error:', err);
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

    // Check if pattern is in use by any schedule
    const inUse = await sql`SELECT COUNT(*) as count FROM week_schedule WHERE pattern_id = ${id}`;
    if (Number(inUse[0].count) > 0) {
      return NextResponse.json({ error: 'Pattern is assigned to a week schedule. Remove the assignment first.' }, { status: 400 });
    }

    // Blocks are deleted by CASCADE
    await sql`DELETE FROM week_patterns WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/week-patterns error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
