/**
 * Screenshot data swap script
 *
 * Usage:
 *   node scripts/screenshot-swap.mjs backup    — saves current data to /tmp/mainline-backup.json
 *   node scripts/screenshot-swap.mjs seed      — clears tables & inserts demo data
 *   node scripts/screenshot-swap.mjs restore   — restores from backup
 *
 * Typical workflow:
 *   1. node scripts/screenshot-swap.mjs backup
 *   2. node scripts/screenshot-swap.mjs seed
 *   3. ... take screenshots ...
 *   4. node scripts/screenshot-swap.mjs restore
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const dbUrl = envFile.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
if (!dbUrl) { console.error('No DATABASE_URL found'); process.exit(1); }

const sql = neon(dbUrl);
const BACKUP_PATH = '/tmp/mainline-backup.json';
const action = process.argv[2];

async function backup() {
  console.log('Backing up all data...');
  const data = {};
  data.next_actions = await sql`SELECT * FROM next_actions`;
  data.projects = await sql`SELECT * FROM projects`;
  data.inbox_items = await sql`SELECT * FROM inbox_items`;
  data.journal_entries = await sql`SELECT * FROM journal_entries`;
  data.horizon_items = await sql`SELECT * FROM horizon_items`;
  data.disciplines = await sql`SELECT * FROM disciplines`;
  data.discipline_logs = await sql`SELECT * FROM discipline_logs`;
  data.daily_notes = await sql`SELECT * FROM daily_notes`;
  data.daily_blocks = await sql`SELECT * FROM daily_blocks`;
  data.context_lists = await sql`SELECT * FROM context_lists`;
  try { data.reference_docs = await sql`SELECT * FROM reference_docs`; } catch { data.reference_docs = []; }
  data.settings = await sql`SELECT * FROM settings`;
  data.week_patterns = await sql`SELECT * FROM week_patterns`;
  data.week_pattern_blocks = await sql`SELECT * FROM week_pattern_blocks`;
  try { data.week_schedule = await sql`SELECT * FROM week_schedule`; } catch { data.week_schedule = []; }
  try { data.week_pattern_rotation = await sql`SELECT * FROM week_pattern_rotation`; } catch { data.week_pattern_rotation = []; }
  data.horizons = await sql`SELECT * FROM horizons`;
  for (const [k, v] of Object.entries(data)) console.log(`  ${k}: ${v.length} rows`);
  writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));
  console.log(`\nBackup saved to ${BACKUP_PATH}`);
}

async function clearUserData() {
  await sql`DELETE FROM discipline_logs`;
  await sql`DELETE FROM next_actions`;
  await sql`DELETE FROM daily_blocks`;
  await sql`DELETE FROM daily_notes`;
  await sql`DELETE FROM journal_entries`;
  await sql`DELETE FROM horizon_items`;
  await sql`DELETE FROM disciplines`;
  await sql`DELETE FROM inbox_items`;
  await sql`DELETE FROM projects`;
}

async function seed() {
  console.log('Clearing tables and inserting demo data...');
  await clearUserData();
  console.log('  Tables cleared');

  // PROJECTS (columns: id, title, category, purpose, status)
  await sql`INSERT INTO projects (id, title, category, purpose, status) VALUES
    ('demo-proj-1', 'Website Redesign', 'work', 'Modernize company website to improve conversions', 'active'),
    ('demo-proj-2', 'Q2 Marketing Plan', 'work', 'Plan marketing initiatives for next quarter', 'active'),
    ('demo-proj-3', 'Kitchen Renovation', 'home', 'Update kitchen countertops and backsplash', 'active'),
    ('demo-proj-4', 'Family Vacation Planning', 'personal', 'Plan summer trip to Colorado', 'active'),
    ('demo-proj-5', 'Hire Content Writer', 'work', 'Find and onboard a freelance content writer', 'active')`;
  console.log('  5 projects');

  // NEXT ACTIONS (columns: id, content, context, project_id, status, sort_order, added_at)
  await sql`INSERT INTO next_actions (id, content, context, project_id, status, sort_order, added_at) VALUES
    ('demo-na-1', 'Draft wireframes for new landing page', 'work', 'demo-proj-1', 'active', 0, NOW()),
    ('demo-na-2', 'Review content writer portfolio samples', 'work', 'demo-proj-5', 'active', 1, NOW()),
    ('demo-na-3', 'Finalize Q2 budget spreadsheet', 'work', 'demo-proj-2', 'active', 2, NOW()),
    ('demo-na-4', 'Send brand guidelines to designer', 'work', 'demo-proj-1', 'active', 3, NOW()),
    ('demo-na-5', 'Pick up tile samples from Home Depot', 'errands', 'demo-proj-3', 'active', 0, NOW()),
    ('demo-na-6', 'Drop off dry cleaning', 'errands', NULL, 'active', 1, NOW()),
    ('demo-na-7', 'Measure kitchen countertops for contractor', 'home', 'demo-proj-3', 'active', 0, NOW()),
    ('demo-na-8', 'Replace air filters in HVAC', 'home', NULL, 'active', 1, NOW()),
    ('demo-na-9', 'Call contractor about backsplash timeline', 'calls', 'demo-proj-3', 'active', 0, NOW()),
    ('demo-na-10', 'Schedule dentist appointment for kids', 'calls', NULL, 'active', 1, NOW()),
    ('demo-na-11', 'Waiting on designer for homepage mockup', 'waiting_for', 'demo-proj-1', 'active', 0, NOW()),
    ('demo-na-12', 'Waiting on travel agent for cabin options', 'waiting_for', 'demo-proj-4', 'active', 1, NOW()),
    ('demo-na-13', 'Research SEO tools for website launch', 'computer', 'demo-proj-1', 'active', 0, NOW()),
    ('demo-na-14', 'Update family calendar with vacation dates', 'computer', 'demo-proj-4', 'active', 1, NOW()),
    ('demo-na-15', 'Brainstorm blog post topics for Q2', 'anywhere', 'demo-proj-2', 'active', 0, NOW())`;
  await sql`INSERT INTO next_actions (id, content, context, project_id, status, sort_order, added_at, completed_at) VALUES
    ('demo-na-c1', 'Set up analytics dashboard', 'work', 'demo-proj-1', 'completed', 10, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
    ('demo-na-c2', 'Book flights to Denver', 'computer', 'demo-proj-4', 'completed', 11, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),
    ('demo-na-c3', 'Post content writer job listing', 'work', 'demo-proj-5', 'completed', 12, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')`;
  console.log('  18 actions');

  // INBOX ITEMS (columns: id, content, status, captured_at)
  await sql`INSERT INTO inbox_items (id, content, status, captured_at) VALUES
    ('demo-inbox-1', 'Email from client about logo revisions', 'pending', NOW() - INTERVAL '2 hours'),
    ('demo-inbox-2', 'Idea: create a weekly team standup template', 'pending', NOW() - INTERVAL '2 hours'),
    ('demo-inbox-3', 'Check if car registration is due this month', 'pending', NOW() - INTERVAL '2 hours'),
    ('demo-inbox-4', 'Mom''s birthday is April 12 — plan something', 'pending', NOW() - INTERVAL '2 hours'),
    ('demo-inbox-5', 'Look into podcast editing software', 'pending', NOW() - INTERVAL '2 hours')`;
  console.log('  5 inbox items');

  // DISCIPLINES
  await sql`INSERT INTO disciplines (id, name, type, description, frequency, time_of_day, is_active, sort_order) VALUES
    ('demo-disc-1', 'Exercise', 'discipline', 'Move your body for at least 30 minutes', 'daily', 'morning', 1, 0),
    ('demo-disc-2', 'Meditate', 'discipline', '10 minutes of mindfulness', 'daily', 'morning', 1, 1),
    ('demo-disc-3', 'Read 30 min', 'discipline', 'Read something meaningful', 'daily', 'evening', 1, 2)`;
  console.log('  3 disciplines');

  // DISCIPLINE LOGS (14 days, ~75% completion)
  const patterns = {
    'demo-disc-1': [1,1,1,0,1,1,0,1,1,1,0,1,1,1],
    'demo-disc-2': [1,0,1,1,1,0,1,1,0,1,1,1,0,1],
    'demo-disc-3': [0,1,1,1,0,1,1,0,1,1,1,1,0,1],
  };
  for (const [discId, vals] of Object.entries(patterns)) {
    for (let i = 0; i < vals.length; i++) {
      const d = new Date('2026-03-30');
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const p = discId.replace('demo-', '');
      await sql`INSERT INTO discipline_logs (id, discipline_id, date, completed)
        VALUES (${`demo-dl-${p}-${i}`}, ${discId}, ${ds}, ${vals[i]})`;
    }
  }
  console.log('  42 discipline logs');

  // JOURNAL ENTRIES
  await sql`INSERT INTO journal_entries (id, entry_date, content, tag) VALUES
    ('demo-je-1', '2026-03-30', 'Productive morning. Got the wireframes started and had a great call with the designer. Feeling optimistic about the website redesign timeline.', 'win'),
    ('demo-je-2', '2026-03-29', 'Realized I''ve been spending too much time in email and not enough on deep work. Need to block off mornings more intentionally.', 'lesson'),
    ('demo-je-3', '2026-03-28', 'Kids are excited about the Colorado trip. Started looking at cabin rentals near Breckenridge. Family time is the best investment.', 'gratitude'),
    ('demo-je-4', '2026-03-27', 'Idea: what if we did a monthly newsletter instead of weekly? Less pressure, higher quality, more sustainable.', 'idea'),
    ('demo-je-5', '2026-03-26', 'Hit a wall on the marketing plan. Can''t decide between doubling down on content or investing in paid ads. Need to sleep on it.', 'struggle')`;
  console.log('  5 journal entries');

  // DAILY NOTES
  await sql`INSERT INTO daily_notes (id, date, top3_first, top3_second, top3_third, reflection_who_to_be, reflection_matters_most) VALUES
    ('demo-dn-1', '2026-03-30', 'Finish landing page wireframes', 'Review content writer candidates', 'Call contractor about kitchen timeline', 'Focused and present — no phone during family dinner', 'Making progress on the website redesign before end of week')`;
  console.log('  1 daily note');

  // HORIZON ITEMS
  await sql`INSERT INTO horizon_items (id, horizon_type, name, description, sort_order) VALUES
    ('demo-hi-1', 'purpose', 'Build meaningful things that help people live more intentionally', NULL, 0),
    ('demo-hi-2', 'vision', 'Running a profitable business with a small team, working 4 days a week', NULL, 0),
    ('demo-hi-3', 'vision', 'Kids are thriving, family takes 2 big trips per year', NULL, 1),
    ('demo-hi-4', 'goals', 'Launch redesigned website and double inbound leads', NULL, 0),
    ('demo-hi-5', 'goals', 'Hire first two team members by Q4', NULL, 1),
    ('demo-hi-6', 'goals', 'Complete kitchen renovation by summer', NULL, 2),
    ('demo-hi-7', 'areas_of_focus', 'Business growth & revenue', 'Sales pipeline, marketing, product development', 0),
    ('demo-hi-8', 'areas_of_focus', 'Family & relationships', 'Quality time with kids, date nights, staying connected', 1),
    ('demo-hi-9', 'areas_of_focus', 'Health & fitness', 'Consistent exercise, nutrition, sleep', 2),
    ('demo-hi-10', 'areas_of_focus', 'Home & environment', 'Renovation projects, organization, creating a calm space', 3),
    ('demo-hi-11', 'areas_of_focus', 'Personal growth', 'Reading, reflection, learning new skills', 4),
    ('demo-hi-12', 'growth_intentions', 'Patience', 'Especially with the kids and with slow-moving projects', 0),
    ('demo-hi-13', 'growth_intentions', 'Strategic thinking', 'Zoom out more often', 1),
    ('demo-hi-14', 'growth_intentions', 'Consistency over intensity', 'Small daily habits beat occasional big pushes', 2)`;
  console.log('  14 horizon items');

  console.log('\n✅ Demo data seeded! Ready for screenshots.');
  console.log('   When done: node scripts/screenshot-swap.mjs restore');
}

async function restore() {
  console.log('Restoring from backup...');
  const data = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'));

  await clearUserData();
  console.log('  Tables cleared');

  // Helper: insert rows with ON CONFLICT DO NOTHING, using tagged template per column set
  // Neon requires tagged template literals — cannot use sql() as a regular function.
  // Each table is handled individually with its exact column list.

  let count;

  // PROJECTS
  if (data.projects?.length) {
    count = 0;
    for (const r of data.projects) {
      try {
        await sql`INSERT INTO projects (id, title, category, purpose, key_milestones, planning_steps, notes, status, created_at, updated_at, completed_at)
          VALUES (${r.id}, ${r.title}, ${r.category}, ${r.purpose ?? null}, ${r.key_milestones ?? null}, ${r.planning_steps ?? null}, ${r.notes ?? null}, ${r.status}, ${r.created_at ?? null}, ${r.updated_at ?? null}, ${r.completed_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  projects: ${count}/${data.projects.length} rows`);
  }

  // NEXT ACTIONS
  if (data.next_actions?.length) {
    count = 0;
    for (const r of data.next_actions) {
      try {
        await sql`INSERT INTO next_actions (id, content, context, project_id, waiting_on_person, waiting_since, agenda_person, added_at, completed_at, status, sort_order, updated_at)
          VALUES (${r.id}, ${r.content}, ${r.context}, ${r.project_id ?? null}, ${r.waiting_on_person ?? null}, ${r.waiting_since ?? null}, ${r.agenda_person ?? null}, ${r.added_at ?? null}, ${r.completed_at ?? null}, ${r.status}, ${r.sort_order ?? 0}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  next_actions: ${count}/${data.next_actions.length} rows`);
  }

  // INBOX ITEMS
  if (data.inbox_items?.length) {
    count = 0;
    for (const r of data.inbox_items) {
      try {
        await sql`INSERT INTO inbox_items (id, content, source, url, captured_at, processed_at, status, updated_at)
          VALUES (${r.id}, ${r.content}, ${r.source ?? null}, ${r.url ?? null}, ${r.captured_at ?? null}, ${r.processed_at ?? null}, ${r.status}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  inbox_items: ${count}/${data.inbox_items.length} rows`);
  }

  // DISCIPLINES
  if (data.disciplines?.length) {
    count = 0;
    for (const r of data.disciplines) {
      try {
        await sql`INSERT INTO disciplines (id, name, type, description, frequency, time_of_day, is_active, sort_order, created_at, updated_at)
          VALUES (${r.id}, ${r.name}, ${r.type}, ${r.description ?? null}, ${r.frequency}, ${r.time_of_day ?? null}, ${r.is_active}, ${r.sort_order ?? 0}, ${r.created_at ?? null}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  disciplines: ${count}/${data.disciplines.length} rows`);
  }

  // DISCIPLINE LOGS
  if (data.discipline_logs?.length) {
    count = 0;
    for (const r of data.discipline_logs) {
      try {
        await sql`INSERT INTO discipline_logs (id, discipline_id, date, completed, notes, created_at)
          VALUES (${r.id}, ${r.discipline_id}, ${r.date}, ${r.completed}, ${r.notes ?? null}, ${r.created_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  discipline_logs: ${count}/${data.discipline_logs.length} rows`);
  }

  // DAILY NOTES
  if (data.daily_notes?.length) {
    count = 0;
    for (const r of data.daily_notes) {
      try {
        await sql`INSERT INTO daily_notes (id, date, reflection_showed_up, reflection_fell_short, reflection_noticed, reflection_grateful, top3_first, top3_second, top3_third, notes, tomorrow, created_at, updated_at, reflection_matters_most, reflection_who_to_be, reflection_one_action, evening_did_well, evening_fell_short, evening_do_differently, inbox_checks)
          VALUES (${r.id}, ${r.date}, ${r.reflection_showed_up ?? null}, ${r.reflection_fell_short ?? null}, ${r.reflection_noticed ?? null}, ${r.reflection_grateful ?? null}, ${r.top3_first ?? null}, ${r.top3_second ?? null}, ${r.top3_third ?? null}, ${r.notes ?? null}, ${r.tomorrow ?? null}, ${r.created_at ?? null}, ${r.updated_at ?? null}, ${r.reflection_matters_most ?? null}, ${r.reflection_who_to_be ?? null}, ${r.reflection_one_action ?? null}, ${r.evening_did_well ?? null}, ${r.evening_fell_short ?? null}, ${r.evening_do_differently ?? null}, ${r.inbox_checks ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  daily_notes: ${count}/${data.daily_notes.length} rows`);
  }

  // DAILY BLOCKS
  if (data.daily_blocks?.length) {
    count = 0;
    for (const r of data.daily_blocks) {
      try {
        await sql`INSERT INTO daily_blocks (id, date, start_time, end_time, label, description, is_non_negotiable, source_block_id, created_at, updated_at)
          VALUES (${r.id}, ${r.date}, ${r.start_time}, ${r.end_time}, ${r.label ?? null}, ${r.description ?? null}, ${r.is_non_negotiable ?? false}, ${r.source_block_id ?? null}, ${r.created_at ?? null}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  daily_blocks: ${count}/${data.daily_blocks.length} rows`);
  }

  // JOURNAL ENTRIES
  if (data.journal_entries?.length) {
    count = 0;
    for (const r of data.journal_entries) {
      try {
        await sql`INSERT INTO journal_entries (id, entry_date, content, tag, created_at, updated_at)
          VALUES (${r.id}, ${r.entry_date}, ${r.content}, ${r.tag ?? null}, ${r.created_at ?? null}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  journal_entries: ${count}/${data.journal_entries.length} rows`);
  }

  // HORIZON ITEMS
  if (data.horizon_items?.length) {
    count = 0;
    for (const r of data.horizon_items) {
      try {
        await sql`INSERT INTO horizon_items (id, horizon_type, name, description, sort_order, created_at, updated_at)
          VALUES (${r.id}, ${r.horizon_type}, ${r.name}, ${r.description ?? null}, ${r.sort_order ?? 0}, ${r.created_at ?? null}, ${r.updated_at ?? null})
          ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* skip */ }
    }
    console.log(`  horizon_items: ${count}/${data.horizon_items.length} rows`);
  }

  console.log('\n✅ Data restored!');
}

if (action === 'backup') await backup();
else if (action === 'seed') await seed();
else if (action === 'restore') await restore();
else console.log('Usage: node scripts/screenshot-swap.mjs [backup|seed|restore]');
