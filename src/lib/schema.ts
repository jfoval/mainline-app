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
  // Seed the girls week setting if not exists
  const setting = await sql`SELECT value FROM settings WHERE key = 'is_girls_week'`;
  if (setting.length === 0) {
    await sql`INSERT INTO settings (key, value) VALUES ('is_girls_week', 'false')`;
  }

  // Seed routine blocks
  const routineCount = await sql`SELECT COUNT(*) as count FROM routine_blocks`;
  if (Number(routineCount[0].count) === 0) {
    await seedRoutines();
  }

  // Seed horizons if empty
  const horizonCount = await sql`SELECT COUNT(*) as count FROM horizons`;
  if (Number(horizonCount[0].count) === 0) {
    await seedHorizons();
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

async function seedRoutines() {
  // Non-girls week
  const ngw = [
    ['ngw-1', 'non_girls_week', '05:00', '06:00', 'God Time', 'Open @prayers on phone. Physical Bible, physical journal.', 1, 1],
    ['ngw-2', 'non_girls_week', '06:00', '06:45', 'Workout', 'Default ON, cancel if needed.', 0, 2],
    ['ngw-3', 'non_girls_week', '06:45', '07:30', 'Get Ready', 'Help kids get ready (Aiden, Liam).', 0, 3],
    ['ngw-4', 'non_girls_week', '07:30', '08:00', 'Morning Processing', 'Daily note, reflection, inbox, email, revenue focus, top 3.', 1, 4],
    ['ngw-5', 'non_girls_week', '08:00', '08:30', 'LinkedIn', 'Daily LinkedIn block.', 0, 5],
    ['ngw-6', 'non_girls_week', '08:30', '10:00', 'Deep Work 1: Revenue Priority', 'Client delivery, warm prospect pursuit, or build the next sellable thing.', 0, 6],
    ['ngw-7', 'non_girls_week', '10:00', '10:15', 'Break', '', 0, 7],
    ['ngw-8', 'non_girls_week', '10:15', '12:00', 'Deep Work 2: Business Building', 'Nurik IP, methodology, research, content creation, offering development.', 0, 8],
    ['ngw-9', 'non_girls_week', '12:00', '12:30', 'Lunch', '', 0, 9],
    ['ngw-10', 'non_girls_week', '12:30', '13:00', 'Email & Admin', 'Email processing, phone calls, quick admin.', 0, 10],
    ['ngw-11', 'non_girls_week', '13:00', '15:00', 'Deep Work 3: Themed', 'Mon/Wed: Biz Dev. Tue: IP. Thu: Research. Fri: Ops.', 0, 11],
    ['ngw-12', 'non_girls_week', '15:00', '16:15', 'Flexible Block', 'Overflow, meetings, smaller next actions. Wed: recording session.', 0, 12],
    ['ngw-13', 'non_girls_week', '16:15', '16:45', 'Buffer', 'Unscheduled. Absorbs overflow or use for smaller tasks.', 0, 13],
    ['ngw-14', 'non_girls_week', '16:45', '17:00', 'Shutdown', 'Capture sweep, scan for uncaptured commitments, write Tomorrow.', 0, 14],
    ['ngw-15', 'non_girls_week', '17:00', '17:45', 'Family Hangout', '', 0, 15],
    ['ngw-16', 'non_girls_week', '17:45', '18:30', 'Homework Time', 'Learning profiles, generate worksheets, supervise, update profiles.', 0, 16],
    ['ngw-17', 'non_girls_week', '18:30', '19:15', 'Dinner', 'Cook, eat, cleanup as family.', 0, 17],
    ['ngw-18', 'non_girls_week', '19:15', '19:45', 'Family Hangout', '', 0, 18],
    ['ngw-19', 'non_girls_week', '19:45', '20:15', 'Bedtime Routine', 'Teeth, pajamas, read Bible, tuck in.', 0, 19],
    ['ngw-20', 'non_girls_week', '20:15', '21:15', 'Haley Time', 'Protected.', 1, 20],
    ['ngw-21', 'non_girls_week', '21:15', '21:30', 'Get Ready for Bed', '', 0, 21],
  ];

  // Girls week
  const gw = [
    ['gw-1', 'girls_week', '05:00', '06:00', 'God Time', 'Open @prayers on phone. Physical Bible, physical journal.', 1, 1],
    ['gw-2', 'girls_week', '06:00', '06:45', 'Creative Nurik Work', 'House quiet — good for content, methodology, thinking docs.', 0, 2],
    ['gw-3', 'girls_week', '06:45', '07:15', 'Get Ready', 'Help all four kids get ready.', 0, 3],
    ['gw-4', 'girls_week', '07:15', '07:30', 'Haley Leaves', 'Haley leaves with girls. Boys on bus by 7:45.', 0, 4],
    ['gw-5', 'girls_week', '07:30', '08:00', 'Morning Processing', 'Daily note, reflection, inbox, email, revenue focus, top 3.', 1, 5],
    ['gw-6', 'girls_week', '08:00', '08:30', 'Deep Work or Admin', 'Haley still out.', 0, 6],
    ['gw-7', 'girls_week', '08:30', '09:15', 'Couples Workout', 'Workout with Haley.', 0, 7],
    ['gw-8', 'girls_week', '09:15', '09:30', 'Shower', 'Get ready for work.', 0, 8],
    ['gw-9', 'girls_week', '09:30', '10:00', 'LinkedIn', 'Daily LinkedIn block.', 0, 9],
    ['gw-10', 'girls_week', '10:00', '12:00', 'Deep Work 1+2: Revenue + Building', 'Combined revenue priority and business building.', 0, 10],
    ['gw-11', 'girls_week', '12:00', '12:30', 'Lunch & Email', 'Lunch, email, phone calls.', 0, 11],
    ['gw-12', 'girls_week', '12:30', '15:00', 'Deep Work 3: Themed', 'Same rotation as non-girls week. May get cut short.', 0, 12],
    ['gw-13', 'girls_week', '15:00', '15:15', 'Shutdown', 'Capture sweep, scan for uncaptured commitments, write Tomorrow.', 0, 13],
    ['gw-14', 'girls_week', '15:20', '16:30', 'School Pickup', 'Drive to Baton Rouge and back.', 0, 14],
    ['gw-15', 'girls_week', '16:30', '17:15', 'Family Hangout', 'All four kids home.', 0, 15],
    ['gw-16', 'girls_week', '17:15', '18:00', 'Homework Time', 'Four kids. Learning profiles, worksheets, supervise, update.', 0, 16],
    ['gw-17', 'girls_week', '18:00', '18:45', 'Dinner', '', 0, 17],
    ['gw-18', 'girls_week', '18:45', '19:00', 'Family Cleanup', '', 0, 18],
    ['gw-19', 'girls_week', '19:00', '19:45', 'Family Hangout', '', 0, 19],
    ['gw-20', 'girls_week', '19:45', '20:15', 'Bedtime Routine', '', 0, 20],
    ['gw-21', 'girls_week', '20:15', '21:15', 'Haley Time', 'Protected.', 1, 21],
    ['gw-22', 'girls_week', '21:15', '21:30', 'Get Ready for Bed', '', 0, 22],
  ];

  // Saturday
  const sat = [
    ['sat-1', 'saturday', '05:00', '06:00', 'God Time', '', 1, 1],
    ['sat-2', 'saturday', '06:00', '07:30', 'Recording Session', 'Process Voice Memos inbox, creative work in Studio One.', 0, 2],
    ['sat-3', 'saturday', '07:30', '08:30', 'Weekly Review', 'With Claude. Non-negotiable.', 1, 3],
    ['sat-4', 'saturday', '09:00', '09:30', 'Family Meeting', 'Girls weeks only. Highs/lows, celebrate, address topics, chores, upcoming, fun.', 0, 4],
    ['sat-5', 'saturday', '09:30', '21:30', 'Family Day', '', 0, 5],
  ];

  // Sunday
  const sun = [
    ['sun-1', 'sunday', '05:00', '06:00', 'God Time', '', 1, 1],
    ['sun-2', 'sunday', '06:00', '07:30', 'Creative Nurik Work', '', 0, 2],
    ['sun-3', 'sunday', '07:30', '08:30', 'Get Ready for Church', 'Family ready for church.', 0, 3],
    ['sun-4', 'sunday', '08:30', '09:00', 'Drive to Lafayette', '', 0, 4],
    ['sun-5', 'sunday', '10:00', '12:00', 'Church Service', '', 0, 5],
    ['sun-6', 'sunday', '12:00', '14:30', "Haley's Family Time", '', 0, 6],
    ['sun-7', 'sunday', '15:00', '21:30', 'Family Afternoon', 'Rest. No work pressure.', 0, 7],
  ];

  for (const row of [...ngw, ...gw, ...sat, ...sun]) {
    await sql`INSERT INTO routine_blocks (id, routine_type, start_time, end_time, label, description, is_non_negotiable, sort_order) VALUES (${row[0]}, ${row[1]}, ${row[2]}, ${row[3]}, ${row[4]}, ${row[5]}, ${row[6]}, ${row[7]})`;
  }
}
