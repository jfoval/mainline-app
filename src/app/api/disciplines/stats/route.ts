import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const disciplineId = searchParams.get('discipline_id');

    const ct = nowCentral();
    const today = ct.dateStr;

    if (disciplineId) {
      // Stats for a single discipline (3 queries is fine for one item)
      const stats = await getDisciplineStats(disciplineId, today);
      return NextResponse.json(stats);
    }

    // Batch stats for ALL active disciplines in 3 queries total (not 3 per discipline)
    const allStats = await getAllDisciplineStats(today);
    return NextResponse.json(allStats);
  } catch (err) {
    console.error('GET /api/disciplines/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Batch stats for all active disciplines: 3 queries total instead of 3 per discipline */
async function getAllDisciplineStats(today: string) {
  const sevenAgo = new Date(today + 'T12:00:00');
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const sevenAgoStr = sevenAgo.toISOString().slice(0, 10);

  const thirtyAgo = new Date(today + 'T12:00:00');
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);

  // Query 1: All active disciplines + recent logs for streak calculation
  const disciplines = await sql`SELECT * FROM disciplines WHERE is_active = 1 ORDER BY sort_order, name`;
  const recentLogs = await sql`
    SELECT discipline_id, date, completed FROM discipline_logs
    WHERE discipline_id IN (SELECT id FROM disciplines WHERE is_active = 1)
      AND date >= ${thirtyAgoStr}
    ORDER BY date DESC
  ` as Array<{ discipline_id: string; date: string; completed: number }>;

  // Query 2: 7-day and 30-day completion rates per discipline in one query
  const periodStats = await sql`
    SELECT
      discipline_id,
      COUNT(*) FILTER (WHERE date >= ${sevenAgoStr}) as week_total,
      SUM(CASE WHEN completed = 1 AND date >= ${sevenAgoStr} THEN 1 ELSE 0 END) as week_done,
      COUNT(*) as month_total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as month_done
    FROM discipline_logs
    WHERE discipline_id IN (SELECT id FROM disciplines WHERE is_active = 1)
      AND date >= ${thirtyAgoStr} AND date <= ${today}
    GROUP BY discipline_id
  ` as Array<{ discipline_id: string; week_total: string; week_done: string; month_total: string; month_done: string }>;

  // Index period stats by discipline_id
  const statsMap = new Map(periodStats.map(s => [s.discipline_id, s]));

  // Index recent logs by discipline_id
  const logsByDiscipline = new Map<string, Array<{ date: string; completed: number }>>();
  for (const log of recentLogs) {
    const arr = logsByDiscipline.get(log.discipline_id) || [];
    arr.push(log);
    logsByDiscipline.set(log.discipline_id, arr);
  }

  return disciplines.map(d => {
    const id = d.id as string;
    const logs = logsByDiscipline.get(id) || [];
    const ps = statsMap.get(id);

    // Calculate streak from today backwards
    let streak = 0;
    const dateObj = new Date(today + 'T12:00:00');
    for (let i = 0; i < 90; i++) {
      const dateStr = dateObj.toISOString().slice(0, 10);
      const log = logs.find(l => l.date === dateStr);
      if (log && log.completed === 1) {
        streak++;
      } else if (i === 0 && !log) {
        // Today not yet logged — don't break streak, just skip
      } else {
        break;
      }
      dateObj.setDate(dateObj.getDate() - 1);
    }

    const weekTotal = Number(ps?.week_total || 0);
    const weekDone = Number(ps?.week_done || 0);
    const monthTotal = Number(ps?.month_total || 0);
    const monthDone = Number(ps?.month_done || 0);

    return {
      discipline_id: id,
      name: d.name as string,
      type: d.type as string,
      streak,
      week_completed: weekDone,
      week_total: weekTotal,
      week_rate: weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0,
      month_completed: monthDone,
      month_total: monthTotal,
      month_rate: monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0,
    };
  });
}

/** Stats for a single discipline (used when ?discipline_id= is provided) */
async function getDisciplineStats(disciplineId: string, today: string) {
  const sevenAgo = new Date(today + 'T12:00:00');
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const sevenAgoStr = sevenAgo.toISOString().slice(0, 10);

  const thirtyAgo = new Date(today + 'T12:00:00');
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);

  const recentLogs = await sql`
    SELECT date, completed FROM discipline_logs
    WHERE discipline_id = ${disciplineId}
    ORDER BY date DESC LIMIT 90
  ` as Array<{ date: string; completed: number }>;

  const periodStats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE date >= ${sevenAgoStr}) as week_total,
      SUM(CASE WHEN completed = 1 AND date >= ${sevenAgoStr} THEN 1 ELSE 0 END) as week_done,
      COUNT(*) as month_total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as month_done
    FROM discipline_logs
    WHERE discipline_id = ${disciplineId} AND date >= ${thirtyAgoStr} AND date <= ${today}
  ` as Array<{ week_total: string; week_done: string; month_total: string; month_done: string }>;

  // Calculate streak from today backwards
  let streak = 0;
  const d = new Date(today + 'T12:00:00');
  for (let i = 0; i < 90; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const log = recentLogs.find(l => l.date === dateStr);
    if (log && log.completed === 1) {
      streak++;
    } else if (i === 0 && !log) {
      // Today not yet logged — don't break streak, just skip
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }

  const ps = periodStats[0];
  const weekTotal = Number(ps?.week_total || 0);
  const weekDone = Number(ps?.week_done || 0);
  const monthTotal = Number(ps?.month_total || 0);
  const monthDone = Number(ps?.month_done || 0);

  return {
    streak,
    week_completed: weekDone,
    week_total: weekTotal,
    week_rate: weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0,
    month_completed: monthDone,
    month_total: monthTotal,
    month_rate: monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0,
  };
}
