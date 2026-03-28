import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';
import { getMonday, resolvePatternId } from '@/lib/pattern-resolver';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type) {
      const blocks = await sql`
        SELECT * FROM routine_blocks WHERE routine_type = ${type} ORDER BY sort_order
      `;
      return NextResponse.json(blocks);
    }

    const ct = nowCentral();
    const day = ct.dayOfWeek;

    // Try week patterns first
    const weekStart = getMonday(ct.date);
    const patternId = await resolvePatternId(weekStart);

    if (patternId) {
      const patternRows = await sql`SELECT * FROM week_patterns WHERE id = ${patternId}`;
      const blocks = await sql`
        SELECT * FROM week_pattern_blocks WHERE pattern_id = ${patternId} AND day_of_week = ${day}
        ORDER BY start_time, sort_order
      `;
      const currentBlock = (blocks as Array<{ start_time: string; end_time: string }>).find(
        b => ct.timeStr >= b.start_time && ct.timeStr < b.end_time
      );
      return NextResponse.json({
        pattern_name: patternRows[0]?.name || null,
        current_time: ct.timeStr,
        current_block: currentBlock || null,
        blocks,
      });
    }

    // Legacy fallback: use routine_blocks
    let routineType = 'non_girls_week';
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';

    const blocks = await sql`
      SELECT * FROM routine_blocks WHERE routine_type = ${routineType} ORDER BY sort_order
    `;
    const currentBlock = (blocks as Array<{ start_time: string; end_time: string }>).find(
      b => ct.timeStr >= b.start_time && ct.timeStr < b.end_time
    );
    return NextResponse.json({
      routine_type: routineType,
      current_time: ct.timeStr,
      current_block: currentBlock || null,
      blocks,
    });
  } catch (err) {
    console.error('GET /api/routine error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const allowedFields = ['routine_type', 'start_time', 'end_time', 'label', 'description', 'sort_order'];
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(id);
    await sql.query(`UPDATE routine_blocks SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);

    const rows = await sql`SELECT * FROM routine_blocks WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/routine error:', err);
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

    await sql`DELETE FROM routine_blocks WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/routine error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
