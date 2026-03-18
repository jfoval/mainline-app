import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { v4 as uuid } from 'uuid';
import { buildUpdate, nowLocal } from '@/lib/api-helpers';

const DEAL_PATCH_FIELDS = [
  'company', 'contact_name', 'what_they_need', 'stage', 'next_action',
  'last_contact', 'value', 'loss_reason', 'closed_date', 'win_notes',
];
const WARM_LEAD_PATCH_FIELDS = ['name', 'company', 'interest', 'source', 'notes'];
const CONTACT_PATCH_FIELDS = [
  'name', 'company', 'role', 'email', 'phone', 'how_you_know',
  'contact_type', 'engagement_type', 'start_date', 'date_range', 'last_contact', 'notes',
];

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const closed = searchParams.get('closed');

    let deals;
    if (closed === 'true') {
      deals = await sql`SELECT * FROM pipeline_deals WHERE stage IN ('closed_won', 'closed_lost') ORDER BY closed_date DESC, updated_at DESC`;
    } else {
      deals = await sql`SELECT * FROM pipeline_deals ORDER BY CASE stage WHEN 'discovery' THEN 1 WHEN 'proposal_sent' THEN 2 WHEN 'negotiating' THEN 3 WHEN 'verbal_yes' THEN 4 WHEN 'closed_won' THEN 5 WHEN 'closed_lost' THEN 6 END, updated_at DESC`;
    }
    const warmLeads = await sql`SELECT * FROM pipeline_warm_leads ORDER BY added_at DESC`;
    const contacts = await sql`SELECT * FROM pipeline_contacts ORDER BY contact_type, name`;

    return NextResponse.json({ deals, warm_leads: warmLeads, contacts });
  } catch (err) {
    console.error('GET /api/pipeline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { entity_type, ...data } = body;
    const id = body.id || uuid();

    if (!entity_type || !['deal', 'warm_lead', 'contact'].includes(entity_type)) {
      return NextResponse.json({ error: 'entity_type must be one of: deal, warm_lead, contact' }, { status: 400 });
    }

    if (entity_type === 'deal' && !data.company?.trim()) {
      return NextResponse.json({ error: 'company is required for deals' }, { status: 400 });
    }
    if ((entity_type === 'warm_lead' || entity_type === 'contact') && !data.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (entity_type === 'deal') {
      await sql`
        INSERT INTO pipeline_deals (id, company, contact_name, what_they_need, stage, next_action, last_contact, value)
        VALUES (${id}, ${data.company}, ${data.contact_name || null}, ${data.what_they_need || null}, ${data.stage || 'discovery'}, ${data.next_action || null}, ${data.last_contact || null}, ${data.value || null})
      `;
    } else if (entity_type === 'warm_lead') {
      await sql`
        INSERT INTO pipeline_warm_leads (id, name, company, interest, source, notes)
        VALUES (${id}, ${data.name}, ${data.company || null}, ${data.interest || null}, ${data.source || null}, ${data.notes || null})
      `;
    } else if (entity_type === 'contact') {
      await sql`
        INSERT INTO pipeline_contacts (id, name, company, role, email, phone, how_you_know, contact_type, engagement_type, last_contact, notes)
        VALUES (${id}, ${data.name}, ${data.company || null}, ${data.role || null}, ${data.email || null}, ${data.phone || null}, ${data.how_you_know || null}, ${data.contact_type || 'strategic'}, ${data.engagement_type || null}, ${data.last_contact || null}, ${data.notes || null})
      `;
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/pipeline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const { entity_type, id, _base_updated_at, ...rawUpdates } = body;

    const tableMap: Record<string, string> = { deal: 'pipeline_deals', warm_lead: 'pipeline_warm_leads', contact: 'pipeline_contacts' };
    const fieldsMap: Record<string, string[]> = { deal: DEAL_PATCH_FIELDS, warm_lead: WARM_LEAD_PATCH_FIELDS, contact: CONTACT_PATCH_FIELDS };
    const table = tableMap[entity_type];
    const allowedFields = fieldsMap[entity_type];

    if (!table || !allowedFields) {
      return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 });
    }

    rawUpdates.updated_at = nowLocal();
    const update = buildUpdate(rawUpdates, [...allowedFields, 'updated_at']);
    if (!update) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

    if (_base_updated_at) {
      const current = await sql.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      if (current[0] && current[0].updated_at && (current[0].updated_at as string) > _base_updated_at) {
        return NextResponse.json({ error: 'conflict', serverRecord: current[0] }, { status: 409 });
      }
    }

    const values = [...update.values, id];
    const idParam = `$${update.paramOffset + 1}`;
    await sql.query(`UPDATE ${table} SET ${update.fields} WHERE id = ${idParam}`, values);

    const updated = await sql.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error('PATCH /api/pipeline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (id && type === 'deal') await sql`DELETE FROM pipeline_deals WHERE id = ${id}`;
    if (id && type === 'warm_lead') await sql`DELETE FROM pipeline_warm_leads WHERE id = ${id}`;
    if (id && type === 'contact') await sql`DELETE FROM pipeline_contacts WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/pipeline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
