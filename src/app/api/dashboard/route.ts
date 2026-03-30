import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';
import { getMonday, resolvePatternId } from '@/lib/pattern-resolver';
import { v4 as uuid } from 'uuid';

/** Ensure daily_blocks exist for the given date, hydrating from ideal calendar if needed */
// Lock to prevent double hydration from concurrent requests
let hydrationInProgress: Promise<unknown> | null = null;

async function ensureDailyBlocks(date: string, dayOfWeek: number) {
  let blocks = await sql`SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time`;

  if (blocks.length === 0) {
    // Prevent double hydration from concurrent dashboard + daily-blocks requests
    if (hydrationInProgress) {
      await hydrationInProgress;
      return sql`SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time`;
    }

    hydrationInProgress = (async () => {
      try {
        // Re-check after acquiring "lock" to handle race
        const recheck = await sql`SELECT COUNT(*) as count FROM daily_blocks WHERE date = ${date}`;
        if (Number(recheck[0].count) > 0) return;

        const weekStart = getMonday(new Date(date + 'T12:00:00'));
        const patternId = await resolvePatternId(weekStart);

        if (patternId) {
          const templateBlocks = await sql`
            SELECT * FROM week_pattern_blocks
            WHERE pattern_id = ${patternId} AND day_of_week = ${dayOfWeek}
            ORDER BY start_time, sort_order
          `;

          if (templateBlocks.length > 0) {
            const placeholders: string[] = [];
            const values: unknown[] = [];
            let idx = 1;
            for (const tb of templateBlocks) {
              const id = uuid();
              placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7})`);
              values.push(id, date, tb.start_time, tb.end_time, tb.label, tb.description || null, tb.is_non_negotiable || 0, tb.id);
              idx += 8;
            }
            await sql.query(
              `INSERT INTO daily_blocks (id, date, start_time, end_time, label, description, is_non_negotiable, source_block_id) VALUES ${placeholders.join(', ')}`,
              values
            );
          }
        }
      } finally {
        hydrationInProgress = null;
      }
    })();

    await hydrationInProgress;
    blocks = await sql`SELECT * FROM daily_blocks WHERE date = ${date} ORDER BY start_time`;
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

    // Parallelize all independent queries (was ~12 sequential round-trips, now ~2)
    const yesterdayDate = new Date(ct.date.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getUTCDate()).padStart(2, '0')}`;

    const [
      inboxCountResult,
      contextCountRows,
      activeProjects,
      stalledProjects,
      dailyNoteRows,
      yesterdayNoteRows,
      thresholdRows,
      activeDisciplines,
      logsToday,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`,
      sql`SELECT context, COUNT(*) as count FROM next_actions WHERE status = 'active' GROUP BY context`,
      sql`SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC`,
      sql`
        SELECT p.id, p.title, p.category FROM projects p
        LEFT JOIN next_actions a ON a.project_id = p.id AND a.status = 'active'
        WHERE p.status = 'active'
        GROUP BY p.id, p.title, p.category
        HAVING COUNT(a.id) = 0
      `,
      sql`SELECT * FROM daily_notes WHERE date = ${today}`,
      sql`SELECT evening_do_differently FROM daily_notes WHERE date = ${yesterday}`,
      sql`SELECT key, value FROM settings WHERE key IN ('alert_inbox_threshold', 'alert_waiting_days', 'last_weekly_review')`,
      sql`SELECT id, name FROM disciplines WHERE is_active = 1 ORDER BY sort_order, name`,
      sql`SELECT discipline_id, completed FROM discipline_logs WHERE date = ${today}`,
    ]);

    const inboxCount = Number(inboxCountResult[0].count);

    const actionCounts: Record<string, number> = {};
    for (const row of contextCountRows as Array<{ context: string; count: string }>) {
      actionCounts[row.context] = Number(row.count);
    }

    const dailyNote = dailyNoteRows[0] as {
      top3_first: string | null;
      top3_second: string | null;
      top3_third: string | null;
    } | undefined;

    const doDifferentlyToday = (yesterdayNoteRows[0] as { evening_do_differently: string | null } | undefined)?.evening_do_differently || null;

    // Alert thresholds
    const thresholdMap = new Map((thresholdRows as Array<{ key: string; value: string }>).map(r => [r.key, r.value]));
    const inboxThreshold = Number(thresholdMap.get('alert_inbox_threshold')) || 10;
    const waitingDays = Number(thresholdMap.get('alert_waiting_days')) || 7;

    // Stale waiting-for (depends on waitingDays from settings, so runs after)
    const staleDate = new Date(ct.date.getTime() - waitingDays * 24 * 60 * 60 * 1000);
    const staleDateStr = `${staleDate.getUTCFullYear()}-${String(staleDate.getUTCMonth() + 1).padStart(2, '0')}-${String(staleDate.getUTCDate()).padStart(2, '0')}`;
    const staleWaiting = await sql`
      SELECT * FROM next_actions WHERE context = 'waiting_for' AND status = 'active' AND waiting_since IS NOT NULL AND waiting_since <= ${staleDateStr}
    ` as Array<{ content: string; waiting_on_person: string | null; waiting_since: string }>;

    // Discipline progress for today
    let disciplinesDone = 0;
    const disciplinesTotal = (activeDisciplines as Array<{ id: string; name: string }>).length;
    let disciplineItems: Array<{ id: string; name: string; completed: boolean }> = [];
    if (disciplinesTotal > 0) {
      const logMap = new Map((logsToday as Array<{ discipline_id: string; completed: number }>).map(l => [l.discipline_id, l.completed === 1]));
      disciplineItems = (activeDisciplines as Array<{ id: string; name: string }>).map(d => ({
        id: d.id,
        name: d.name,
        completed: logMap.get(d.id) || false,
      }));
      disciplinesDone = disciplineItems.filter(d => d.completed).length;
    }

    // Weekly review overdue check (uses last_weekly_review already fetched in thresholdRows)
    let daysSinceWeeklyReview: number | null = null;
    const lastReviewValue = thresholdMap.get('last_weekly_review');
    if (lastReviewValue) {
      const lastReview = new Date(lastReviewValue);
      daysSinceWeeklyReview = Math.floor((ct.date.getTime() - lastReview.getTime()) / (24 * 60 * 60 * 1000));
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
      inbox_threshold: inboxThreshold,
      waiting_days: waitingDays,
      action_counts: actionCounts,
      total_actions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
      active_project_count: activeProjects.length,
      stalled_projects: stalledProjects,
      daily_note: dailyNote || null,
      stale_waiting: staleWaiting,
      days_since_weekly_review: daysSinceWeeklyReview,
      do_differently_today: doDifferentlyToday,
      disciplines_done: disciplinesDone,
      disciplines_total: disciplinesTotal,
      discipline_items: disciplineItems,
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
