import { offlineDb } from './db';

export async function enqueue(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: Record<string, unknown> | null
): Promise<void> {
  await offlineDb.sync_queue.add({
    method,
    url,
    body: body ? JSON.stringify(body) : null,
    timestamp: Date.now(),
    retries: 0,
  });
}

/** Extract table name from API URL for conflict tracking */
function tableFromUrl(url: string): string {
  if (url.includes('/api/actions')) return 'next_actions';
  if (url.includes('/api/projects')) return 'projects';
  if (url.includes('/api/daily-notes')) return 'daily_notes';
  if (url.includes('/api/lists')) return 'list_items';
  if (url.includes('/api/inbox')) return 'inbox_items';
  if (url.includes('/api/disciplines/logs')) return 'discipline_logs';
  if (url.includes('/api/disciplines')) return 'disciplines';
  if (url.includes('/api/context-lists')) return 'context_lists';
  if (url.includes('/api/daily-blocks')) return 'daily_blocks';
  if (url.includes('/api/routine')) return 'routine_blocks';
  if (url.includes('/api/journal')) return 'journal_entries';
  return 'unknown';
}

export async function processQueue(): Promise<{ processed: number; failed: number; conflicts: number }> {
  const entries = await offlineDb.sync_queue
    .orderBy('queueId')
    .toArray();

  let processed = 0;
  let failed = 0;
  let conflicts = 0;

  for (const entry of entries) {
    // Exponential backoff: skip entries that aren't ready for retry yet
    if (entry.retries > 0 && entry.lastRetryAt) {
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, entry.retries)); // 2s, 4s, 8s, 16s, 30s
      if (Date.now() - entry.lastRetryAt < backoffMs) {
        continue; // Not ready for retry yet — skip, don't break
      }
    }

    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.body ? { 'Content-Type': 'application/json' } : undefined,
        body: entry.body,
      });

      if (res.ok) {
        await offlineDb.sync_queue.delete(entry.queueId!);
        processed++;
      } else if (res.status === 404) {
        // For DELETE: item already gone — safe to dequeue
        // For PATCH/POST: the endpoint itself may be wrong — log and dequeue to avoid infinite retries
        if (entry.method === 'DELETE') {
          await offlineDb.sync_queue.delete(entry.queueId!);
          processed++;
        } else {
          console.warn(`[sync] 404 on ${entry.method} ${entry.url} — dequeuing (endpoint may have changed)`);
          await offlineDb.sync_queue.delete(entry.queueId!);
          failed++;
        }
      } else if (res.status === 409) {
        // Conflict detected — store for user resolution
        const conflictData = await res.json();
        const bodyParsed = entry.body ? JSON.parse(entry.body) : {};
        const table = tableFromUrl(entry.url);

        await offlineDb.conflicts.add({
          table,
          recordId: bodyParsed.id || '',
          clientVersion: bodyParsed,
          serverVersion: conflictData.serverRecord || {},
          detectedAt: Date.now(),
        });
        await offlineDb.sync_queue.delete(entry.queueId!);
        conflicts++;
      } else if (entry.retries >= 5) {
        // Give up after 5 retries (was 3)
        console.warn(`[sync] Giving up on ${entry.method} ${entry.url} after ${entry.retries} retries (status ${res.status})`);
        await offlineDb.sync_queue.delete(entry.queueId!);
        failed++;
      } else {
        await offlineDb.sync_queue.update(entry.queueId!, {
          retries: entry.retries + 1,
          lastRetryAt: Date.now(),
        });
        failed++;
        // Don't break — continue processing other entries (non-FIFO for retries)
      }
    } catch {
      // Network error — increment retries with backoff timestamp
      if (entry.retries >= 5) {
        await offlineDb.sync_queue.delete(entry.queueId!).catch(() => {});
      } else {
        await offlineDb.sync_queue.update(entry.queueId!, {
          retries: entry.retries + 1,
          lastRetryAt: Date.now(),
        }).catch(() => {});
      }
      failed++;
      break; // Network down — stop queue processing
    }
  }

  return { processed, failed, conflicts };
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.sync_queue.count();
}

export async function getConflictCount(): Promise<number> {
  return offlineDb.conflicts.count();
}
