import { offlineDb, type ConflictEntry } from './db';

export async function getConflicts(): Promise<ConflictEntry[]> {
  return offlineDb.conflicts.orderBy('detectedAt').reverse().toArray();
}

export async function getConflictCount(): Promise<number> {
  return offlineDb.conflicts.count();
}

/** Resolve by keeping the client's version — force-push to server */
export async function resolveKeepClient(conflictId: number): Promise<boolean> {
  const conflict = await offlineDb.conflicts.get(conflictId);
  if (!conflict) return false;

  const { clientVersion } = conflict;
  // Remove _base_updated_at to force the update through without conflict check
  const { _base_updated_at, ...data } = clientVersion as Record<string, unknown>;
  void _base_updated_at; // suppress unused

  try {
    // Determine the URL from the table name
    const url = urlForTable(conflict.table, data);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      await offlineDb.conflicts.delete(conflictId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Resolve by keeping the server's version — update local IndexedDB from server */
export async function resolveKeepServer(conflictId: number): Promise<boolean> {
  const conflict = await offlineDb.conflicts.get(conflictId);
  if (!conflict) return false;

  const { table, recordId, serverVersion } = conflict;

  try {
    // Update the local IndexedDB with server version
    const dexieTable = offlineDb.table(table);
    await dexieTable.put({ ...serverVersion, id: recordId });
    await offlineDb.conflicts.delete(conflictId);
    return true;
  } catch {
    return false;
  }
}

function urlForTable(table: string, data: Record<string, unknown>): string {
  switch (table) {
    case 'next_actions': return '/api/actions';
    case 'projects': return '/api/projects';
    case 'pipeline_deals': return '/api/pipeline';
    case 'pipeline_contacts': return '/api/pipeline';
    case 'pipeline_warm_leads': return '/api/pipeline';
    case 'daily_notes': return '/api/daily-notes';
    case 'list_items': return '/api/lists';
    case 'inbox_items': return '/api/inbox';
    case 'routine_blocks': return '/api/routine';
    default: return `/api/${table.replace(/_/g, '-')}`;
  }
}
