-- Track backup history
CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'scheduled'
);
