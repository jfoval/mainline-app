import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function GET() {
  try {
    await ensureDb();
    const deals = await sql`
      SELECT * FROM pipeline_deals ORDER BY CASE stage WHEN 'discovery' THEN 1 WHEN 'proposal_sent' THEN 2 WHEN 'negotiating' THEN 3 WHEN 'verbal_yes' THEN 4 WHEN 'closed_won' THEN 5 WHEN 'closed_lost' THEN 6 END, updated_at DESC
    `;
    return NextResponse.json(deals);
  } catch (err) {
    console.error('GET /api/pipeline/deals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
