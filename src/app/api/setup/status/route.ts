import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    // Check if settings table exists and has a password configured
    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'settings'
    `;

    if (tableCheck.length === 0) {
      return NextResponse.json({ configured: false });
    }

    const passwordRow = await sql`SELECT value FROM settings WHERE key = 'auth_password_hash'`;
    const configured = passwordRow.length > 0 && !!passwordRow[0].value;

    // Also check env var fallback — if AUTH_PASSWORD_HASH is set, app is configured
    const envConfigured = !!process.env.AUTH_PASSWORD_HASH;

    return NextResponse.json({ configured: configured || envConfigured });
  } catch {
    // If anything fails, assume not configured
    return NextResponse.json({ configured: false });
  }
}
