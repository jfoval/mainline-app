import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const { category } = await req.json();

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    await sql`DELETE FROM reference_docs WHERE category = ${category}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/reference/delete-category error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
