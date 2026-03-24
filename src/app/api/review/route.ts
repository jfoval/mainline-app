import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'weekly';

    const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
    const inboxCount = Number(inboxCountResult[0].count);

    const activeProjects = await sql`
      SELECT p.*, (SELECT COUNT(*) FROM next_actions WHERE project_id = p.id AND status = 'active') as active_action_count
      FROM projects p WHERE p.status = 'active' ORDER BY p.category, p.title
    ` as Array<{ id: string; title: string; category: string; purpose: string; active_action_count: number; updated_at: string }>;

    const stalledProjects = activeProjects.filter(p => Number(p.active_action_count) === 0);

    const somedayProjects = await sql`SELECT * FROM projects WHERE status = 'someday_maybe' ORDER BY category, title`;

    const allActions = await sql`
      SELECT * FROM next_actions WHERE status = 'active' ORDER BY context, added_at
    ` as Array<{
      id: string; content: string; context: string; project_id: string; waiting_on_person: string;
      waiting_since: string; agenda_person: string; added_at: string;
    }>;

    const waitingFor = allActions.filter(a => a.context === 'waiting_for');
    const agendas = allActions.filter(a => a.context === 'agendas');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const staleWaiting = waitingFor.filter(a => a.waiting_since && a.waiting_since <= sevenDaysAgo);

    const recurringTasks = await sql`SELECT * FROM recurring_tasks ORDER BY cadence, area, sort_order`;

    const activeDeals = await sql`SELECT * FROM pipeline_deals WHERE stage NOT IN ('closed_won', 'closed_lost') ORDER BY stage, updated_at DESC`;
    const warmLeads = await sql`SELECT * FROM pipeline_warm_leads ORDER BY added_at DESC`;

    const offerings = await sql`SELECT * FROM offerings ORDER BY CASE readiness WHEN 'ready_to_sell' THEN 1 WHEN 'building_now' THEN 2 WHEN 'designed' THEN 3 WHEN 'concept' THEN 4 WHEN 'long_horizon' THEN 5 END`;

    const horizons = await sql`SELECT * FROM horizons ORDER BY type`;

    const actionCounts: Record<string, number> = {};
    const contexts = ['work', 'errands', 'home', 'waiting_for', 'agendas', 'haley', 'prayers'];
    for (const ctx of contexts) {
      actionCounts[ctx] = allActions.filter(a => a.context === ctx).length;
    }

    const result: Record<string, unknown> = {
      type,
      inbox_count: inboxCount,
      active_projects: activeProjects,
      stalled_projects: stalledProjects,
      someday_projects: somedayProjects,
      all_actions: allActions,
      action_counts: actionCounts,
      total_actions: allActions.length,
      waiting_for: waitingFor,
      stale_waiting: staleWaiting,
      agendas,
      recurring_tasks: recurringTasks,
      active_deals: activeDeals,
      warm_leads: warmLeads,
      offerings,
    };

    if (type === 'monthly') {
      result.horizons = horizons;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      result.recent_daily_notes = await sql`SELECT * FROM daily_notes WHERE date >= ${thirtyDaysAgo} ORDER BY date DESC`;

      const currentMonth = nowCentral().dateStr.slice(0, 7);
      const healthRows = await sql`SELECT * FROM health_log WHERE month = ${currentMonth}`;
      result.health_log = healthRows[0] || null;

      const bizHealthRows = await sql`SELECT * FROM business_health_log WHERE month = ${currentMonth}`;
      result.business_health = bizHealthRows[0] || null;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    const key = body.type === 'monthly' ? 'last_monthly_review' : 'last_weekly_review';
    const ct = nowCentral();
    const now = ct.timestamp;
    await sql`INSERT INTO settings (key, value) VALUES (${key}, ${now}) ON CONFLICT (key) DO UPDATE SET value = ${now}`;

    if (body.notes) {
      const notesKey = `${body.type}_review_notes_${ct.dateStr}`;
      const notesJson = JSON.stringify(body.notes);
      await sql`INSERT INTO settings (key, value) VALUES (${notesKey}, ${notesJson}) ON CONFLICT (key) DO UPDATE SET value = ${notesJson}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
