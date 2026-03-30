'use client';

import { useEffect, useRef } from 'react';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const QUIET_HOURS_START = 21; // 9pm
const QUIET_HOURS_END = 7;   // 7am

function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

async function checkAndNotify() {
  if (isQuietHours()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return;
    const data = await res.json();

    // Check inbox overflow
    const inboxThreshold = data.inbox_threshold || 10;
    if (data.inbox_count > inboxThreshold) {
      new Notification('Inbox needs attention', {
        body: `You have ${data.inbox_count} items in your inbox. Time to process!`,
        icon: '/icons/icon-192.png',
        tag: 'inbox-overflow', // Prevents duplicate notifications
        data: { url: '/inbox' },
      });
      return; // One notification per check
    }

    // Check stalled projects
    if (data.stalled_projects?.length > 0) {
      new Notification('Stalled projects', {
        body: `${data.stalled_projects.length} project${data.stalled_projects.length > 1 ? 's' : ''} with no next action.`,
        icon: '/icons/icon-192.png',
        tag: 'stalled-projects',
        data: { url: '/projects' },
      });
      return;
    }

    // Check stale waiting-for items
    if (data.stale_waiting?.length > 0) {
      new Notification('Follow-ups needed', {
        body: `${data.stale_waiting.length} @waiting-for item${data.stale_waiting.length > 1 ? 's' : ''} older than ${data.waiting_days || 7} days.`,
        icon: '/icons/icon-192.png',
        tag: 'stale-waiting',
        data: { url: '/actions?context=waiting_for' },
      });
      return;
    }

    // Check weekly review overdue
    if (data.days_since_weekly_review === null || data.days_since_weekly_review > 7) {
      const body = data.days_since_weekly_review === null
        ? 'You haven\'t completed a weekly review yet.'
        : `Last weekly review was ${data.days_since_weekly_review} days ago.`;
      new Notification('Weekly review overdue', {
        body,
        icon: '/icons/icon-192.png',
        tag: 'review-overdue',
        data: { url: '/review' },
      });
      return;
    }
  } catch {
    // Silently fail — we'll retry next interval
  }
}

export default function NotificationManager() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only run if notifications are supported and enabled
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Check if user has enabled notifications in settings
    const enabled = localStorage.getItem('mainline-notifications') === 'true';
    if (!enabled || Notification.permission !== 'granted') return;

    // Initial check after a short delay (let the app load first)
    const initialTimer = setTimeout(checkAndNotify, 10000);

    // Periodic checks
    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
