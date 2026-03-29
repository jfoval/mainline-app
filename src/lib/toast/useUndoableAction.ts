'use client';

import { useCallback } from 'react';
import { useToast } from './ToastContext';

export function useUndoableAction() {
  const { addToast, addPendingDelete, removePendingDelete } = useToast();

  const undoableDelete = useCallback(
    (id: string, removeFn: (id: string) => Promise<void>, message: string) => {
      addPendingDelete(id);
      addToast(message, {
        onUndo: () => {
          removePendingDelete(id);
        },
        onExpire: async () => {
          removePendingDelete(id);
          await removeFn(id);
        },
      });
    },
    [addToast, addPendingDelete, removePendingDelete],
  );

  const undoableStatusChange = useCallback(
    async (
      id: string,
      newStatus: string,
      prevStatus: string,
      updateFn: (patch: { id: string; status: string }) => Promise<void>,
      message: string,
    ) => {
      await updateFn({ id, status: newStatus });
      addToast(message, {
        onUndo: async () => {
          await updateFn({ id, status: prevStatus });
        },
      });
    },
    [addToast],
  );

  const undoableFetchDelete = useCallback(
    (
      id: string,
      deleteUrl: string,
      message: string,
      opts?: { onUndo?: () => void; onSettled?: () => void },
    ) => {
      addPendingDelete(id);
      addToast(message, {
        onUndo: () => {
          removePendingDelete(id);
          opts?.onUndo?.();
          opts?.onSettled?.();
        },
        onExpire: async () => {
          removePendingDelete(id);
          await fetch(deleteUrl, { method: 'DELETE' });
          opts?.onSettled?.();
        },
      });
    },
    [addToast, addPendingDelete, removePendingDelete],
  );

  return { undoableDelete, undoableStatusChange, undoableFetchDelete };
}
