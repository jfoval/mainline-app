'use client';

import { createContext, useCallback, useContext, useRef, useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface ToastItem {
  id: string;
  message: string;
  onUndo?: () => void | Promise<void>;
  onExpire?: () => void | Promise<void>;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, opts?: { onUndo?: () => void | Promise<void>; onExpire?: () => void | Promise<void> }) => string;
  dismissToast: (id: string) => void;
  undoToast: (id: string) => void;
  pendingDeletes: Set<string>;
  addPendingDelete: (id: string) => void;
  removePendingDelete: (id: string) => void;
  flushAll: () => Promise<void>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const toastsRef = useRef<ToastItem[]>([]);
  toastsRef.current = toasts;

  const pathname = usePathname();

  const addPendingDelete = useCallback((id: string) => {
    setPendingDeletes(prev => new Set(prev).add(id));
  }, []);

  const removePendingDelete = useCallback((id: string) => {
    setPendingDeletes(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const addToast = useCallback((message: string, opts?: { onUndo?: () => void | Promise<void>; onExpire?: () => void | Promise<void> }) => {
    const id = `toast-${++toastCounter}`;
    const toast: ToastItem = { id, message, onUndo: opts?.onUndo, onExpire: opts?.onExpire };
    setToasts(prev => {
      const next = [...prev, toast];
      // Max 5 visible — expire oldest if over limit
      if (next.length > 5) {
        const oldest = next[0];
        oldest.onExpire?.();
        return next.slice(1);
      }
      return next;
    });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast) toast.onExpire?.();
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast) toast.onUndo?.();
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const flushAll = useCallback(async () => {
    const current = toastsRef.current;
    if (current.length === 0) return;
    for (const toast of current) {
      await toast.onExpire?.();
    }
    setToasts([]);
    setPendingDeletes(new Set());
  }, []);

  // Flush all pending deletes on navigation
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      flushAll();
    }
  }, [pathname, flushAll]);

  return (
    <ToastContext value={{ toasts, addToast, dismissToast, undoToast, pendingDeletes, addPendingDelete, removePendingDelete, flushAll }}>
      {children}
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
