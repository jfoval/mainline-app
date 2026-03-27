import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const patternId = searchParams.get('pattern_id');

    if (!patternId) {
      return NextResponse.json({ error: 'pattern_id is required' }, { status: 400 });
    }

    const blocks = await sql`
      SELECT * FROM week_pattern_blocks WHERE pattern_id = ${patternId}
      ORDER BY day_of_week, start_time, sort_order
    `;
    return NextResponse.json(blocks);
  } catch (err) {
    console.error('GET /api/week-patterns/blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    if (!body.pattern_id || !body.label || body.day_of_week === undefined || !body.start_time || !body.end_time) {
      return NextResponse.json({ error: 'pattern_id, day_of_week, start_time, end_time, and label are required' }, { status: 400 });
    }

    await sql`
      INSERT INTO week_pattern_blocks (id, pattern_id, day_of_week, start_time, end_time, label, description, is_non_negotiable, sort_order)
      VALUES (${id}, ${body.pattern_id}, ${body.day_of_week}, ${body.start_time}, ${body.end_time}, ${body.label}, ${body.description || null}, ${body.is_non_negotiable || 0}, ${body.sort_order || 0})
    `;

    const rows = await sql`SELECT * FROM week_pattern_blocks WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/week-patterns/blocks error:', err);
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

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.day_of_week !== undefined) { fields.push('day_of_week'); values.push(body.day_of_week); }
    if (body.start_time !== undefined) { fields.push('start_time'); values.push(body.start_time); }
    if (body.end_time !== undefined) { fields.push('end_time'); values.push(body.end_time); }
    if (body.label !== undefined) { fields.push('label'); values.push(body.label); }
    if (body.description !== undefined) { fields.push('description'); values.push(body.description); }
    if (body.is_non_negotiable !== undefined) { fields.push('is_non_negotiable'); values.push(body.is_non_negotiable); }
    if (body.sort_order !== undefined) { fields.push('sort_order'); values.push(body.sort_order); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await sql.query(
      `UPDATE week_pattern_blocks SET ${setClauses} WHERE id = $1`,
      [body.id, ...values]
    );

    const rows = await sql`SELECT * FROM week_pattern_blocks WHERE id = ${body.id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/week-patterns/blocks error:', err);
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

    await sql`DELETE FROM week_pattern_blocks WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/week-patterns/blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
