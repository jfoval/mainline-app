import sql from './db';

/**
 * Export entire database as JSON (portable backup).
 * Neon handles database durability and point-in-time recovery,
 * so file-based backups are no longer needed.
 */
export async function exportAsJson(): Promise<Record<string, unknown>> {
  const tableResult = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name NOT IN ('schema_version', 'backup_log')
    ORDER BY table_name
  `;

  const tables = tableResult.map(t => t.table_name as string);
  const data: Record<string, unknown[]> = {};

  // Secrets to strip from settings table exports
  const HIDDEN_SETTINGS_KEYS = new Set(['auth_password_hash', 'jwt_secret', 'anthropic_api_key', 'jwt_issued_after']);

  for (const table of tables) {
    // Use raw query for dynamic table names (safe — table names come from information_schema)
    let rows = await sql.query(`SELECT * FROM ${table}`);

    // Strip secrets from settings export to prevent credential leakage in backups
    if (table === 'settings') {
      rows = rows.filter((r: Record<string, unknown>) => !HIDDEN_SETTINGS_KEYS.has(r.key as string));
    }

    data[table] = rows;
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    table_count: tables.length,
    tables: data,
  };
}
