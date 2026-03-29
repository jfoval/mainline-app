import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
        <p className="text-6xl font-bold text-muted/30">404</p>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
        <p className="text-muted text-sm">That page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
