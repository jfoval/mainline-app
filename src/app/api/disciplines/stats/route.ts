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
      // Stats for a single discipline
      const stats = await getDisciplineStats(disciplineId, today);
      return NextResponse.json(stats);
    }

    // Stats for all active disciplines
    const disciplines = await sql`SELECT * FROM disciplines WHERE is_active = 1 ORDER BY sort_order, name`;
    const allStats = await Promise.all(
      disciplines.map(async (d) => ({
        discipline_id: d.id as string,
        name: d.name as string,
        type: d.type as string,
        ...(await getDisciplineStats(d.id as string, today)),
      }))
    );

    return NextResponse.json(allStats);
  } catch (err) {
    console.error('GET /api/disciplines/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getDisciplineStats(disciplineId: string, today: string) {
  // Current streak
  let streak = 0;
  const recentLogs = await sql`
    SELECT date, completed FROM discipline_logs
    WHERE discipline_id = ${disciplineId}
    ORDER BY date DESC LIMIT 90
  ` as Array<{ date: string; completed: number }>;

  // Calculate streak from today backwards
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

  // Last 7 days completion rate
  const sevenAgo = new Date(today + 'T12:00:00');
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const sevenAgoStr = sevenAgo.toISOString().slice(0, 10);

  const weekLogs = await sql`
    SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done
    FROM discipline_logs
    WHERE discipline_id = ${disciplineId} AND date >= ${sevenAgoStr} AND date <= ${today}
  ` as Array<{ total: string; done: string }>;

  const weekTotal = Number(weekLogs[0]?.total || 0);
  const weekDone = Number(weekLogs[0]?.done || 0);

  // Last 30 days completion rate
  const thirtyAgo = new Date(today + 'T12:00:00');
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);

  const monthLogs = await sql`
    SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done
    FROM discipline_logs
    WHERE discipline_id = ${disciplineId} AND date >= ${thirtyAgoStr} AND date <= ${today}
  ` as Array<{ total: string; done: string }>;

  const monthTotal = Number(monthLogs[0]?.total || 0);
  const monthDone = Number(monthLogs[0]?.done || 0);

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
