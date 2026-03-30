import sql from './db';

// Default retention periods in days
const DEFAULT_RETENTION: Record<string, number> = {
  inbox_days: 30,          // processed inbox items
  actions_days: 90,        // completed/archived actions
  projects_days: 90,       // completed/archived projects
  discipline_logs_days: 90,// discipline log entries
  daily_blocks_days: 30,   // ephemeral schedule copies
  backup_log_days: 90,     // backup history
};

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getRetentionSettings(): Promise<Record<string, number>> {
  const settings = { ...DEFAULT_RETENTION };
  try {
    const rows = await sql`
      SELECT key, value FROM settings WHERE key LIKE 'retention_%'
    `;
    for (const row of rows) {
      const shortKey = (row.key as string).replace('retention_', '');
      const val = parseInt(row.value as string, 10);
      if (!isNaN(val) && val > 0) {
        settings[shortKey] = val;
      }
    }
  } catch {
    // Settings table may not exist yet
  }
  return settings;
}

export async function runCleanupIfDue(): Promise<void> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'last_cleanup'`;
    if (rows.length > 0) {
      const last = new Date(rows[0].value as string);
      const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }
  } catch {
    // Settings table may not exist yet — skip cleanup
    return;
  }

  await runCleanup();
}

export async function runCleanup(): Promise<Record<string, number>> {
  const retention = await getRetentionSettings();
  const stats: Record<string, number> = {};

  // 1. Processed inbox items
  const inboxCutoff = daysAgo(retention.inbox_days);
  const inboxCount = await sql`
    SELECT COUNT(*)::int as count FROM inbox_items
    WHERE status = 'processed' AND processed_at < ${inboxCutoff}
  `;
  if (inboxCount[0].count > 0) {
    await sql`
      DELETE FROM inbox_items
      WHERE status = 'processed' AND processed_at < ${inboxCutoff}
    `;
  }
  stats.inbox_items = inboxCount[0].count;

  // 2. Completed/archived next_actions
  const actionsCutoff = daysAgo(retention.actions_days);
  const actionsCount = await sql`
    SELECT COUNT(*)::int as count FROM next_actions
    WHERE status IN ('completed', 'archived') AND completed_at < ${actionsCutoff}
  `;
  if (actionsCount[0].count > 0) {
    await sql`
      DELETE FROM next_actions
      WHERE status IN ('completed', 'archived') AND completed_at < ${actionsCutoff}
    `;
  }
  stats.next_actions = actionsCount[0].count;

  // 3. Completed/archived projects (FK-safe: skip if active actions reference them)
  const projectsCutoff = daysAgo(retention.projects_days);
  const projectsCount = await sql`
    SELECT COUNT(*)::int as count FROM projects
    WHERE status IN ('completed', 'archived') AND completed_at < ${projectsCutoff}
      AND id NOT IN (SELECT DISTINCT project_id FROM next_actions WHERE project_id IS NOT NULL AND status = 'active')
  `;
  if (projectsCount[0].count > 0) {
    await sql`
      DELETE FROM projects
      WHERE status IN ('completed', 'archived') AND completed_at < ${projectsCutoff}
        AND id NOT IN (SELECT DISTINCT project_id FROM next_actions WHERE project_id IS NOT NULL AND status = 'active')
    `;
  }
  stats.projects = projectsCount[0].count;

  // 4. Old discipline logs
  const discCutoff = dateDaysAgo(retention.discipline_logs_days);
  const discCount = await sql`
    SELECT COUNT(*)::int as count FROM discipline_logs WHERE date < ${discCutoff}
  `;
  if (discCount[0].count > 0) {
    await sql`DELETE FROM discipline_logs WHERE date < ${discCutoff}`;
  }
  stats.discipline_logs = discCount[0].count;

  // 5. Old daily blocks
  const blocksCutoff = dateDaysAgo(retention.daily_blocks_days);
  const blocksCount = await sql`
    SELECT COUNT(*)::int as count FROM daily_blocks WHERE date < ${blocksCutoff}
  `;
  if (blocksCount[0].count > 0) {
    await sql`DELETE FROM daily_blocks WHERE date < ${blocksCutoff}`;
  }
  stats.daily_blocks = blocksCount[0].count;

  // 6. Old backup log entries
  const backupCutoff = daysAgo(retention.backup_log_days);
  const backupCount = await sql`
    SELECT COUNT(*)::int as count FROM backup_log WHERE timestamp < ${backupCutoff}
  `;
  if (backupCount[0].count > 0) {
    await sql`DELETE FROM backup_log WHERE timestamp < ${backupCutoff}`;
  }
  stats.backup_log = backupCount[0].count;

  // Record cleanup timestamp and stats
  const now = new Date().toISOString();
  await sql`
    INSERT INTO settings (key, value) VALUES ('last_cleanup', ${now})
    ON CONFLICT (key) DO UPDATE SET value = ${now}
  `;
  const statsJson = JSON.stringify(stats);
  await sql`
    INSERT INTO settings (key, value) VALUES ('last_cleanup_stats', ${statsJson})
    ON CONFLICT (key) DO UPDATE SET value = ${statsJson}
  `;

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  if (total > 0) {
    console.log(`[cleanup] Purged ${total} stale rows:`, stats);
  } else {
    console.log('[cleanup] No stale data found');
  }

  return stats;
}

export async function getCleanupStatus(): Promise<{
  lastCleanup: string | null;
  lastStats: Record<string, number> | null;
  retention: Record<string, number>;
}> {
  const retention = await getRetentionSettings();
  let lastCleanup: string | null = null;
  let lastStats: Record<string, number> | null = null;

  try {
    const rows = await sql`SELECT key, value FROM settings WHERE key IN ('last_cleanup', 'last_cleanup_stats')`;
    for (const row of rows) {
      if (row.key === 'last_cleanup') lastCleanup = row.value as string;
      if (row.key === 'last_cleanup_stats') {
        try { lastStats = JSON.parse(row.value as string); } catch { /* ignore */ }
      }
    }
  } catch {
    // Settings table may not exist
  }

  return { lastCleanup, lastStats, retention };
}
