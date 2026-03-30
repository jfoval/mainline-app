import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import sql from '@/lib/db';
import { getJwtSecret } from '@/lib/jwt-secret';

// Server-side rate limiting by IP (survives across requests in the same instance)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function checkServerRateLimit(ip: string): { allowed: boolean; secondsLeft: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true, secondsLeft: 0 };
  if (entry.lockedUntil > now) {
    return { allowed: false, secondsLeft: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true, secondsLeft: 0 };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count++;
  // Exponential backoff: 0, 0, 5s, 15s, 30s, 60s...
  if (entry.count >= 3) {
    entry.lockedUntil = now + Math.min(60_000, 5_000 * Math.pow(2, entry.count - 3));
  }
  loginAttempts.set(ip, entry);
  // Clean up old entries (older than 10 minutes)
  for (const [key, val] of loginAttempts) {
    if (val.lockedUntil < now - 600_000 && val.count > 0) loginAttempts.delete(key);
  }
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Server-side rate limiting check
    const ip = getClientIp(req);
    const rateLimit = checkServerRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rateLimit.secondsLeft} seconds.` }, { status: 429 });
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
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create JWT
    const jwtSecret = await getJwtSecret();
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ user: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie and clear rate limit
    clearAttempts(ip);
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
