import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const authEmail = process.env.AUTH_EMAIL;
    const authPasswordHash = process.env.AUTH_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!authEmail || !authPasswordHash || !jwtSecret) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    // Verify credentials
    if (email.toLowerCase() !== authEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, authPasswordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('gtd-auth', token, {
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
