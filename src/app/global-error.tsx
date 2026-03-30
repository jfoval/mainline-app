'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">{error.message || 'An unexpected error occurred.'}</p>
          <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
