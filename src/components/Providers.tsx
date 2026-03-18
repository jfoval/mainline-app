'use client';

import { type ReactNode } from 'react';
import { OnlineStatusProvider } from '@/lib/offline/OnlineStatusProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnlineStatusProvider>
      {children}
    </OnlineStatusProvider>
  );
}
