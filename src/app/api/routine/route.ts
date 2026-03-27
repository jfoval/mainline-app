import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';

/** Get the Monday of a given week */
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

    // Check explicit assignment
    let patternId: string | null = null;
    const explicit = await sql`SELECT pattern_id FROM week_schedule WHERE week_start = ${weekStart}`;
    if (explicit.length > 0) {
      patternId = explicit[0].pattern_id as string;
    } else {
      // Check rotation
      const rotationRows = await sql`SELECT * FROM week_pattern_rotation WHERE is_active = 1 LIMIT 1`;
      if (rotationRows.length > 0) {
        const rotation = rotationRows[0] as { pattern_ids: string; start_date: string };
        try {
          const ids = JSON.parse(rotation.pattern_ids) as string[];
          if (ids.length > 0) {
            const startDate = new Date(rotation.start_date + 'T12:00:00');
            const weekDate = new Date(weekStart + 'T12:00:00');
            const weeksDiff = Math.round((weekDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            const index = ((weeksDiff % ids.length) + ids.length) % ids.length;
            patternId = ids[index];
          }
        } catch { /* */ }
      } else {
        // Fall back to first pattern
        const first = await sql`SELECT id FROM week_patterns ORDER BY sort_order, name LIMIT 1`;
        if (first.length > 0) patternId = first[0].id as string;
      }
    }

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
