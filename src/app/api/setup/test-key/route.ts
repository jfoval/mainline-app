import { NextRequest, NextResponse } from 'next/server';

// Public endpoint — called from the setup wizard before the user is logged in.
// Accepts an API key, makes a minimal Anthropic call, returns success/failure.
export async function POST(req: NextRequest) {
  try {
    const { api_key } = await req.json();
    if (!api_key || !String(api_key).startsWith('sk-ant-')) {
      return NextResponse.json({ error: 'Invalid key format — should start with sk-ant-' }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok".' }],
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await response.json().catch(() => ({}));
    const message = (data as { error?: { message?: string } }).error?.message || 'Invalid API key';
    return NextResponse.json({ error: message }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Could not reach Anthropic API' }, { status: 500 });
  }
}
