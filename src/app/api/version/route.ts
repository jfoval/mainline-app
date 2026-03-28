import { NextResponse } from 'next/server';
import { APP_VERSION, compareVersions } from '@/lib/version';

interface CachedUpstream {
  latest: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
  fetchedAt: number;
}

let cached: CachedUpstream | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchUpstream(): Promise<CachedUpstream> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  let latest: string | null = null;
  let releaseNotes: string | null = null;
  let releaseUrl: string | null = null;

  try {
    const pkgRes = await fetch(
      'https://raw.githubusercontent.com/jfoval/mainline-app/main/package.json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (pkgRes.ok) {
      const pkg = await pkgRes.json();
      latest = pkg.version || null;
    }
  } catch {
    // GitHub unreachable — fail silently
  }

  try {
    const relRes = await fetch(
      'https://api.github.com/repos/jfoval/mainline-app/releases/latest',
      {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (relRes.ok) {
      const rel = await relRes.json();
      releaseNotes = rel.body || null;
      releaseUrl = rel.html_url || null;
    }
  } catch {
    // No release info available — that's fine
  }

  cached = { latest, releaseNotes, releaseUrl, fetchedAt: Date.now() };
  return cached;
}

export async function GET() {
  const upstream = await fetchUpstream();

  const updateAvailable =
    upstream.latest !== null && compareVersions(upstream.latest, APP_VERSION) > 0;

  return NextResponse.json({
    current: APP_VERSION,
    latest: upstream.latest,
    updateAvailable,
    releaseNotes: updateAvailable ? upstream.releaseNotes : null,
    releaseUrl: updateAvailable ? upstream.releaseUrl : null,
  });
}
