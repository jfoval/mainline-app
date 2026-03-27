import { NextResponse } from 'next/server';
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

/** Resolve which pattern applies for a given week */
async function resolvePatternId(weekStart: string): Promise<string | null> {
  // 1. Explicit assignment
  const explicit = await sql`SELECT pattern_id FROM week_schedule WHERE week_start = ${weekStart}`;
  if (explicit.length > 0) return explicit[0].pattern_id as string;

  // 2. Active rotation
  const rotationRows = await sql`SELECT * FROM week_pattern_rotation WHERE is_active = 1 LIMIT 1`;
  if (rotationRows.length > 0) {
    const rotation = rotationRows[0] as { pattern_ids: string; start_date: string };
    try {
      const patternIds = JSON.parse(rotation.pattern_ids) as string[];
      if (patternIds.length > 0) {
        const startDate = new Date(rotation.start_date + 'T12:00:00');
        const weekDate = new Date(weekStart + 'T12:00:00');
        const weeksDiff = Math.round((weekDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const index = ((weeksDiff % patternIds.length) + patternIds.length) % patternIds.length;
        return patternIds[index];
      }
    } catch { /* invalid JSON */ }
  }

  // 3. First pattern
  const firstPattern = await sql`SELECT id FROM week_patterns ORDER BY sort_order, name LIMIT 1`;
  return firstPattern.length > 0 ? firstPattern[0].id as string : null;
}

export async function GET() {
  try {
    await ensureDb();

    const ct = nowCentral();
    const dayName = ct.weekday;
    const timeStr = ct.timeStr;

    // Try week patterns first
    const weekStart = getMonday(ct.date);
    const patternId = await resolvePatternId(weekStart);

    let blocks: Array<{ id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number }> = [];
    let patternName: string | null = null;

    if (patternId) {
      // Use week pattern blocks for today
      const patternRows = await sql`SELECT name FROM week_patterns WHERE id = ${patternId}`;
      patternName = patternRows.length > 0 ? patternRows[0].name as string : null;

      blocks = await sql`
        SELECT * FROM week_pattern_blocks
        WHERE pattern_id = ${patternId} AND day_of_week = ${ct.dayOfWeek}
        ORDER BY start_time, sort_order
      ` as typeof blocks;
    } else {
      // Fallback to legacy routine_blocks if no week patterns exist yet
      let routineType = 'non_girls_week';
      if (ct.dayOfWeek === 0) routineType = 'sunday';
      else if (ct.dayOfWeek === 6) routineType = 'saturday';

      blocks = await sql`
        SELECT * FROM routine_blocks WHERE routine_type = ${routineType} ORDER BY sort_order
      ` as typeof blocks;
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

    const today = ct.dateStr;
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
