import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ error: 'JWT_SECRET not configured' }, { status: 500 });
    }

    // Try settings table first, then fall back to env vars
    let passwordHash: string | null = null;

    try {
      const row = await sql`SELECT value FROM settings WHERE key = 'auth_password_hash'`;
      if (row.length > 0 && row[0].value) {
        passwordHash = row[0].value as string;
      }
    } catch {
      // Settings table may not exist yet
    }

    // Fallback to env var
    if (!passwordHash) {
      passwordHash = process.env.AUTH_PASSWORD_HASH || null;
    }

    if (!passwordHash) {
      return NextResponse.json({ error: 'Auth not configured. Please run setup.' }, { status: 500 });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ user: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('mainline-auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
