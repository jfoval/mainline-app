'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb } from './db';

interface UseOfflineQueryOptions<T> {
  table: string;
  queryLocal: (params?: Record<string, string>) => Promise<T[]>;
  fetchUrl: string | ((params?: Record<string, string>) => string);
  parseResponse: (json: unknown) => T[];
  params?: Record<string, string>;
}

interface UseOfflineQueryResult<T> {
  data: T[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  reloadLocal: () => Promise<void>;
}

export function useOfflineQuery<T>(
  options: UseOfflineQueryOptions<T>
): UseOfflineQueryResult<T> {
  const { table, queryLocal, fetchUrl, parseResponse, params } = options;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const paramsKey = JSON.stringify(params);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadLocal = useCallback(async () => {
    try {
      const localData = await queryLocal(params);
      if (mountedRef.current) {
        setData(localData);
        setIsLoading(false);
      }
    } catch {
      if (mountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const syncFromServer = useCallback(async () => {
    if (mountedRef.current) setIsSyncing(true);
    try {
      const url = typeof fetchUrl === 'function' ? fetchUrl(params) : fetchUrl;
      const res = await fetch(url);

      // If offline response from service worker, just keep local data
      if (res.status === 503 && res.headers.get('X-Offline') === 'true') {
        if (mountedRef.current) setIsSyncing(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const serverData = parseResponse(json);

      if (serverData.length > 0 || json !== undefined) {
        const dexieTable = offlineDb.table(table);
        await offlineDb.transaction('rw', dexieTable, async () => {
          // For full-table syncs, replace all data
          // For filtered queries, just upsert
          if (!params || Object.keys(params).length === 0) {
            await dexieTable.clear();
          }
          if (serverData.length > 0) {
            await dexieTable.bulkPut(serverData);
          }
        });

        await offlineDb.sync_meta.put({
          table,
          lastSyncedAt: Date.now(),
        });

        // Re-read from local for consistent view
        await loadLocal();
      }

      if (mountedRef.current) setError(null);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error('Sync failed'));
      }
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const refresh = useCallback(async () => {
    await syncFromServer();
  }, [syncFromServer]);

  const reloadLocal = useCallback(async () => {
    await loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    loadLocal().then(() => syncFromServer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  return { data, isLoading, isSyncing, error, refresh, reloadLocal };
}
