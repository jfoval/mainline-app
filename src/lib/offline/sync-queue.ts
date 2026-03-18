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
  if (url.includes('/api/pipeline')) {
    if (url.includes('type=deal') || url.includes('entity_type')) return 'pipeline_deals';
    if (url.includes('type=warm_lead')) return 'pipeline_warm_leads';
    if (url.includes('type=contact')) return 'pipeline_contacts';
    return 'pipeline_deals'; // default for pipeline PATCH
  }
  if (url.includes('/api/daily-notes')) return 'daily_notes';
  if (url.includes('/api/lists')) return 'list_items';
  if (url.includes('/api/inbox')) return 'inbox_items';
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
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.body ? { 'Content-Type': 'application/json' } : undefined,
        body: entry.body,
      });

      if (res.ok || res.status === 404) {
        // Success or item already gone server-side — safe to dequeue
        await offlineDb.sync_queue.delete(entry.queueId!);
        processed++;
      } else if (res.status === 409) {
        // Conflict detected — store for user resolution
        const conflictData = await res.json();
        const bodyParsed = entry.body ? JSON.parse(entry.body) : {};
        const table = tableFromUrl(entry.url);
        // Also check the body for entity_type to refine table name
        let resolvedTable = table;
        if (bodyParsed.entity_type === 'deal') resolvedTable = 'pipeline_deals';
        else if (bodyParsed.entity_type === 'warm_lead') resolvedTable = 'pipeline_warm_leads';
        else if (bodyParsed.entity_type === 'contact') resolvedTable = 'pipeline_contacts';

        await offlineDb.conflicts.add({
          table: resolvedTable,
          recordId: bodyParsed.id || '',
          clientVersion: bodyParsed,
          serverVersion: conflictData.serverRecord || {},
          detectedAt: Date.now(),
        });
        // Dequeue — conflict stored separately for resolution
        await offlineDb.sync_queue.delete(entry.queueId!);
        conflicts++;
        // Continue processing queue (don't break on conflicts)
      } else if (entry.retries >= 3) {
        // Give up after 3 retries
        await offlineDb.sync_queue.delete(entry.queueId!);
        failed++;
      } else {
        await offlineDb.sync_queue.update(entry.queueId!, {
          retries: entry.retries + 1,
        });
        failed++;
        break; // Stop to maintain FIFO ordering
      }
    } catch {
      // Network error — increment retries, stop to retry on reconnect
      if (entry.retries >= 3) {
        await offlineDb.sync_queue.delete(entry.queueId!).catch(() => {});
      } else {
        await offlineDb.sync_queue.update(entry.queueId!, {
          retries: entry.retries + 1,
        }).catch(() => {});
      }
      failed++;
      break;
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
