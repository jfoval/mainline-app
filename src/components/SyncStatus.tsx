'use client';

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/lib/offline/OnlineStatusProvider';
import { getConflictCount } from '@/lib/offline/sync-queue';

export default function SyncStatus() {
  const { isOnline, pendingCount, syncNow } = useOnlineStatus();
  const [conflictCount, setConflictCount] = useState(0);

  useEffect(() => {
    getConflictCount().then(setConflictCount);
    // Re-check conflicts periodically
    const interval = setInterval(() => {
      getConflictCount().then(setConflictCount);
    }, 10000);
    return () => clearInterval(interval);
  }, [pendingCount]); // Re-check when pending count changes (sync just happened)

  const showConflictBadge = conflictCount > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      {showConflictBadge && (
        <a
          href="/conflicts"
          className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg hover:bg-orange-200 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
        </a>
      )}

      {!isOnline ? (
        <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Offline
          {pendingCount > 0 && <span className="text-red-500">({pendingCount} pending)</span>}
        </div>
      ) : pendingCount > 0 ? (
        <button
          onClick={() => syncNow()}
          className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg hover:bg-orange-200 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-orange-500 motion-safe:animate-pulse" />
          Syncing {pendingCount}...
        </button>
      ) : null}
    </div>
  );
}
