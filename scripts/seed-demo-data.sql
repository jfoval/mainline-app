-- ============================================================
-- MAINLINE — Demo Data Seed for Screenshots
-- ============================================================
-- Run this against a CLEAN database (after initial setup).
-- It populates realistic example data for documentation screenshots.
--
-- USAGE: Copy & paste into Neon SQL Editor, or run via psql:
--   psql $DATABASE_URL -f scripts/seed-demo-data.sql
--
-- TO RESET: Drop all data and re-run app setup, or run the
-- cleanup block at the bottom of this file.
-- ============================================================

-- ---- PROJECTS ----
-- Clear existing demo data (safe — uses specific IDs)
DELETE FROM next_actions WHERE id LIKE 'demo-%';
DELETE FROM projects WHERE id LIKE 'demo-%';
DELETE FROM inbox_items WHERE id LIKE 'demo-%';
DELETE FROM journal_entries WHERE id LIKE 'demo-%';
DELETE FROM horizon_items WHERE id LIKE 'demo-%';
DELETE FROM discipline_logs WHERE id LIKE 'demo-%';
DELETE FROM disciplines WHERE id LIKE 'demo-%';
DELETE FROM daily_notes WHERE date IN ('2026-03-30', '2026-03-29', '2026-03-28');

INSERT INTO projects (id, title, description, category, status, created_at) VALUES
  ('demo-proj-1', 'Website Redesign', 'Modernize company website to improve conversions', 'work', 'active', NOW()),
  ('demo-proj-2', 'Q2 Marketing Plan', 'Plan marketing initiatives for next quarter', 'work', 'active', NOW()),
  ('demo-proj-3', 'Kitchen Renovation', 'Update kitchen countertops and backsplash', 'home', 'active', NOW()),
  ('demo-proj-4', 'Family Vacation Planning', 'Plan summer trip to Colorado', 'personal', 'active', NOW()),
  ('demo-proj-5', 'Hire Content Writer', 'Find and onboard a freelance content writer', 'work', 'active', NOW());

-- ---- NEXT ACTIONS (across contexts) ----
INSERT INTO next_actions (id, content, context, project_id, status, sort_order, added_at) VALUES
  -- @Work
  ('demo-na-1', 'Draft wireframes for new landing page', 'work', 'demo-proj-1', 'active', 0, NOW()),
  ('demo-na-2', 'Review content writer portfolio samples', 'work', 'demo-proj-5', 'active', 1, NOW()),
  ('demo-na-3', 'Finalize Q2 budget spreadsheet', 'work', 'demo-proj-2', 'active', 2, NOW()),
  ('demo-na-4', 'Send brand guidelines to designer', 'work', 'demo-proj-1', 'active', 3, NOW()),
  -- @Errands
  ('demo-na-5', 'Pick up tile samples from Home Depot', 'errands', 'demo-proj-3', 'active', 0, NOW()),
  ('demo-na-6', 'Drop off dry cleaning', 'errands', NULL, 'active', 1, NOW()),
  -- @Home
  ('demo-na-7', 'Measure kitchen countertops for contractor quote', 'home', 'demo-proj-3', 'active', 0, NOW()),
  ('demo-na-8', 'Replace air filters in HVAC', 'home', NULL, 'active', 1, NOW()),
  -- @Calls
  ('demo-na-9', 'Call contractor about backsplash timeline', 'calls', 'demo-proj-3', 'active', 0, NOW()),
  ('demo-na-10', 'Schedule dentist appointment for kids', 'calls', NULL, 'active', 1, NOW()),
  -- @Waiting For
  ('demo-na-11', 'Waiting on designer for homepage mockup', 'waiting_for', 'demo-proj-1', 'active', 0, NOW()),
  ('demo-na-12', 'Waiting on travel agent for Colorado cabin options', 'waiting_for', 'demo-proj-4', 'active', 1, NOW()),
  -- @Computer
  ('demo-na-13', 'Research SEO tools for website launch', 'computer', 'demo-proj-1', 'active', 0, NOW()),
  ('demo-na-14', 'Update family shared calendar with vacation dates', 'computer', 'demo-proj-4', 'active', 1, NOW()),
  -- @Anywhere
  ('demo-na-15', 'Brainstorm blog post topics for Q2', 'anywhere', 'demo-proj-2', 'active', 0, NOW()),
  -- A few completed ones for history
  ('demo-na-c1', 'Set up analytics dashboard', 'work', 'demo-proj-1', 'completed', 0, NOW() - INTERVAL '3 days'),
  ('demo-na-c2', 'Book flights to Denver', 'computer', 'demo-proj-4', 'completed', 0, NOW() - INTERVAL '5 days'),
  ('demo-na-c3', 'Post content writer job listing', 'work', 'demo-proj-5', 'completed', 0, NOW() - INTERVAL '2 days');

-- ---- INBOX ITEMS ----
INSERT INTO inbox_items (id, content, status, created_at) VALUES
  ('demo-inbox-1', 'Email from client about logo revisions', 'pending', NOW() - INTERVAL '2 hours'),
  ('demo-inbox-2', 'Idea: create a weekly team standup template', 'pending', NOW() - INTERVAL '2 hours'),
  ('demo-inbox-3', 'Check if car registration is due this month', 'pending', NOW() - INTERVAL '2 hours'),
  ('demo-inbox-4', 'Mom''s birthday is April 12 — plan something', 'pending', NOW() - INTERVAL '2 hours'),
  ('demo-inbox-5', 'Look into podcast editing software', 'pending', NOW() - INTERVAL '2 hours');

-- ---- DISCIPLINES ----
INSERT INTO disciplines (id, name, type, description, frequency, time_of_day, is_active, sort_order) VALUES
  ('demo-disc-1', 'Exercise', 'discipline', 'Move your body for at least 30 minutes', 'daily', 'morning', 1, 0),
  ('demo-disc-2', 'Meditate', 'discipline', '10 minutes of mindfulness', 'daily', 'morning', 1, 1),
  ('demo-disc-3', 'Read 30 min', 'discipline', 'Read something meaningful', 'daily', 'evening', 1, 2);

-- ---- DISCIPLINE LOGS (last 14 days of history) ----
-- This creates a realistic pattern: ~70-80% completion
INSERT INTO discipline_logs (id, discipline_id, date, completed) VALUES
  -- Exercise
  ('demo-dl-e1', 'demo-disc-1', '2026-03-30', 1),
  ('demo-dl-e2', 'demo-disc-1', '2026-03-29', 1),
  ('demo-dl-e3', 'demo-disc-1', '2026-03-28', 1),
  ('demo-dl-e4', 'demo-disc-1', '2026-03-27', 0),
  ('demo-dl-e5', 'demo-disc-1', '2026-03-26', 1),
  ('demo-dl-e6', 'demo-disc-1', '2026-03-25', 1),
  ('demo-dl-e7', 'demo-disc-1', '2026-03-24', 0),
  ('demo-dl-e8', 'demo-disc-1', '2026-03-23', 1),
  ('demo-dl-e9', 'demo-disc-1', '2026-03-22', 1),
  ('demo-dl-e10', 'demo-disc-1', '2026-03-21', 1),
  ('demo-dl-e11', 'demo-disc-1', '2026-03-20', 0),
  ('demo-dl-e12', 'demo-disc-1', '2026-03-19', 1),
  ('demo-dl-e13', 'demo-disc-1', '2026-03-18', 1),
  ('demo-dl-e14', 'demo-disc-1', '2026-03-17', 1),
  -- Meditate
  ('demo-dl-m1', 'demo-disc-2', '2026-03-30', 1),
  ('demo-dl-m2', 'demo-disc-2', '2026-03-29', 0),
  ('demo-dl-m3', 'demo-disc-2', '2026-03-28', 1),
  ('demo-dl-m4', 'demo-disc-2', '2026-03-27', 1),
  ('demo-dl-m5', 'demo-disc-2', '2026-03-26', 1),
  ('demo-dl-m6', 'demo-disc-2', '2026-03-25', 0),
  ('demo-dl-m7', 'demo-disc-2', '2026-03-24', 1),
  ('demo-dl-m8', 'demo-disc-2', '2026-03-23', 1),
  ('demo-dl-m9', 'demo-disc-2', '2026-03-22', 0),
  ('demo-dl-m10', 'demo-disc-2', '2026-03-21', 1),
  ('demo-dl-m11', 'demo-disc-2', '2026-03-20', 1),
  ('demo-dl-m12', 'demo-disc-2', '2026-03-19', 1),
  ('demo-dl-m13', 'demo-disc-2', '2026-03-18', 0),
  ('demo-dl-m14', 'demo-disc-2', '2026-03-17', 1),
  -- Read 30 min
  ('demo-dl-r1', 'demo-disc-3', '2026-03-30', 0),
  ('demo-dl-r2', 'demo-disc-3', '2026-03-29', 1),
  ('demo-dl-r3', 'demo-disc-3', '2026-03-28', 1),
  ('demo-dl-r4', 'demo-disc-3', '2026-03-27', 1),
  ('demo-dl-r5', 'demo-disc-3', '2026-03-26', 0),
  ('demo-dl-r6', 'demo-disc-3', '2026-03-25', 1),
  ('demo-dl-r7', 'demo-disc-3', '2026-03-24', 1),
  ('demo-dl-r8', 'demo-disc-3', '2026-03-23', 0),
  ('demo-dl-r9', 'demo-disc-3', '2026-03-22', 1),
  ('demo-dl-r10', 'demo-disc-3', '2026-03-21', 1),
  ('demo-dl-r11', 'demo-disc-3', '2026-03-20', 1),
  ('demo-dl-r12', 'demo-disc-3', '2026-03-19', 1),
  ('demo-dl-r13', 'demo-disc-3', '2026-03-18', 0),
  ('demo-dl-r14', 'demo-disc-3', '2026-03-17', 1);

-- ---- JOURNAL ENTRIES ----
INSERT INTO journal_entries (id, entry_date, content, tag, created_at) VALUES
  ('demo-je-1', '2026-03-30', 'Productive morning. Got the wireframes started and had a great call with the designer. Feeling optimistic about the website redesign timeline.', 'win', NOW()),
  ('demo-je-2', '2026-03-29', 'Realized I''ve been spending too much time in email and not enough on deep work. Need to block off mornings more intentionally.', 'lesson', NOW() - INTERVAL '1 day'),
  ('demo-je-3', '2026-03-28', 'Kids are excited about the Colorado trip. Started looking at cabin rentals near Breckenridge. Family time is the best investment.', 'gratitude', NOW() - INTERVAL '2 days'),
  ('demo-je-4', '2026-03-27', 'Idea: what if we did a monthly newsletter instead of weekly? Less pressure, higher quality, more sustainable.', 'idea', NOW() - INTERVAL '3 days'),
  ('demo-je-5', '2026-03-26', 'Hit a wall on the marketing plan. Can''t decide between doubling down on content or investing in paid ads. Need to sleep on it.', 'struggle', NOW() - INTERVAL '4 days');

-- ---- DAILY NOTES (for Morning Process screenshot) ----
INSERT INTO daily_notes (id, date, top3_first, top3_second, top3_third, reflection_who_to_be, reflection_matters_most) VALUES
  ('demo-dn-1', '2026-03-30', 'Finish landing page wireframes', 'Review content writer candidates', 'Call contractor about kitchen timeline', 'Focused and present — no phone during family dinner', 'Making progress on the website redesign before end of week');

-- ---- HORIZON ITEMS ----
INSERT INTO horizon_items (id, horizon_type, name, description, sort_order) VALUES
  -- Purpose
  ('demo-hi-1', 'purpose', 'Build meaningful things that help people live more intentionally', NULL, 0),
  -- Vision (3-5 years)
  ('demo-hi-2', 'vision', 'Running a profitable business with a small team, working 4 days a week', NULL, 0),
  ('demo-hi-3', 'vision', 'Kids are thriving, family takes 2 big trips per year', NULL, 1),
  -- Goals (1-2 years)
  ('demo-hi-4', 'goals', 'Launch redesigned website and double inbound leads', NULL, 0),
  ('demo-hi-5', 'goals', 'Hire first two team members by Q4', NULL, 1),
  ('demo-hi-6', 'goals', 'Complete kitchen renovation by summer', NULL, 2),
  -- Areas of Focus
  ('demo-hi-7', 'areas_of_focus', 'Business growth & revenue', 'Sales pipeline, marketing, product development', 0),
  ('demo-hi-8', 'areas_of_focus', 'Family & relationships', 'Quality time with kids, date nights, staying connected with friends', 1),
  ('demo-hi-9', 'areas_of_focus', 'Health & fitness', 'Consistent exercise, nutrition, sleep', 2),
  ('demo-hi-10', 'areas_of_focus', 'Home & environment', 'Renovation projects, organization, creating a calm space', 3),
  ('demo-hi-11', 'areas_of_focus', 'Personal growth', 'Reading, reflection, learning new skills', 4),
  -- Growth Intentions
  ('demo-hi-12', 'growth_intentions', 'Patience', 'Especially with the kids and with slow-moving projects', 0),
  ('demo-hi-13', 'growth_intentions', 'Strategic thinking', 'Zoom out more often — work on the business, not just in it', 1),
  ('demo-hi-14', 'growth_intentions', 'Consistency over intensity', 'Small daily habits beat occasional big pushes', 2);

-- ============================================================
-- CLEANUP (run this to remove all demo data):
-- DELETE FROM next_actions WHERE id LIKE 'demo-%';
-- DELETE FROM projects WHERE id LIKE 'demo-%';
-- DELETE FROM inbox_items WHERE id LIKE 'demo-%';
-- DELETE FROM journal_entries WHERE id LIKE 'demo-%';
-- DELETE FROM horizon_items WHERE id LIKE 'demo-%';
-- DELETE FROM discipline_logs WHERE id LIKE 'demo-%';
-- DELETE FROM disciplines WHERE id LIKE 'demo-%';
-- DELETE FROM daily_notes WHERE date IN ('2026-03-30', '2026-03-29', '2026-03-28');
-- ============================================================
