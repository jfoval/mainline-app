'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { getPendingCount, processQueue } from './sync-queue';
import { performInitialSync, hasInitialSyncFailed } from './initial-sync';

interface OnlineStatus {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
}

const OnlineStatusContext = createContext<OnlineStatus>({
  isOnline: true,
  pendingCount: 0,
  syncNow: async () => {},
});

export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}

export function OnlineStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
  }, []);
  const [pendingCount, setPendingCount] = useState(0);
  const initialSyncDone = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not ready yet
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    await processQueue();
    await refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    // Initial data hydration on first visit
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      performInitialSync().catch(() => {});
    }

    const goOnline = () => {
      setIsOnline(true);
      // Retry initial sync if it failed previously (e.g. first visit was offline)
      if (hasInitialSyncFailed()) {
        performInitialSync().catch(() => {});
      }
      syncNow();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for service worker sync messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_NOW') {
        syncNow();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Poll pending count every 5 seconds
    const interval = setInterval(refreshPendingCount, 15000);
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount]);

  return (
    <OnlineStatusContext.Provider value={{ isOnline, pendingCount, syncNow }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}
