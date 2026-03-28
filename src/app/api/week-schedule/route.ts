import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { nowCentral } from '@/lib/api-helpers';
import { getMonday, resolvePatternId } from '@/lib/pattern-resolver';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);

    // If requesting current/today's schedule
    if (searchParams.get('current') === 'true') {
      const ct = nowCentral();
      const weekStart = getMonday(ct.date);
      const patternId = await resolvePatternId(weekStart);

      if (!patternId) {
        return NextResponse.json({ pattern: null, blocks: [], week_start: weekStart });
      }

      const patternRows = await sql`SELECT * FROM week_patterns WHERE id = ${patternId}`;
      const blocks = await sql`
        SELECT * FROM week_pattern_blocks WHERE pattern_id = ${patternId}
        ORDER BY day_of_week, start_time, sort_order
      `;

      type ScheduleBlock = { id: string; day_of_week: number; start_time: string; end_time: string; label: string; description: string | null; is_non_negotiable: number; sort_order: number };

      // Get today's blocks specifically
      const todayBlocks = (blocks as ScheduleBlock[])
        .filter(b => b.day_of_week === ct.dayOfWeek);

      // Find current and next block
      const timeStr = ct.timeStr;
      const currentBlock = todayBlocks
        .find(b => timeStr >= b.start_time && timeStr < b.end_time) || null;
      const currentIndex = currentBlock ? todayBlocks.indexOf(currentBlock) : -1;
      let nextBlock = null;
      if (currentIndex >= 0 && currentIndex < todayBlocks.length - 1) {
        nextBlock = todayBlocks[currentIndex + 1];
      } else if (!currentBlock) {
        nextBlock = todayBlocks
          .find(b => b.start_time > timeStr) || null;
      }

      return NextResponse.json({
        pattern: patternRows[0] || null,
        blocks: todayBlocks,
        all_blocks: blocks,
        current_block: currentBlock,
        next_block: nextBlock,
        week_start: weekStart,
        current_time: timeStr,
      });
    }

    // Otherwise return all schedule assignments
    const assignments = await sql`
      SELECT ws.*, wp.name as pattern_name
      FROM week_schedule ws
      JOIN week_patterns wp ON ws.pattern_id = wp.id
      ORDER BY ws.week_start DESC
      LIMIT 52
    `;

    const rotationRows = await sql`SELECT * FROM week_pattern_rotation WHERE is_active = 1 LIMIT 1`;

    return NextResponse.json({
      assignments,
      rotation: rotationRows[0] || null,
    });
  } catch (err) {
    console.error('GET /api/week-schedule error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    // Assign a pattern to a specific week
    if (body.action === 'assign') {
      if (!body.week_start || !body.pattern_id) {
        return NextResponse.json({ error: 'week_start and pattern_id are required' }, { status: 400 });
      }
      const id = uuid();
      await sql`
        INSERT INTO week_schedule (id, week_start, pattern_id)
        VALUES (${id}, ${body.week_start}, ${body.pattern_id})
        ON CONFLICT (week_start) DO UPDATE SET pattern_id = ${body.pattern_id}
      `;
      return NextResponse.json({ success: true, id });
    }

    // Set up or update rotation
    if (body.action === 'set_rotation') {
      if (!body.pattern_ids || !Array.isArray(body.pattern_ids) || body.pattern_ids.length === 0) {
        return NextResponse.json({ error: 'pattern_ids array is required' }, { status: 400 });
      }
      if (!body.start_date) {
        return NextResponse.json({ error: 'start_date is required' }, { status: 400 });
      }

      // Deactivate existing rotations
      await sql`UPDATE week_pattern_rotation SET is_active = 0`;

      const id = uuid();
      const patternIdsJson = JSON.stringify(body.pattern_ids);
      await sql`
        INSERT INTO week_pattern_rotation (id, name, pattern_ids, start_date, is_active)
        VALUES (${id}, ${body.name || 'Rotation'}, ${patternIdsJson}, ${body.start_date}, 1)
      `;
      return NextResponse.json({ success: true, id });
    }

    // Clear rotation
    if (body.action === 'clear_rotation') {
      await sql`UPDATE week_pattern_rotation SET is_active = 0`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action. Use assign, set_rotation, or clear_rotation.' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/week-schedule error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week_start');

    if (!weekStart) {
      return NextResponse.json({ error: 'week_start is required' }, { status: 400 });
    }

    await sql`DELETE FROM week_schedule WHERE week_start = ${weekStart}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/week-schedule error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
