import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import sql from '@/lib/db';
import { getJwtSecret } from '@/lib/jwt-secret';

// Hybrid rate limiting: in-memory (fast) + database (survives cold starts)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(req: NextRequest): string {
  // Prefer x-real-ip (set by Vercel), then x-forwarded-for
  return req.headers.get('x-real-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function checkServerRateLimit(ip: string): Promise<{ allowed: boolean; secondsLeft: number }> {
  const now = Date.now();

  // Check in-memory first (fast path)
  const memEntry = loginAttempts.get(ip);
  if (memEntry && memEntry.lockedUntil > now) {
    return { allowed: false, secondsLeft: Math.ceil((memEntry.lockedUntil - now) / 1000) };
  }

  // Check database (survives cold starts)
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = ${'rate_limit_' + ip}`;
    if (rows.length > 0) {
      const dbEntry = JSON.parse(rows[0].value as string) as { count: number; lockedUntil: number };
      // Hydrate in-memory cache from DB
      loginAttempts.set(ip, dbEntry);
      if (dbEntry.lockedUntil > now) {
        return { allowed: false, secondsLeft: Math.ceil((dbEntry.lockedUntil - now) / 1000) };
      }
    }
  } catch {
    // Settings table may not exist; allow request
  }

  return { allowed: true, secondsLeft: 0 };
}

async function recordFailedAttempt(ip: string): Promise<void> {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count++;
  // Exponential backoff: 0, 0, 5s, 15s, 30s, 60s...
  if (entry.count >= 3) {
    entry.lockedUntil = now + Math.min(60_000, 5_000 * Math.pow(2, entry.count - 3));
  }
  loginAttempts.set(ip, entry);

  // Persist to database so it survives cold starts
  const key = 'rate_limit_' + ip;
  const value = JSON.stringify(entry);
  try {
    await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  } catch {
    // Non-critical — in-memory still protects this instance
  }

  // Clean up old in-memory entries
  for (const [k, val] of loginAttempts) {
    if (val.lockedUntil < now - 600_000 && val.count > 0) loginAttempts.delete(k);
  }
}

async function clearAttempts(ip: string): Promise<void> {
  loginAttempts.delete(ip);
  // Clean up from database
  const key = 'rate_limit_' + ip;
  try {
    await sql`DELETE FROM settings WHERE key = ${key}`;
  } catch {
    // Non-critical
  }
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Server-side rate limiting check
    const ip = getClientIp(req);
    const rateLimit = await checkServerRateLimit(ip);
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
      await recordFailedAttempt(ip);
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
    await clearAttempts(ip);
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
