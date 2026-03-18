import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function GET() {
  try {
    await ensureDb();
    const contacts = await sql`
      SELECT * FROM pipeline_contacts ORDER BY contact_type, name
    `;
    return NextResponse.json(contacts);
  } catch (err) {
    console.error('GET /api/pipeline/contacts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
