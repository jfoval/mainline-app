-- Add updated_at to synced tables that lack it (for conflict detection)
-- Note: ALTER TABLE ADD COLUMN requires constant defaults in SQLite
ALTER TABLE next_actions ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE inbox_items ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE list_items ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE pipeline_contacts ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE pipeline_warm_leads ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE daily_notes ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE routine_blocks ADD COLUMN updated_at TEXT DEFAULT '';
