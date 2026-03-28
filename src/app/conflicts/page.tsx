'use client';

import { useEffect, useState, useCallback } from 'react';
import { getConflicts, resolveKeepClient, resolveKeepServer } from '@/lib/offline/conflicts';
import type { ConflictEntry } from '@/lib/offline/db';

const TABLE_LABELS: Record<string, string> = {
  next_actions: 'Action',
  projects: 'Project',
  daily_notes: 'Daily Note',
  list_items: 'List Item',
};

function getRecordTitle(conflict: ConflictEntry): string {
  const client = conflict.clientVersion;
  const server = conflict.serverVersion;
  return (client.title || client.content || client.name || client.company ||
          server.title || server.content || server.name || server.company ||
          conflict.recordId) as string;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

/** Show fields that differ between client and server */
function getDiffs(client: Record<string, unknown>, server: Record<string, unknown>): string[] {
  const skipFields = ['id', '_base_updated_at', 'entity_type', 'updated_at'];
  const allKeys = new Set([...Object.keys(client), ...Object.keys(server)]);
  const diffs: string[] = [];
  for (const key of allKeys) {
    if (skipFields.includes(key)) continue;
    if (JSON.stringify(client[key]) !== JSON.stringify(server[key])) {
      diffs.push(key);
    }
  }
  return diffs;
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setConflicts(await getConflicts());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(conflictId: number, keep: 'client' | 'server') {
    setResolveError(null);
    setResolving(conflictId);
    const success = keep === 'client'
      ? await resolveKeepClient(conflictId)
      : await resolveKeepServer(conflictId);
    if (success) {
      setExpanded(null);
      await load();
    } else {
      setResolveError('Resolution failed. Check your connection and try again.');
    }
    setResolving(null);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">Sync Conflicts</h1>
      <p className="text-muted mb-6">
        These items were edited on both your phone and Mac before syncing. Pick which version to keep.
      </p>

      {conflicts.length === 0 ? (
        <div className="text-center py-12 text-muted">
          No conflicts. Everything is in sync.
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((conflict) => {
            const isExpanded = expanded === conflict.conflictId;
            const diffs = getDiffs(conflict.clientVersion, conflict.serverVersion);
            const label = TABLE_LABELS[conflict.table] || conflict.table;

            return (
              <div key={conflict.conflictId} className="bg-card rounded-lg border border-border">
                <button
                  onClick={() => setExpanded(isExpanded ? null : conflict.conflictId!)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div>
                    <span className="text-xs font-medium text-primary uppercase">{label}</span>
                    <div className="text-foreground font-medium">{getRecordTitle(conflict)}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {diffs.length} field(s) differ &middot; Detected {formatDate(conflict.detectedAt)}
                    </div>
                  </div>
                  <span className="text-muted text-xl">{isExpanded ? '−' : '+'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-2">This Device</h3>
                        <div className="space-y-1">
                          {diffs.map(field => (
                            <div key={field} className="text-xs">
                              <span className="text-muted">{field}:</span>{' '}
                              <span className="text-foreground">
                                {String(conflict.clientVersion[field] ?? '(empty)')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-green-600 mb-2">Server (Mac)</h3>
                        <div className="space-y-1">
                          {diffs.map(field => (
                            <div key={field} className="text-xs">
                              <span className="text-muted">{field}:</span>{' '}
                              <span className="text-foreground">
                                {String(conflict.serverVersion[field] ?? '(empty)')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleResolve(conflict.conflictId!, 'client')}
                        disabled={resolving === conflict.conflictId}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white text-sm py-2 px-3 rounded-lg disabled:opacity-50"
                      >
                        Keep This Device
                      </button>
                      <button
                        onClick={() => handleResolve(conflict.conflictId!, 'server')}
                        disabled={resolving === conflict.conflictId}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded-lg disabled:opacity-50"
                      >
                        Keep Server
                      </button>
                    </div>
                    {resolveError && (
                      <p className="text-sm text-red-600 mt-2">{resolveError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
