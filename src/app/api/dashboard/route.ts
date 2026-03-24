import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { isGirlsWeek as checkGirlsWeek } from '@/lib/girls-week';
import { nowCentral } from '@/lib/api-helpers';

export async function GET() {
  try {
    await ensureDb();

    const ct = nowCentral();
    const isGirlsWeek = checkGirlsWeek(ct.date);

    const day = ct.dayOfWeek;
    const dayName = ct.weekday;

    let routineType: string;
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';
    else routineType = isGirlsWeek ? 'girls_week' : 'non_girls_week';

    const blocks = await sql`
      SELECT * FROM routine_blocks WHERE routine_type = ${routineType} ORDER BY sort_order
    ` as Array<{ id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number }>;

    const timeStr = ct.timeStr;
    const currentBlock = blocks.find(b => timeStr >= b.start_time && timeStr < b.end_time) || null;
    const currentBlockIndex = currentBlock ? blocks.indexOf(currentBlock) : -1;
    let nextBlock = null;
    if (currentBlockIndex >= 0 && currentBlockIndex < blocks.length - 1) {
      nextBlock = blocks[currentBlockIndex + 1];
    } else if (!currentBlock) {
      nextBlock = blocks.find(b => b.start_time > timeStr) || null;
    }

    const themes: Record<string, string> = {
      Monday: 'Business Development — outreach, pipeline, networking',
      Tuesday: 'Nurik IP — methodology, training materials, SOPs, offering builds',
      Wednesday: 'Business Development — outreach, pipeline, networking',
      Thursday: 'Research & Learning — AI updates, tools, skills, professional development',
      Friday: 'Operations & Admin — bookkeeping, filing, system maintenance',
    };
    const todayTheme = themes[dayName] || null;

    const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
    const inboxCount = Number(inboxCountResult[0].count);

    const actionCounts: Record<string, number> = {};
    const contexts = ['work', 'errands', 'home', 'waiting_for', 'agendas', 'haley', 'prayers'];
    for (const ctx of contexts) {
      const result = await sql`SELECT COUNT(*) as count FROM next_actions WHERE context = ${ctx} AND status = 'active'`;
      actionCounts[ctx] = Number(result[0].count);
    }

    const activeProjects = await sql`SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC` as Array<{ id: string; title: string; category: string }>;

    const stalledProjects = [];
    for (const p of activeProjects) {
      const countResult = await sql`SELECT COUNT(*) as count FROM next_actions WHERE project_id = ${p.id} AND status = 'active'`;
      if (Number(countResult[0].count) === 0) {
        stalledProjects.push(p);
      }
    }

    const activeDeals = await sql`
      SELECT * FROM pipeline_deals WHERE stage NOT IN ('closed_won', 'closed_lost') ORDER BY updated_at DESC
    ` as Array<{ company: string; stage: string; next_action: string | null; value: string | null }>;

    const warmLeads = await sql`SELECT * FROM pipeline_warm_leads ORDER BY added_at DESC` as Array<{ name: string; company: string | null; interest: string | null }>;

    const buildingNow = await sql`
      SELECT * FROM offerings WHERE readiness = 'building_now'
    ` as Array<{ name: string; build_status: string | null; target_ready_date: string | null }>;

    const readyToSell = await sql`
      SELECT * FROM offerings WHERE readiness = 'ready_to_sell'
    ` as Array<{ name: string }>;

    let revenueFocus = '';
    let revenuePriority = 0;

    const clientActions = await sql`
      SELECT na.content, p.title FROM next_actions na JOIN projects p ON na.project_id = p.id WHERE p.category = 'nurik' AND na.status = 'active' AND na.context = 'work' ORDER BY na.added_at LIMIT 5
    ` as Array<{ content: string; title: string }>;

    if (activeDeals.length > 0) {
      const urgentDeal = activeDeals.find(d => d.next_action);
      if (urgentDeal) {
        revenueFocus = `Client/Deal: ${urgentDeal.company} — ${urgentDeal.next_action}`;
        revenuePriority = 1;
      }
    }

    if (!revenueFocus && warmLeads.length > 0) {
      revenueFocus = `Warm Prospect: Follow up with ${warmLeads[0].name}${warmLeads[0].company ? ` at ${warmLeads[0].company}` : ''}`;
      revenuePriority = 2;
    }

    if (!revenueFocus && buildingNow.length > 0) {
      revenueFocus = `Build: ${buildingNow[0].name}${buildingNow[0].build_status ? ` (${buildingNow[0].build_status})` : ''}`;
      revenuePriority = 3;
    }

    if (!revenueFocus) {
      revenueFocus = 'No active deals, warm leads, or offerings in progress. Consider outreach or content.';
      revenuePriority = 4;
    }

    const today = ct.dateStr;
    const dailyNoteRows = await sql`SELECT * FROM daily_notes WHERE date = ${today}`;
    const dailyNote = dailyNoteRows[0] as {
      top3_revenue: string | null;
      top3_second: string | null;
      top3_third: string | null;
    } | undefined;

    const sevenDaysAgoDate = new Date(ct.date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = `${sevenDaysAgoDate.getFullYear()}-${String(sevenDaysAgoDate.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgoDate.getDate()).padStart(2, '0')}`;
    const staleWaiting = await sql`
      SELECT * FROM next_actions WHERE context = 'waiting_for' AND status = 'active' AND waiting_since IS NOT NULL AND waiting_since <= ${sevenDaysAgo}
    ` as Array<{ content: string; waiting_on_person: string | null; waiting_since: string }>;

    return NextResponse.json({
      is_girls_week: isGirlsWeek,
      day_name: dayName,
      routine_type: routineType,
      current_time: timeStr,
      current_block: currentBlock,
      next_block: nextBlock,
      blocks,
      today_theme: todayTheme,
      inbox_count: inboxCount,
      action_counts: actionCounts,
      total_actions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
      active_project_count: activeProjects.length,
      stalled_projects: stalledProjects,
      revenue: {
        focus: revenueFocus,
        priority_level: revenuePriority,
        active_deals: activeDeals,
        warm_leads: warmLeads,
        building_now: buildingNow,
        ready_to_sell: readyToSell,
      },
      daily_note: dailyNote || null,
      stale_waiting: staleWaiting,
      client_actions: clientActions,
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
