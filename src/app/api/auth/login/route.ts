import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import sql from '@/lib/db';

// Simple rate limiting via cookie-based attempt tracking
function getRateLimitInfo(req: NextRequest): { attempts: number; lockedUntil: number } {
  try {
    const raw = req.cookies.get('mainline-login-attempts')?.value;
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch { return { attempts: 0, lockedUntil: 0 }; }
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Rate limiting check
    const rateLimit = getRateLimitInfo(req);
    if (rateLimit.lockedUntil > Date.now()) {
      const secondsLeft = Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000);
      return NextResponse.json({ error: `Too many attempts. Try again in ${secondsLeft} seconds.` }, { status: 429 });
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
      const newAttempts = rateLimit.attempts + 1;
      // Exponential backoff: 0, 0, 5s, 15s, 30s, 60s...
      const lockDuration = newAttempts >= 3 ? Math.min(60, 5 * Math.pow(2, newAttempts - 3)) * 1000 : 0;
      const response = NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      response.cookies.set('mainline-login-attempts', JSON.stringify({
        attempts: newAttempts,
        lockedUntil: lockDuration > 0 ? Date.now() + lockDuration : 0,
      }), { httpOnly: true, path: '/', maxAge: 600, sameSite: 'lax' });
      return response;
    }

    // Create JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ user: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie and clear rate limit
    const response = NextResponse.json({ success: true });
    response.cookies.delete('mainline-login-attempts');
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
