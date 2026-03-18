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

  for (const table of tables) {
    // Use raw query for dynamic table names (safe — table names come from information_schema)
    const rows = await sql.query(`SELECT * FROM ${table}`);
    data[table] = rows;
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    table_count: tables.length,
    tables: data,
  };
}
