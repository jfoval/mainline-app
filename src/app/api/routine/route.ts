import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { isGirlsWeek as checkGirlsWeek } from '@/lib/girls-week';

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

    // Return current routine based on day
    const isGirlsWeek = checkGirlsWeek();
    const now = new Date();
    const day = now.getDay();

    let routineType: string;
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';
    else routineType = isGirlsWeek ? 'girls_week' : 'non_girls_week';

    const blocks = await sql`
      SELECT * FROM routine_blocks WHERE routine_type = ${routineType} ORDER BY sort_order
    `;

    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const currentBlock = (blocks as Array<{ start_time: string; end_time: string }>).find(
      b => timeStr >= b.start_time && timeStr < b.end_time
    );

    return NextResponse.json({
      routine_type: routineType,
      is_girls_week: isGirlsWeek,
      current_time: timeStr,
      current_block: currentBlock || null,
      blocks,
    });
  } catch (err) {
    console.error('GET /api/routine error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
