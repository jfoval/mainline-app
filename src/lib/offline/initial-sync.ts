import { offlineDb } from './db';

function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Initial sync timeout')), timeoutMs)
    ),
  ]);
}

const INITIAL_SYNC_FAILED_KEY = 'gtd_initial_sync_failed';

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
    const [actions, inbox, pipeline, projects, dailyNotes, routine, referenceDocs] = await Promise.all([
      fetchWithTimeout('/api/actions?status=active').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/inbox').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/pipeline').then(r => r.ok ? r.json() : { deals: [], warm_leads: [], contacts: [] }),
      fetchWithTimeout('/api/projects').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/daily-notes').then(r => r.ok ? r.json() : []),
      fetchWithTimeout('/api/routine').then(r => r.ok ? r.json() : { blocks: [] }),
      fetchWithTimeout('/api/reference').then(r => r.ok ? r.json() : []),
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
      offlineDb.pipeline_deals,
      offlineDb.pipeline_contacts,
      offlineDb.pipeline_warm_leads,
      offlineDb.projects,
      offlineDb.daily_notes,
      offlineDb.routine_blocks,
      offlineDb.reference_docs,
      offlineDb.sync_meta,
    ];
    await offlineDb.transaction('rw', tables, async () => {
        if (actions.length) await offlineDb.next_actions.bulkPut(actions);
        if (inbox.length) await offlineDb.inbox_items.bulkPut(inbox);
        if (allListItems.length) await offlineDb.list_items.bulkPut(allListItems);
        if (pipeline.deals?.length) await offlineDb.pipeline_deals.bulkPut(pipeline.deals);
        if (pipeline.contacts?.length) await offlineDb.pipeline_contacts.bulkPut(pipeline.contacts);
        if (pipeline.warm_leads?.length) await offlineDb.pipeline_warm_leads.bulkPut(pipeline.warm_leads);
        if (projects.length) await offlineDb.projects.bulkPut(projects);
        if (dailyNotes.length) await offlineDb.daily_notes.bulkPut(Array.isArray(dailyNotes) ? dailyNotes : [dailyNotes]);
        const blocks = routine.blocks || routine;
        if (Array.isArray(blocks) && blocks.length) await offlineDb.routine_blocks.bulkPut(blocks);
        if (referenceDocs.length) await offlineDb.reference_docs.bulkPut(referenceDocs);

        // Mark all tables as synced
        const now = Date.now();
        const tables = [
          'next_actions', 'inbox_items', 'list_items',
          'pipeline_deals', 'pipeline_contacts', 'pipeline_warm_leads',
          'projects', 'daily_notes', 'routine_blocks', 'reference_docs',
        ];
        await offlineDb.sync_meta.bulkPut(
          tables.map(table => ({ table, lastSyncedAt: now }))
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
