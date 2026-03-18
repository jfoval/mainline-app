import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'Database restore is not available. Your data is hosted on Neon with automatic backups and point-in-time recovery.',
  }, { status: 410 });
}
