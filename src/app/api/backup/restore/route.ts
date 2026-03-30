import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';

// Tables in dependency order (parents before children)
const TABLE_ORDER = [
  'settings',
  'horizons',
  'context_lists',
  'projects',
  'disciplines',
  'week_patterns',
  'next_actions',
  'discipline_logs',
  'week_pattern_blocks',
  'week_schedule',
  'week_pattern_rotation',
  'daily_blocks',
  'inbox_items',
  'daily_notes',
  'recurring_tasks',
  'routine_blocks',
  'reference_docs',
  'list_items',
];

const PROTECTED_TABLES = new Set(['schema_version', 'backup_log']);

// Validate column names: only allow safe identifiers (letters, digits, underscores)
const SAFE_COLUMN_RE = /^[a-z_][a-z0-9_]*$/i;

export async function POST(req: NextRequest) {
  await ensureDb();

  try {
    const body = await req.json();

    // Validate structure
    if (!body.version || !body.tables || typeof body.tables !== 'object') {
      return NextResponse.json({ error: 'Invalid backup format. Expected { version, tables }.' }, { status: 400 });
    }

    // Only process tables in the known whitelist — reject any unknown table names
    // to prevent SQL injection via crafted backup files.
    const ALLOWED_TABLES = new Set(TABLE_ORDER);
    const importTables = Object.keys(body.tables).filter(
      t => ALLOWED_TABLES.has(t) && !PROTECTED_TABLES.has(t)
    );
    let totalRows = 0;

    // Truncate in reverse dependency order
    const truncateOrder = [...TABLE_ORDER].reverse();
    for (const table of truncateOrder) {
      if (importTables.includes(table)) {
        try {
          await sql.query(`TRUNCATE TABLE ${table} CASCADE`);
        } catch {
          // Table may not exist yet — skip
        }
      }
    }

    // Insert in forward dependency order (only known tables)
    const orderedTables = TABLE_ORDER.filter(t => importTables.includes(t));

    for (const table of orderedTables) {
      const rows = body.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;

        // Validate column names to prevent SQL injection via crafted backup files
        const unsafeCols = cols.filter(c => !SAFE_COLUMN_RE.test(c));
        if (unsafeCols.length > 0) {
          console.error(`[import] Skipping row in ${table}: unsafe column names: ${unsafeCols.join(', ')}`);
          continue;
        }

        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => row[c]);
        const colNames = cols.map(c => `"${c}"`).join(', ');

        try {
          await sql.query(
            `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          totalRows++;
        } catch (err) {
          console.error(`[import] Error inserting into ${table}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      tables_imported: orderedTables.length,
      rows_imported: totalRows,
    });
  } catch (err) {
    console.error('[import] Error:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
