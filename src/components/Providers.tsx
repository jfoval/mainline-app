'use client';

import { type ReactNode } from 'react';
import { OnlineStatusProvider } from '@/lib/offline/OnlineStatusProvider';
import ThemeProvider from '@/components/ThemeProvider';
import NotificationManager from '@/components/NotificationManager';
import { ToastProvider } from '@/lib/toast';
import ToastContainer from '@/components/Toast';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnlineStatusProvider>
      <ThemeProvider>
        <ToastProvider>
          {children}
          <NotificationManager />
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </OnlineStatusProvider>
  );
}
