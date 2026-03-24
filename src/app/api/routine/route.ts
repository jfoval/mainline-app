import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { isGirlsWeek as checkGirlsWeek } from '@/lib/girls-week';
import { nowCentral } from '@/lib/api-helpers';

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

    // Return current routine based on day (Central Time)
    const ct = nowCentral();
    const isGirlsWeek = checkGirlsWeek(ct.date);
    const day = ct.dayOfWeek;

    let routineType: string;
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';
    else routineType = isGirlsWeek ? 'girls_week' : 'non_girls_week';

    const blocks = await sql`
      SELECT * FROM routine_blocks WHERE routine_type = ${routineType} ORDER BY sort_order
    `;

    const currentBlock = (blocks as Array<{ start_time: string; end_time: string }>).find(
      b => ct.timeStr >= b.start_time && ct.timeStr < b.end_time
    );

    return NextResponse.json({
      routine_type: routineType,
      is_girls_week: isGirlsWeek,
      current_time: ct.timeStr,
      current_block: currentBlock || null,
      blocks,
    });
  } catch (err) {
    console.error('GET /api/routine error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
