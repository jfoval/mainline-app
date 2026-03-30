import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

const ALLOWED_SETTINGS_KEYS = [
  'anthropic_api_key', 'theme', 'timezone', 'user_name', 'user_email',
  'review_day', 'morning_time', 'shutdown_time', 'notification_enabled',
  'inbox_types', 'alert_inbox_threshold', 'alert_waiting_days',
];

// Keys that should never be returned via the settings GET endpoint
const HIDDEN_KEYS = ['auth_password_hash', 'jwt_issued_after', 'jwt_secret'];

export async function GET() {
  try {
    await ensureDb();
    const rows = await sql`SELECT key, value FROM settings`;
    const settings: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key as string;
      if (HIDDEN_KEYS.includes(key)) continue;
      // Mask API key — only reveal that one is set
      if (key === 'anthropic_api_key') {
        settings[key] = row.value ? 'configured' : '';
        continue;
      }
      settings[key] = row.value as string;
    }
    return NextResponse.json(settings);
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
        continue;
      }
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${String(value)})
        ON CONFLICT (key) DO UPDATE SET value = ${String(value)}
      `;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
