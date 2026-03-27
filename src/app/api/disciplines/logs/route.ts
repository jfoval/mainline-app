import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { nowLocal } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const disciplineId = searchParams.get('discipline_id');
    const days = searchParams.get('days');

    if (date) {
      const items = disciplineId
        ? await sql`SELECT * FROM discipline_logs WHERE date = ${date} AND discipline_id = ${disciplineId}`
        : await sql`SELECT * FROM discipline_logs WHERE date = ${date}`;
      return NextResponse.json(items);
    }

    if (disciplineId) {
      const items = await sql`
        SELECT * FROM discipline_logs WHERE discipline_id = ${disciplineId} ORDER BY date DESC LIMIT 90
      `;
      return NextResponse.json(items);
    }

    // Default: recent logs (last N days)
    const numDays = Math.min(Number(days) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - numDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const items = await sql`
      SELECT * FROM discipline_logs WHERE date >= ${cutoffStr} ORDER BY date DESC
    `;
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/disciplines/logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = body.id || uuid();

    if (!body.discipline_id || !body.date) {
      return NextResponse.json({ error: 'Missing discipline_id or date' }, { status: 400 });
    }

    const now = nowLocal();
    // Upsert: if log already exists for this discipline+date, update it
    await sql`
      INSERT INTO discipline_logs (id, discipline_id, date, completed, notes, created_at)
      VALUES (${id}, ${body.discipline_id}, ${body.date}, ${body.completed ?? 0}, ${body.notes || null}, ${now})
      ON CONFLICT (discipline_id, date)
      DO UPDATE SET completed = EXCLUDED.completed, notes = EXCLUDED.notes
    `;

    const rows = await sql`
      SELECT * FROM discipline_logs WHERE discipline_id = ${body.discipline_id} AND date = ${body.date}
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/disciplines/logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();

    if (!body.id && !(body.discipline_id && body.date)) {
      return NextResponse.json({ error: 'Missing id or (discipline_id + date)' }, { status: 400 });
    }

    if (body.id) {
      await sql`
        UPDATE discipline_logs
        SET completed = ${body.completed ?? 0}, notes = ${body.notes || null}
        WHERE id = ${body.id}
      `;
      const rows = await sql`SELECT * FROM discipline_logs WHERE id = ${body.id}`;
      return NextResponse.json(rows[0] || { id: body.id });
    } else {
      await sql`
        UPDATE discipline_logs
        SET completed = ${body.completed ?? 0}, notes = ${body.notes || null}
        WHERE discipline_id = ${body.discipline_id} AND date = ${body.date}
      `;
      const rows = await sql`
        SELECT * FROM discipline_logs WHERE discipline_id = ${body.discipline_id} AND date = ${body.date}
      `;
      return NextResponse.json(rows[0] || body);
    }
  } catch (err) {
    console.error('PATCH /api/disciplines/logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sql`DELETE FROM discipline_logs WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/disciplines/logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
