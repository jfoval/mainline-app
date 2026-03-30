'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Clear old caches on startup
      // SW cache version — keep in sync with CACHE_NAME in public/sw.js
      const CURRENT_CACHE = 'mainline-v12';
      caches.keys().then((names) => {
        names.forEach((name) => { if (name !== CURRENT_CACHE) caches.delete(name); });
      });

      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Register for background sync when mutations are queued
        if ('sync' in registration) {
          (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
            .sync.register('sync-mutations').catch(() => {});
        }
      }).catch(() => {
        // Service worker registration failed — not critical
      });
    }
  }, []);

  return null;
}
