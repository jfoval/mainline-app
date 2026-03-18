import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const ALLOWED_PATCH_FIELDS = ['content', 'date'];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const client = searchParams.get('client');

    if (!client) {
      const clients = await sql`SELECT DISTINCT client_name FROM client_notes ORDER BY client_name`;
      return NextResponse.json(clients);
    }

    const notes = await sql`
      SELECT * FROM client_notes WHERE client_name = ${client} ORDER BY date DESC, created_at DESC
    `;
    return NextResponse.json(notes);
  } catch (err) {
    console.error('GET /api/client-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { client_name, date, content } = body;

    if (!client_name || !client_name.trim()) {
      return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const id = uuid();
    await sql`
      INSERT INTO client_notes (id, client_name, date, content)
      VALUES (${id}, ${client_name.trim()}, ${date}, ${content.trim()})
    `;

    const rows = await sql`SELECT * FROM client_notes WHERE id = ${id}`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/client-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { id, _base_updated_at, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (_base_updated_at) {
      const current = await sql`SELECT * FROM client_notes WHERE id = ${id}`;
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    rawUpdates.updated_at = nowLocal();
    const update = buildUpdate(rawUpdates, [...ALLOWED_PATCH_FIELDS, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE client_notes SET ${update.fields} WHERE id = ${idParam}`, values);

    const rows = await sql`SELECT * FROM client_notes WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/client-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const client = searchParams.get('client');

    if (id) {
      await sql`DELETE FROM client_notes WHERE id = ${id}`;
    } else if (client) {
      await sql`DELETE FROM client_notes WHERE client_name = ${client}`;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/client-notes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
