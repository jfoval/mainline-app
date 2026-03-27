import sql from './db';
import { runMigrations } from './migrations/runner';

export async function initializeDatabase() {
  // Check if tables exist (Postgres information_schema instead of sqlite_master)
  const tableCheck = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  `;
  const hasExistingTables = tableCheck.length > 0;

  const versionCheck = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_version'
  `;
  const hasSchemaVersion = versionCheck.length > 0;

  if (hasExistingTables && !hasSchemaVersion) {
    // Existing database from before migration system — mark baseline as applied
    await sql`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await sql`INSERT INTO schema_version (version, name) VALUES (1, '001_baseline') ON CONFLICT DO NOTHING`;
    console.log('[migrations] Existing database detected — baseline marked as applied');
  }

  // Run any pending migrations
  await runMigrations();

  // Seed data (idempotent — only inserts if missing)
  await seedIfNeeded();
}

async function seedIfNeeded() {
  // Seed horizons if empty
  const horizonCount = await sql`SELECT COUNT(*) as count FROM horizons`;
  if (Number(horizonCount[0].count) === 0) {
    await seedHorizons();
  }

  // Seed context lists if empty
  try {
    const ctxCount = await sql`SELECT COUNT(*) as count FROM context_lists`;
    if (Number(ctxCount[0].count) === 0) {
      await seedContextLists();
    }
  } catch {
    // Table may not exist yet
  }
}

const DEFAULT_CONTEXTS = [
  { key: 'work', name: 'Work', color: 'blue', icon: 'briefcase' },
  { key: 'errands', name: 'Errands', color: 'green', icon: 'shopping-cart' },
  { key: 'home', name: 'Home', color: 'orange', icon: 'home' },
  { key: 'waiting_for', name: 'Waiting For', color: 'yellow', icon: 'clock' },
  { key: 'agendas', name: 'Agendas', color: 'purple', icon: 'users' },
  { key: 'calls', name: 'Calls', color: 'teal', icon: 'phone' },
  { key: 'computer', name: 'Computer', color: 'gray', icon: 'monitor' },
  { key: 'anywhere', name: 'Anywhere', color: 'indigo', icon: 'globe' },
];

async function seedContextLists() {
  // First try to auto-populate from existing next_actions contexts
  const existingContexts = await sql`
    SELECT DISTINCT context FROM next_actions WHERE context IS NOT NULL AND context != ''
  ` as Array<{ context: string }>;

  if (existingContexts.length > 0) {
    // Auto-populate from existing data + fill in defaults
    const existingKeys = new Set(existingContexts.map(r => r.context));
    // Merge: existing contexts first, then any defaults not yet present
    const allKeys = [...existingKeys];
    for (const d of DEFAULT_CONTEXTS) {
      if (!existingKeys.has(d.key)) allKeys.push(d.key);
    }

    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i];
      const def = DEFAULT_CONTEXTS.find(d => d.key === key);
      const name = def?.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const color = def?.color || 'gray';
      const icon = def?.icon || 'tag';
      const id = `ctx-${key}`;
      await sql`
        INSERT INTO context_lists (id, name, key, color, icon, sort_order, is_active)
        VALUES (${id}, ${name}, ${key}, ${color}, ${icon}, ${i}, 1)
        ON CONFLICT (key) DO NOTHING
      `;
    }
  } else {
    // Fresh install — seed defaults
    for (let i = 0; i < DEFAULT_CONTEXTS.length; i++) {
      const d = DEFAULT_CONTEXTS[i];
      const id = `ctx-${d.key}`;
      await sql`
        INSERT INTO context_lists (id, name, key, color, icon, sort_order, is_active)
        VALUES (${id}, ${d.name}, ${d.key}, ${d.color}, ${d.icon}, ${i}, 1)
        ON CONFLICT (key) DO NOTHING
      `;
    }
  }
}

async function seedHorizons() {
  const horizons = [
    { id: 'purpose', type: 'purpose', content: '' },
    { id: 'vision', type: 'vision', content: '' },
    { id: 'goals', type: 'goals', content: '' },
    { id: 'areas_of_focus', type: 'areas_of_focus', content: '' },
    { id: 'growth_intentions', type: 'growth_intentions', content: '' },
  ];
  for (const h of horizons) {
    await sql`INSERT INTO horizons (id, type, content) VALUES (${h.id}, ${h.type}, ${h.content})`;
  }
}
