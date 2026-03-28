import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/jwt-secret';

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    // Check if already configured
    const existingPassword = await sql`SELECT value FROM settings WHERE key = 'auth_password_hash'`;
    if (existingPassword.length > 0 && existingPassword[0].value) {
      return NextResponse.json({ error: 'App is already configured' }, { status: 400 });
    }

    const body = await req.json();
    const { password, display_name, anthropic_api_key } = body;

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Hash password and store in settings
    const hash = await bcrypt.hash(password, 12);

    // Upsert settings
    await sql`
      INSERT INTO settings (key, value) VALUES ('auth_password_hash', ${hash})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    // Invalidate any existing sessions by setting jwt_issued_after to now
    const issuedAfter = String(Math.floor(Date.now() / 1000));
    await sql`
      INSERT INTO settings (key, value) VALUES ('jwt_issued_after', ${issuedAfter})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    if (display_name) {
      await sql`
        INSERT INTO settings (key, value) VALUES ('display_name', ${display_name})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    if (anthropic_api_key) {
      await sql`
        INSERT INTO settings (key, value) VALUES ('anthropic_api_key', ${anthropic_api_key})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    // Auto-login: create JWT and set cookie
    const jwtSecret = await getJwtSecret();
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ user: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const response = NextResponse.json({ success: true });
    response.cookies.set('mainline-auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('POST /api/setup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
