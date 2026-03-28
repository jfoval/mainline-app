import sql from './db';

let cachedIssuedAfter: number | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Check if a JWT issued at `iat` (Unix seconds) is still valid.
 * Returns false if the password was changed after the token was issued.
 */
export async function checkSessionValidity(iat: number): Promise<boolean> {
  const now = Date.now();

  // Use cached value if fresh
  if (cachedIssuedAfter !== null && now - cacheTime < CACHE_TTL) {
    return iat >= cachedIssuedAfter;
  }

  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'jwt_issued_after'`;
    if (rows.length > 0 && rows[0].value) {
      cachedIssuedAfter = Number(rows[0].value);
    } else {
      cachedIssuedAfter = 0; // No restriction — all tokens valid
    }
    cacheTime = now;
  } catch {
    // If settings table isn't ready, allow all tokens
    cachedIssuedAfter = 0;
    cacheTime = now;
  }

  return iat >= cachedIssuedAfter;
}

/** Clear the cached value (call after password change) */
export function clearSessionCache(): void {
  cachedIssuedAfter = null;
  cacheTime = 0;
}
