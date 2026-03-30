import { offlineDb } from './db';

function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Initial sync timeout')), timeoutMs)
    ),
  ]);
}

const INITIAL_SYNC_FAILED_KEY = 'mainline_initial_sync_failed';
const INCREMENTAL_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let incrementalSyncTimer: ReturnType<typeof setInterval> | null = null;
let reconnectListenerAttached = false;
let syncInProgress = false;

export function hasInitialSyncFailed(): boolean {
  try {
    return localStorage.getItem(INITIAL_SYNC_FAILED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearInitialSyncFailure(): void {
  try {
    localStorage.removeItem(INITIAL_SYNC_FAILED_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

/** Get IDs of records with pending mutations in the sync queue */
async function getPendingIds(): Promise<Set<string>> {
  const pendingIds = new Set<string>();
  try {
    const entries = await offlineDb.sync_queue.toArray();
    for (const entry of entries) {
      if (entry.body) {
        try {
          const parsed = JSON.parse(entry.body);
          if (parsed.id) pendingIds.add(parsed.id);
        } catch { /* not parseable */ }
      }
      // Also extract IDs from DELETE URLs (e.g., /api/actions?id=xxx)
      const urlMatch = entry.url.match(/[?&]id=([^&]+)/);
      if (urlMatch) pendingIds.add(urlMatch[1]);
    }
  } catch { /* sync_queue may not exist yet */ }
  return pendingIds;
}

/** Filter out records with pending local mutations before bulkPut */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterPending(items: any[], pendingIds: Set<string>): any[] {
  if (pendingIds.size === 0) return items;
  return items.filter(item => !item.id || !pendingIds.has(item.id));
}

/** Fetch all data from the server and populate IndexedDB, skipping records with pending local mutations */
async function fetchAllData(): Promise<void> {
  const [actions, inbox, projects, dailyNotes, referenceDocs, disciplines, disciplineLogs, contextLists, dailyBlocksRes, journalEntries, horizonItems] = await Promise.all([
    fetchWithTimeout('/api/actions?status=active').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/inbox').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/projects').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/daily-notes').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/reference').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/disciplines').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/disciplines/logs?days=30').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/context-lists').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/daily-blocks').then(r => r.ok ? r.json() : { blocks: [] }),
    fetchWithTimeout('/api/journal').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/horizon-items').then(r => r.ok ? r.json() : []),
  ]);

  // Extract daily blocks from response
  const dailyBlocks = dailyBlocksRes.blocks || (Array.isArray(dailyBlocksRes) ? dailyBlocksRes : []);

  // Get pending mutation IDs so we don't overwrite local edits with stale server data
  const pendingIds = await getPendingIds();

  const tables = [
    offlineDb.next_actions,
    offlineDb.inbox_items,
    offlineDb.projects,
    offlineDb.daily_notes,
    offlineDb.reference_docs,
    offlineDb.disciplines,
    offlineDb.discipline_logs,
    offlineDb.context_lists,
    offlineDb.daily_blocks,
    offlineDb.journal_entries,
    offlineDb.horizon_items,
    offlineDb.sync_meta,
  ];
  await offlineDb.transaction('rw', tables, async () => {
    const safeActions = filterPending(actions, pendingIds);
    const safeInbox = filterPending(inbox, pendingIds);
    const safeProjects = filterPending(projects, pendingIds);
    const safeDailyNotes = filterPending(Array.isArray(dailyNotes) ? dailyNotes : [dailyNotes], pendingIds);
    const safeReferenceDocs = filterPending(referenceDocs, pendingIds);
    const safeDisciplines = filterPending(Array.isArray(disciplines) ? disciplines : [], pendingIds);
    const safeDisciplineLogs = filterPending(Array.isArray(disciplineLogs) ? disciplineLogs : [], pendingIds);
    const safeContextLists = filterPending(Array.isArray(contextLists) ? contextLists : [], pendingIds);
    const safeDailyBlocks = filterPending(Array.isArray(dailyBlocks) ? dailyBlocks : [], pendingIds);
    const safeJournalEntries = filterPending(Array.isArray(journalEntries) ? journalEntries : [], pendingIds);
    const safeHorizonItems = filterPending(Array.isArray(horizonItems) ? horizonItems : [], pendingIds);

    if (safeActions.length) await offlineDb.next_actions.bulkPut(safeActions);
    if (safeInbox.length) await offlineDb.inbox_items.bulkPut(safeInbox);
    if (safeProjects.length) await offlineDb.projects.bulkPut(safeProjects);
    if (safeDailyNotes.length) await offlineDb.daily_notes.bulkPut(safeDailyNotes);
    if (safeReferenceDocs.length) await offlineDb.reference_docs.bulkPut(safeReferenceDocs);
    if (safeDisciplines.length) await offlineDb.disciplines.bulkPut(safeDisciplines);
    if (safeDisciplineLogs.length) await offlineDb.discipline_logs.bulkPut(safeDisciplineLogs);
    if (safeContextLists.length) await offlineDb.context_lists.bulkPut(safeContextLists);
    if (safeDailyBlocks.length) await offlineDb.daily_blocks.bulkPut(safeDailyBlocks);
    if (safeJournalEntries.length) await offlineDb.journal_entries.bulkPut(safeJournalEntries);
    if (safeHorizonItems.length) await offlineDb.horizon_items.bulkPut(safeHorizonItems);

    // Mark all tables as synced
    const now = Date.now();
    const syncTables = [
      'next_actions', 'inbox_items',
      'projects', 'daily_notes', 'reference_docs',
      'disciplines', 'discipline_logs', 'context_lists', 'daily_blocks', 'journal_entries', 'horizon_items',
    ];
    await offlineDb.sync_meta.bulkPut(
      syncTables.map(table => ({ table, lastSyncedAt: now }))
    );
  });
}

export async function performInitialSync(): Promise<void> {
  // Check if we've already synced at least once
  const meta = await offlineDb.sync_meta.toArray();
  if (meta.length > 0) {
    clearInitialSyncFailure();
    // Start incremental sync schedule
    startIncrementalSync();
    return;
  }

  try {
    await fetchAllData();
    clearInitialSyncFailure();
    startIncrementalSync();
  } catch {
    // Initial sync failed (offline) — mark for retry on next online event
    try {
      localStorage.setItem(INITIAL_SYNC_FAILED_KEY, 'true');
    } catch {
      // localStorage may be unavailable
    }
  }
}

/** Perform an incremental sync — re-fetch all data from server to refresh local cache */
export async function performIncrementalSync(): Promise<void> {
  if (!navigator.onLine || syncInProgress) return;

  syncInProgress = true;
  try {
    await fetchAllData();
  } catch {
    // Silently fail — we'll retry on next interval or reconnect
  } finally {
    syncInProgress = false;
  }
}

/** Start periodic incremental sync and listen for reconnect events */
function startIncrementalSync(): void {
  // Set up periodic refresh
  if (!incrementalSyncTimer) {
    incrementalSyncTimer = setInterval(() => {
      performIncrementalSync();
    }, INCREMENTAL_SYNC_INTERVAL_MS);
  }

  // Listen for online events to sync on reconnect
  if (!reconnectListenerAttached && typeof window !== 'undefined') {
    reconnectListenerAttached = true;
    window.addEventListener('online', () => {
      // On reconnect: retry initial sync if it failed, or do incremental
      if (hasInitialSyncFailed()) {
        performInitialSync();
      } else {
        performIncrementalSync();
      }
    });

    // Sync when user returns to the tab (catches stale data from backgrounding)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !hasInitialSyncFailed()) {
        performIncrementalSync();
      }
    });
  }
}
