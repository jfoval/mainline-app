import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral, nowLocal, validateRequired } from '@/lib/api-helpers';
import { getMonday, resolvePatternId } from '@/lib/pattern-resolver';
import { v4 as uuid } from 'uuid';

/** Hydrate daily_blocks for a date from the active ideal calendar pattern.
 *  Returns the blocks array (possibly empty if no pattern exists). */
async function hydrate(date: string, dayOfWeek: number): Promise<Array<Record<string, unknown>>> {
  const weekStart = getMonday(new Date(date + 'T12:00:00'));
  const patternId = await resolvePatternId(weekStart);

  if (!patternId) return [];

  const templateBlocks = await sql`
    SELECT * FROM week_pattern_blocks
    WHERE pattern_id = ${patternId} AND day_of_week = ${dayOfWeek}
    ORDER BY start_time, sort_order
  `;

  if (templateBlocks.length === 0) return [];

  // Insert copies into daily_blocks
  const inserted = [];
  for (const tb of templateBlocks) {
    const id = uuid();
    await sql`
      INSERT INTO daily_blocks (id, date, start_time, end_time, label, description, is_non_negotiable, source_block_id)
      VALUES (${id}, ${date}, ${tb.start_time}, ${tb.end_time}, ${tb.label}, ${tb.description || null}, ${tb.is_non_negotiable || 0}, ${tb.id})
    `;
    inserted.push({
      id,
      date,
      start_time: tb.start_time,
      end_time: tb.end_time,
      label: tb.label,
      description: tb.description || null,
      is_non_negotiable: tb.is_non_negotiable || 0,
      source_block_id: tb.id,
    });
  }

  return inserted;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(req.url);
    let date = searchParams.get('date');

    if (!date) {
      date = nowCentral().dateStr;
    }

    // Check for existing daily blocks
    let blocks = await sql`
      SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time
    `;

    let hydrated = false;
    if (blocks.length === 0) {
      // Calculate day of week from date
      const d = new Date(date + 'T12:00:00');
      const dayOfWeek = d.getDay();
      blocks = await hydrate(date, dayOfWeek) as typeof blocks;
      hydrated = true;
    }

    // Get pattern name for display
    const ct = nowCentral();
    const weekStart = getMonday(ct.date);
    const patternId = await resolvePatternId(weekStart);
    let patternName: string | null = null;
    if (patternId) {
      const patternRows = await sql`SELECT name FROM week_patterns WHERE id = ${patternId}`;
      patternName = patternRows.length > 0 ? (patternRows[0].name as string) : null;
    }

    return NextResponse.json({ date, blocks, hydrated, pattern_name: patternName });
  } catch (err) {
    console.error('GET /api/daily-blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    const validErr = validateRequired(body, ['date', 'start_time', 'end_time', 'label']);
    if (validErr) return NextResponse.json({ error: validErr }, { status: 400 });

    const id = body.id || uuid();
    await sql`
      INSERT INTO daily_blocks (id, date, start_time, end_time, label, description, is_non_negotiable, source_block_id)
      VALUES (${id}, ${body.date}, ${body.start_time}, ${body.end_time}, ${body.label}, ${body.description || null}, ${body.is_non_negotiable || 0}, ${body.source_block_id || null})
    `;

    const rows = await sql`SELECT * FROM daily_blocks WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/daily-blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const allowed = ['start_time', 'end_time', 'label', 'description', 'is_non_negotiable'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (field in body) {
        sets.push(`${field} = $${idx}`);
        vals.push(body[field]);
        idx++;
      }
    }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    sets.push(`updated_at = $${idx}`);
    vals.push(nowLocal());
    idx++;
    vals.push(body.id);

    await sql.query(
      `UPDATE daily_blocks SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    );

    const rows = await sql`SELECT * FROM daily_blocks WHERE id = ${body.id}`;
    return NextResponse.json(rows[0] || { id: body.id });
  } catch (err) {
    console.error('PATCH /api/daily-blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sql`DELETE FROM daily_blocks WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/daily-blocks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
