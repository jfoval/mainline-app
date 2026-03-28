'use client';

import { usePathname } from 'next/navigation';
import UpdateChecker from '@/components/UpdateChecker';

const AUTH_PAGES = ['/login', '/setup'];

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <main className="md:ml-64 min-h-screen p-6 pt-16 md:pt-6">
      <UpdateChecker />
      {children}
    </main>
  );
}
