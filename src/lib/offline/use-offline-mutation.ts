'use client';

import { useCallback } from 'react';
import { processQueue } from './sync-queue';

interface MutationActions<T> {
  create: (data: Record<string, unknown>) => Promise<T>;
  update: (data: Record<string, unknown> & { id: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useOfflineMutation<T>(
  actions: MutationActions<T>,
  onMutated: () => Promise<void>
) {
  const create = useCallback(async (data: Record<string, unknown>) => {
    const result = await actions.create(data);
    await onMutated();
    // Try to sync immediately (fire and forget)
    processQueue().catch((err) => console.warn('[sync] Queue processing failed:', err));
    return result;
  }, [actions, onMutated]);

  const update = useCallback(async (data: Record<string, unknown> & { id: string }) => {
    await actions.update(data);
    await onMutated();
    processQueue().catch((err) => console.warn('[sync] Queue processing failed:', err));
  }, [actions, onMutated]);

  const remove = useCallback(async (id: string) => {
    await actions.remove(id);
    await onMutated();
    processQueue().catch((err) => console.warn('[sync] Queue processing failed:', err));
  }, [actions, onMutated]);

  return { create, update, remove };
}
