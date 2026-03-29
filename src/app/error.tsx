'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
        <p className="text-5xl font-bold text-muted/30">!</p>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-muted text-sm">An unexpected error occurred.</p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
