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

export async function performInitialSync(): Promise<void> {
  // Check if we've already synced at least once
  const meta = await offlineDb.sync_meta.toArray();
  if (meta.length > 0) {
    clearInitialSyncFailure();
    return;
  }

  try {
    const [actions, inbox, projects, dailyNotes, routine, referenceDocs, disciplines, disciplineLogs, contextLists] = await Promise.all([
      fetchWithTimeout('/api/actions?status=active').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/inbox').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/projects').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/daily-notes').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/routine').then(r => r.ok ? r.json() : { blocks: [] }),
      fetchWithTimeout('/api/reference').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/disciplines').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/disciplines/logs?days=30').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/context-lists').then(r => r.ok ? r.json() : []),
    ]);

    // Fetch all list types
    const listTypes = ['wish_list', 'reading', 'movies', 'shows', 'albums', 'travel'];
    const listResults = await Promise.all(
      listTypes.map(type =>
        fetchWithTimeout(`/api/lists?type=${type}`).then(r => r.ok ? r.json() : [])
      )
    );
    const allListItems = listResults.flat();

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

        // Mark all tables as synced
        const now = Date.now();
        const syncTables = [
          'next_actions', 'inbox_items', 'list_items',
          'projects', 'daily_notes', 'routine_blocks', 'reference_docs',
          'disciplines', 'discipline_logs', 'context_lists',
        ];
        await offlineDb.sync_meta.bulkPut(
          syncTables.map(table => ({ table, lastSyncedAt: now }))
        );
      }
    );
    clearInitialSyncFailure();
  } catch {
    // Initial sync failed (offline) — mark for retry on next online event
    try {
      localStorage.setItem(INITIAL_SYNC_FAILED_KEY, 'true');
    } catch {
      // localStorage may be unavailable
    }
  }
}
