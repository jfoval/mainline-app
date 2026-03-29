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

/** Fetch all data from the server and populate IndexedDB */
async function fetchAllData(): Promise<void> {
  const [actions, inbox, projects, dailyNotes, routine, referenceDocs, disciplines, disciplineLogs, contextLists, dailyBlocksRes, journalEntries] = await Promise.all([
    fetchWithTimeout('/api/actions?status=active').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/inbox').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/projects').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/daily-notes').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/routine').then(r => r.ok ? r.json() : { blocks: [] }),
    fetchWithTimeout('/api/reference').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/disciplines').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/disciplines/logs?days=30').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/context-lists').then(r => r.ok ? r.json() : []),
    fetchWithTimeout('/api/daily-blocks').then(r => r.ok ? r.json() : { blocks: [] }),
    fetchWithTimeout('/api/journal').then(r => r.ok ? r.json() : []),
  ]);

  // Fetch all list types
  const listTypes = ['wish_list', 'reading', 'movies', 'shows', 'albums', 'travel'];
  const listResults = await Promise.all(
    listTypes.map(type =>
      fetchWithTimeout(`/api/lists?type=${type}`).then(r => r.ok ? r.json() : [])
    )
  );
  const allListItems = listResults.flat();

  // Extract daily blocks from response
  const dailyBlocks = dailyBlocksRes.blocks || (Array.isArray(dailyBlocksRes) ? dailyBlocksRes : []);

  const tables = [
    offlineDb.next_actions,
    offlineDb.inbox_items,
    offlineDb.list_items,
    offlineDb.projects,
    offlineDb.daily_notes,
    offlineDb.routine_blocks,
    offlineDb.reference_docs,
    offlineDb.disciplines,
    offlineDb.discipline_logs,
    offlineDb.context_lists,
    offlineDb.daily_blocks,
    offlineDb.journal_entries,
    offlineDb.sync_meta,
  ];
  await offlineDb.transaction('rw', tables, async () => {
    if (actions.length) await offlineDb.next_actions.bulkPut(actions);
    if (inbox.length) await offlineDb.inbox_items.bulkPut(inbox);
    if (allListItems.length) await offlineDb.list_items.bulkPut(allListItems);
    if (projects.length) await offlineDb.projects.bulkPut(projects);
    if (dailyNotes.length) await offlineDb.daily_notes.bulkPut(Array.isArray(dailyNotes) ? dailyNotes : [dailyNotes]);
    const blocks = routine.blocks || routine;
    if (Array.isArray(blocks) && blocks.length) await offlineDb.routine_blocks.bulkPut(blocks);
    if (referenceDocs.length) await offlineDb.reference_docs.bulkPut(referenceDocs);
    if (Array.isArray(disciplines) && disciplines.length) await offlineDb.disciplines.bulkPut(disciplines);
    if (Array.isArray(disciplineLogs) && disciplineLogs.length) await offlineDb.discipline_logs.bulkPut(disciplineLogs);
    if (Array.isArray(contextLists) && contextLists.length) await offlineDb.context_lists.bulkPut(contextLists);
    if (Array.isArray(dailyBlocks) && dailyBlocks.length) await offlineDb.daily_blocks.bulkPut(dailyBlocks);
    if (Array.isArray(journalEntries) && journalEntries.length) await offlineDb.journal_entries.bulkPut(journalEntries);

    // Mark all tables as synced
    const now = Date.now();
    const syncTables = [
      'next_actions', 'inbox_items', 'list_items',
      'projects', 'daily_notes', 'routine_blocks', 'reference_docs',
      'disciplines', 'discipline_logs', 'context_lists', 'daily_blocks', 'journal_entries',
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
