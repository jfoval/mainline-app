import { initializeDatabase } from './schema';
import sql from './db';
import { setTimezone } from './api-helpers';

let initialized = false;

export async function ensureDb() {
  if (!initialized) {
    await initializeDatabase();
    // Load timezone from settings (if configured by user)
    try {
      const rows = await sql`SELECT value FROM settings WHERE key = 'timezone'`;
      if (rows.length > 0 && rows[0].value) {
        setTimezone(rows[0].value as string);
      }
    } catch {
      // Settings table may not exist yet — use env var or default
    }
    initialized = true;
  }
}
