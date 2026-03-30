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

  // Set a fresh timestamp so the server records the correct update time
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  data.updated_at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  try {
    // Determine the URL from the table name — bail out if table is unknown
    const url = urlForTable(conflict.table, data);
    if (!url) {
      console.warn(`[conflicts] Cannot resolve: no API mapping for table "${conflict.table}"`);
      return false;
    }
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
    // Check that the table exists in Dexie before attempting to write
    const knownTables = offlineDb.tables.map(t => t.name);
    if (!knownTables.includes(table)) {
      console.warn(`[conflicts] Unknown table "${table}" — removing conflict without updating local store`);
      await offlineDb.conflicts.delete(conflictId);
      return true;
    }
    const dexieTable = offlineDb.table(table);
    await dexieTable.put({ ...serverVersion, id: recordId });
    await offlineDb.conflicts.delete(conflictId);
    return true;
  } catch {
    return false;
  }
}

function urlForTable(table: string, data: Record<string, unknown>): string | null {
  void data;
  switch (table) {
    case 'next_actions': return '/api/actions';
    case 'projects': return '/api/projects';
    case 'daily_notes': return '/api/daily-notes';
    case 'inbox_items': return '/api/inbox';
    case 'disciplines': return '/api/disciplines';
    case 'discipline_logs': return '/api/disciplines/logs';
    case 'context_lists': return '/api/context-lists';
    case 'daily_blocks': return '/api/daily-blocks';
    case 'journal_entries': return '/api/journal';
    case 'horizon_items': return '/api/horizon-items';
    case 'reference_docs': return '/api/reference';
    default: return null; // Unknown table — cannot safely resolve
  }
}
