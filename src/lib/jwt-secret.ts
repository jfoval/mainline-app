import { neon } from '@neondatabase/serverless';

let cachedSecret: string | null = null;

// Returns the JWT secret, using this priority:
// 1. JWT_SECRET env var (if set)
// 2. Cached value from a previous DB lookup this instance
// 3. Value stored in the settings table
// 4. Auto-generated + stored (new installs with no JWT_SECRET env var)
//
// This runs in both Edge (middleware) and Node (API routes).
// The Neon HTTP driver works in Edge Runtime.
export async function getJwtSecret(): Promise<string> {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`SELECT value FROM settings WHERE key = 'jwt_secret'` as Array<{ value: string }>;
  if (rows.length > 0 && rows[0].value) {
    cachedSecret = rows[0].value;
    return cachedSecret;
  }

  // Generate a new secret and persist it
  const array = new Uint8Array(64);
  globalThis.crypto.getRandomValues(array);
  const secret = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

  await sql`
    INSERT INTO settings (key, value) VALUES ('jwt_secret', ${secret})
    ON CONFLICT (key) DO UPDATE SET value = ${secret}
  `;

  cachedSecret = secret;
  return secret;
}
