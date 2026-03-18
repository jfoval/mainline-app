'use client';

import { useOfflineQuery } from './use-offline-query';
import { useOfflineMutation } from './use-offline-mutation';
import type { StoreConfig } from './stores';

export function useOfflineStore<T>(
  store: StoreConfig<T>,
  params?: Record<string, string>
) {
  const query = useOfflineQuery<T>({
    table: store.table,
    queryLocal: store.queryLocal,
    fetchUrl: store.fetchUrl,
    parseResponse: store.parseResponse,
    params,
  });

  const mutation = useOfflineMutation<T>(
    store.mutate,
    query.reloadLocal
  );

  return {
    ...query,
    ...mutation,
  };
}
