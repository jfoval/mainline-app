import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = ['title', 'category', 'subcategory', 'content'];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const categoriesOnly = searchParams.get('categories');

    if (categoriesOnly === 'true') {
      const rows = await sql`SELECT DISTINCT category FROM reference_docs ORDER BY category`;
      return NextResponse.json(rows.map(r => r.category));
    }

    if (category) {
      const items = await sql`SELECT * FROM reference_docs WHERE category = ${category} ORDER BY created_at DESC`;
      return NextResponse.json(items);
    }

    const items = await sql`SELECT * FROM reference_docs ORDER BY category, created_at DESC`;
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/reference error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const { title, category, subcategory, content } = body;

    if (!title || (typeof title === 'string' && !title.trim())) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!category || (typeof category === 'string' && !category.trim())) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    const slug = `${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = nowLocal();

    await sql`
      INSERT INTO reference_docs (id, title, slug, category, subcategory, content, created_at, updated_at)
      VALUES (${id}, ${title}, ${slug}, ${category}, ${subcategory || null}, ${content || ''}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM reference_docs WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/reference error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    rawUpdates.updated_at = nowLocal();
    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE reference_docs SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM reference_docs WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/reference error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await sql`DELETE FROM reference_docs WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/reference error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
