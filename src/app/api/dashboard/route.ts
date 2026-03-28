import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';
import { getMonday, resolvePatternId } from '@/lib/pattern-resolver';
import { v4 as uuid } from 'uuid';

/** Ensure daily_blocks exist for the given date, hydrating from ideal calendar if needed */
async function ensureDailyBlocks(date: string, dayOfWeek: number) {
  let blocks = await sql`SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time`;

  if (blocks.length === 0) {
    // Hydrate from ideal calendar
    const weekStart = getMonday(new Date(date + 'T12:00:00'));
    const patternId = await resolvePatternId(weekStart);

    if (patternId) {
      const templateBlocks = await sql`
        SELECT * FROM week_pattern_blocks
        WHERE pattern_id = ${patternId} AND day_of_week = ${dayOfWeek}
        ORDER BY start_time, sort_order
      `;

      for (const tb of templateBlocks) {
        const id = uuid();
        await sql`
          INSERT INTO daily_blocks (id, date, start_time, end_time, label, description, is_non_negotiable, source_block_id)
          VALUES (${id}, ${date}, ${tb.start_time}, ${tb.end_time}, ${tb.label}, ${tb.description || null}, ${tb.is_non_negotiable || 0}, ${tb.id})
        `;
      }

      blocks = await sql`SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time`;
    }
  }

  return blocks;
}

export async function GET() {
  try {
    await ensureDb();

    const ct = nowCentral();
    const dayName = ct.weekday;
    const timeStr = ct.timeStr;
    const today = ct.dateStr;

    // Get daily blocks (hydrates from ideal calendar if needed)
    const blocks = await ensureDailyBlocks(today, ct.dayOfWeek) as Array<{
      id: string; start_time: string; end_time: string; label: string;
      description: string; is_non_negotiable: number;
    }>;

    // Get pattern name for display
    const weekStart = getMonday(ct.date);
    const patternId = await resolvePatternId(weekStart);
    let patternName: string | null = null;
    if (patternId) {
      const patternRows = await sql`SELECT name FROM week_patterns WHERE id = ${patternId}`;
      patternName = patternRows.length > 0 ? patternRows[0].name as string : null;
    }

    const currentBlock = blocks.find(b => timeStr >= b.start_time && timeStr < b.end_time) || null;
    const currentBlockIndex = currentBlock ? blocks.indexOf(currentBlock) : -1;
    let nextBlock = null;
    if (currentBlockIndex >= 0 && currentBlockIndex < blocks.length - 1) {
      nextBlock = blocks[currentBlockIndex + 1];
    } else if (!currentBlock) {
      nextBlock = blocks.find(b => b.start_time > timeStr) || null;
    }

    const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
    const inboxCount = Number(inboxCountResult[0].count);

    const contextCountRows = await sql`
      SELECT context, COUNT(*) as count FROM next_actions WHERE status = 'active' GROUP BY context
    ` as Array<{ context: string; count: string }>;
    const actionCounts: Record<string, number> = {};
    for (const row of contextCountRows) {
      actionCounts[row.context] = Number(row.count);
    }

    const activeProjects = await sql`SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC` as Array<{ id: string; title: string; category: string }>;

    const stalledProjects = [];
    for (const p of activeProjects) {
      const countResult = await sql`SELECT COUNT(*) as count FROM next_actions WHERE project_id = ${p.id} AND status = 'active'`;
      if (Number(countResult[0].count) === 0) {
        stalledProjects.push(p);
      }
    }

    const dailyNoteRows = await sql`SELECT * FROM daily_notes WHERE date = ${today}`;
    const dailyNote = dailyNoteRows[0] as {
      top3_first: string | null;
      top3_second: string | null;
      top3_third: string | null;
    } | undefined;

    const sevenDaysAgoDate = new Date(ct.date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = `${sevenDaysAgoDate.getFullYear()}-${String(sevenDaysAgoDate.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgoDate.getDate()).padStart(2, '0')}`;
    const staleWaiting = await sql`
      SELECT * FROM next_actions WHERE context = 'waiting_for' AND status = 'active' AND waiting_since IS NOT NULL AND waiting_since <= ${sevenDaysAgo}
    ` as Array<{ content: string; waiting_on_person: string | null; waiting_since: string }>;

    // Discipline progress for today
    let disciplinesDone = 0;
    let disciplinesTotal = 0;
    try {
      const activeDisciplines = await sql`SELECT COUNT(*) as count FROM disciplines WHERE is_active = 1`;
      disciplinesTotal = Number(activeDisciplines[0]?.count || 0);

      if (disciplinesTotal > 0) {
        const completedToday = await sql`
          SELECT COUNT(*) as count FROM discipline_logs dl
          JOIN disciplines d ON dl.discipline_id = d.id
          WHERE dl.date = ${today} AND dl.completed = 1 AND d.is_active = 1
        `;
        disciplinesDone = Number(completedToday[0]?.count || 0);
      }
    } catch {
      // Table may not exist yet for existing installs before migration runs
    }

    return NextResponse.json({
      date: today,
      day_name: dayName,
      pattern_name: patternName,
      current_time: timeStr,
      current_block: currentBlock,
      next_block: nextBlock,
      blocks,
      inbox_count: inboxCount,
      action_counts: actionCounts,
      total_actions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
      active_project_count: activeProjects.length,
      stalled_projects: stalledProjects,
      daily_note: dailyNote || null,
      stale_waiting: staleWaiting,
      disciplines_done: disciplinesDone,
      disciplines_total: disciplinesTotal,
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
