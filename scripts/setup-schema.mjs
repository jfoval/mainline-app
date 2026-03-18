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
  `CREATE TABLE IF NOT EXISTS daily_notes (id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, reflection_showed_up TEXT, reflection_fell_short TEXT, reflection_noticed TEXT, reflection_grateful TEXT, top3_revenue TEXT, top3_second TEXT, top3_third TEXT, notes TEXT, tomorrow TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS horizons (id TEXT PRIMARY KEY, type TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS thinking_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, content TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS reference_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category TEXT NOT NULL, subcategory TEXT, content TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS pipeline_deals (id TEXT PRIMARY KEY, company TEXT NOT NULL, contact_name TEXT, what_they_need TEXT, stage TEXT NOT NULL DEFAULT 'discovery', next_action TEXT, last_contact TEXT, value TEXT, loss_reason TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS pipeline_contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, role TEXT, email TEXT, phone TEXT, how_you_know TEXT, contact_type TEXT NOT NULL, engagement_type TEXT, start_date TEXT, date_range TEXT, last_contact TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS pipeline_warm_leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, interest TEXT, source TEXT, added_at TIMESTAMP NOT NULL DEFAULT NOW(), notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS offerings (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, readiness TEXT NOT NULL, project_id TEXT REFERENCES projects(id), target_ready_date TEXT, build_status TEXT, sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS recurring_tasks (id TEXT PRIMARY KEY, content TEXT NOT NULL, area TEXT NOT NULL, cadence TEXT NOT NULL, last_triggered TEXT, sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS routine_blocks (id TEXT PRIMARY KEY, routine_type TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, label TEXT NOT NULL, description TEXT, is_non_negotiable INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS learning_profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, grade TEXT, age TEXT, focus_areas TEXT, progression_path TEXT, progress_log TEXT, notes TEXT, updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS faith_journal (id TEXT PRIMARY KEY, month TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS health_log (id TEXT PRIMARY KEY, month TEXT NOT NULL, weight TEXT, blood_pressure TEXT, resting_hr TEXT, avg_steps TEXT, sleep_avg TEXT, workouts TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS business_health_log (id TEXT PRIMARY KEY, month TEXT NOT NULL, revenue TEXT, active_clients TEXT, pipeline_value TEXT, hours_billed TEXT, cash_position TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS decisions_log (id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, reasoning TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS family_meetings (id TEXT PRIMARY KEY, date TEXT NOT NULL, highs_lows TEXT, celebrations TEXT, topics_discussed TEXT, chore_updates TEXT, upcoming TEXT, fun_activity TEXT, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS list_items (id TEXT PRIMARY KEY, list_type TEXT NOT NULL, title TEXT NOT NULL, tier TEXT, status TEXT, url TEXT, notes TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
  // Migration 002
  `ALTER TABLE next_actions ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE pipeline_contacts ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE pipeline_warm_leads ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  `ALTER TABLE routine_blocks ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT ''`,
  // Migration 003
  `CREATE TABLE IF NOT EXISTS backup_log (id SERIAL PRIMARY KEY, timestamp TIMESTAMP NOT NULL DEFAULT NOW(), path TEXT NOT NULL, size_bytes INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'scheduled')`,
  // Migration 004
  `CREATE TABLE IF NOT EXISTS client_notes (id TEXT PRIMARY KEY, client_name TEXT NOT NULL, date TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_name)`,
  `CREATE INDEX IF NOT EXISTS idx_client_notes_date ON client_notes(date)`,
  `ALTER TABLE pipeline_deals ADD COLUMN IF NOT EXISTS closed_date TEXT`,
  `ALTER TABLE pipeline_deals ADD COLUMN IF NOT EXISTS win_notes TEXT`,
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
for (const v of [1, 2, 3, 4]) {
  await sql.query(`INSERT INTO schema_version (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [v, `00${v}`]);
}
console.log('\nSchema created and migrations marked as applied.');
