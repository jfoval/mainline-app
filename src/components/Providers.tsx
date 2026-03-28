'use client';

import { type ReactNode } from 'react';
import { OnlineStatusProvider } from '@/lib/offline/OnlineStatusProvider';
import ThemeProvider from '@/components/ThemeProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnlineStatusProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </OnlineStatusProvider>
  );
}
