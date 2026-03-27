/**
 * Set up the Postgres schema on Neon.
 * Usage: DATABASE_URL="..." node scripts/setup-schema.mjs
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS inbox_items (id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT DEFAULT 'manual', url TEXT, captured_at TIMESTAMP NOT NULL DEFAULT NOW(), processed_at TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending')`,
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, purpose TEXT, key_milestones TEXT, planning_steps TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS next_actions (id TEXT PRIMARY KEY, content TEXT NOT NULL, context TEXT NOT NULL, project_id TEXT REFERENCES projects(id), waiting_on_person TEXT, waiting_since TEXT, agenda_person TEXT, added_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, status TEXT NOT NULL DEFAULT 'active', sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS daily_notes (id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, reflection_showed_up TEXT, reflection_fell_short TEXT, reflection_noticed TEXT, reflection_grateful TEXT, top3_first TEXT, top3_second TEXT, top3_third TEXT, notes TEXT, tomorrow TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS horizons (id TEXT PRIMARY KEY, type TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS thinking_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, content TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS reference_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category TEXT NOT NULL, subcategory TEXT, content TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS recurring_tasks (id TEXT PRIMARY KEY, content TEXT NOT NULL, area TEXT NOT NULL, cadence TEXT NOT NULL, last_triggered TEXT, sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS routine_blocks (id TEXT PRIMARY KEY, routine_type TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, label TEXT NOT NULL, description TEXT, is_non_negotiable INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS health_log (id TEXT PRIMARY KEY, month TEXT NOT NULL, weight TEXT, blood_pressure TEXT, resting_hr TEXT, avg_steps TEXT, sleep_avg TEXT, workouts TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS business_health_log (id TEXT PRIMARY KEY, month TEXT NOT NULL, revenue TEXT, active_clients TEXT, pipeline_value TEXT, hours_billed TEXT, cash_position TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS decisions_log (id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, reasoning TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS list_items (id TEXT PRIMARY KEY, list_type TEXT NOT NULL, title TEXT NOT NULL, tier TEXT, status TEXT, url TEXT, notes TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS backup_log (id SERIAL PRIMARY KEY, timestamp TIMESTAMP NOT NULL DEFAULT NOW(), path TEXT NOT NULL, size_bytes INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'scheduled')`,
  // Add updated_at columns
  `ALTER TABLE next_actions ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE routine_blocks ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  // Week patterns (migration 006)
  `CREATE TABLE IF NOT EXISTS week_patterns (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS week_pattern_blocks (id TEXT PRIMARY KEY, pattern_id TEXT NOT NULL REFERENCES week_patterns(id) ON DELETE CASCADE, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, label TEXT NOT NULL, description TEXT, is_non_negotiable INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS week_schedule (id TEXT PRIMARY KEY, week_start TEXT NOT NULL UNIQUE, pattern_id TEXT NOT NULL REFERENCES week_patterns(id), created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS week_pattern_rotation (id TEXT PRIMARY KEY, name TEXT NOT NULL, pattern_ids TEXT NOT NULL, start_date TEXT NOT NULL, is_active INTEGER DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_wpb_pattern ON week_pattern_blocks(pattern_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wpb_day ON week_pattern_blocks(day_of_week)`,
  `CREATE INDEX IF NOT EXISTS idx_ws_week ON week_schedule(week_start)`,
  // Disciplines (migration 007)
  `CREATE TABLE IF NOT EXISTS disciplines (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'discipline', description TEXT, frequency TEXT NOT NULL DEFAULT 'daily', time_of_day TEXT NOT NULL DEFAULT 'morning', is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS discipline_logs (id TEXT PRIMARY KEY, discipline_id TEXT NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE, date TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_dl_discipline_date ON discipline_logs(discipline_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_dl_date ON discipline_logs(date)`,
  `CREATE INDEX IF NOT EXISTS idx_disciplines_active ON disciplines(is_active)`,
  // Context lists (migration 008)
  `CREATE TABLE IF NOT EXISTS context_lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, color TEXT, icon TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_cl_active ON context_lists(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_cl_key ON context_lists(key)`,
];

console.log('Creating schema...');
for (const stmt of statements) {
  try {
    await sql.query(stmt);
    process.stdout.write('.');
  } catch (e) {
    console.error('\nFailed:', stmt.slice(0, 60), e.message);
  }
}

// Mark migrations as applied
for (const v of [1, 2, 3, 4, 5, 6, 7, 8]) {
  await sql.query(`INSERT INTO schema_version (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [v, `00${v}`]);
}
console.log('\nSchema created and migrations marked as applied.');
