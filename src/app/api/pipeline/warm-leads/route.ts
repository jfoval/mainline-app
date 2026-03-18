import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function GET() {
  try {
    await ensureDb();
    const warmLeads = await sql`
      SELECT * FROM pipeline_warm_leads ORDER BY added_at DESC
    `;
    return NextResponse.json(warmLeads);
  } catch (err) {
    console.error('GET /api/pipeline/warm-leads error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
