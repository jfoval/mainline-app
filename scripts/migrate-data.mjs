/**
 * Migrate data from local SQLite (data/gtd.db) to Neon Postgres.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/migrate-data.mjs
 *
 * Requires: better-sqlite3 (still installed locally for this one-time script)
 */

import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'gtd.db');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="postgresql://..." node scripts/migrate-data.mjs');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const localDb = new Database(DB_PATH, { readonly: true });

// Tables to migrate in FK-safe order
const TABLES = [
  'settings',
  'projects',
  'inbox_items',
  'next_actions',
  'daily_notes',
  'horizons',
  'routine_blocks',
  'recurring_tasks',
  'list_items',
  'pipeline_deals',
  'pipeline_contacts',
  'pipeline_warm_leads',
  'client_notes',
  'reference_docs',
  'faith_journal',
  'offerings',
  'thinking_docs',
  'decisions_log',
  'learning_profiles',
  'health_log',
  'business_health_log',
  'family_meetings',
];

async function migrateTable(tableName) {
  const rows = localDb.prepare(`SELECT * FROM ${tableName}`).all();

  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (empty)`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  let migrated = 0;

  for (const row of rows) {
    const values = columns.map(col => row[col] ?? null);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const colNames = columns.join(', ');

    try {
      await sql.query(
        `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      migrated++;
    } catch (err) {
      console.error(`  ERROR on ${tableName} row:`, row, err.message);
    }
  }

  console.log(`  ${tableName}: ${migrated}/${rows.length} rows migrated`);
  return migrated;
}

async function main() {
  console.log('=== SQLite to Neon Postgres Migration ===');
  console.log(`Source: ${DB_PATH}`);
  console.log('');

  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const count = await migrateTable(table);
      totalRows += count;
    } catch (err) {
      console.error(`  SKIPPED ${table}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`=== Done. ${totalRows} total rows migrated. ===`);

  localDb.close();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
