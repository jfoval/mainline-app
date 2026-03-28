'use client';

import { type ReactNode } from 'react';
import { OnlineStatusProvider } from '@/lib/offline/OnlineStatusProvider';
import ThemeProvider from '@/components/ThemeProvider';
import NotificationManager from '@/components/NotificationManager';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnlineStatusProvider>
      <ThemeProvider>
        {children}
        <NotificationManager />
      </ThemeProvider>
    </OnlineStatusProvider>
  );
}
