import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const { oldCategory, newCategory } = await req.json();

    if (!oldCategory || !newCategory) {
      return NextResponse.json({ error: 'oldCategory and newCategory are required' }, { status: 400 });
    }

    await sql`UPDATE reference_docs SET category = ${newCategory} WHERE category = ${oldCategory}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/reference/rename-category error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
