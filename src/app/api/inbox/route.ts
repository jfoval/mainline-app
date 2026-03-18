import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { nowLocal } from '@/lib/api-helpers';

export async function GET() {
  try {
    await ensureDb();
    const items = await sql`
      SELECT * FROM inbox_items WHERE status = 'pending' ORDER BY captured_at DESC
    `;
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/inbox error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();
    const { content, source = 'manual', url = null } = body;

    if (!content || (typeof content === 'string' && !content.trim())) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    await sql`
      INSERT INTO inbox_items (id, content, source, url) VALUES (${id}, ${content}, ${source}, ${url})
    `;

    const rows = await sql`SELECT * FROM inbox_items WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/inbox error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, status, _base_updated_at } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM inbox_items WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const now = nowLocal();
    await sql`
      UPDATE inbox_items SET status = ${status}, processed_at = ${now}, updated_at = ${now} WHERE id = ${id}
    `;

    const rows = await sql`SELECT * FROM inbox_items WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/inbox error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      await sql`DELETE FROM inbox_items WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inbox error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
