'use client';

import { useState } from 'react';
import { Compass, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface RecoveryStep {
  title: string;
  description: string;
  link: string;
}

interface RecoveryResult {
  severity: 'light' | 'moderate' | 'heavy';
  steps: RecoveryStep[];
  encouragement: string;
}

const FALLBACK_STEPS: RecoveryStep[] = [
  { title: 'Process your inbox', description: 'Clear out captured items so nothing is lost.', link: '/inbox/process' },
  { title: 'Check stalled projects', description: 'Review projects and make sure each has a clear next action.', link: '/projects' },
  { title: 'Do a weekly review', description: 'Walk through your full system to regain clarity and control.', link: '/review' },
];

const SEVERITY_STYLES: Record<string, string> = {
  light: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200',
  moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200',
  heavy: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200',
};

const VALID_LINKS = new Set([
  '/inbox/process', '/inbox', '/projects', '/actions', '/review',
  '/process', '/shutdown', '/horizons',
  '/reference', '/recovery', '/ai', '/settings', '/',
]);

function sanitizeLink(link: string): string {
  if (VALID_LINKS.has(link)) return link;
  // Try common AI mistakes
  if (link.includes('inbox')) return '/inbox/process';
  if (link.includes('review')) return '/review';
  if (link.includes('project')) return '/projects';
  if (link.includes('action')) return '/actions';
  if (link.includes('horizon') || link.includes('goal')) return '/horizons';
  if (link.includes('morning') || link.includes('process')) return '/process';
  if (link.includes('shutdown')) return '/shutdown';
  return '/'; // fallback to dashboard
}

const SEVERITY_LABELS: Record<string, string> = {
  light: 'Light Recovery',
  moderate: 'Moderate Recovery',
  heavy: 'Heavy Recovery',
};

export default function RecoveryPage() {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState(false);

  async function fetchRecovery() {
    setStarted(true);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery' }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      if (data.severity && Array.isArray(data.steps)) {
        setResult(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const steps = error ? FALLBACK_STEPS : result?.steps || [];
  const severity = result?.severity;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Compass size={24} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Get Back on Track</h1>
          <p className="text-sm text-muted">
            {error ? 'Follow these steps to regain control' : 'AI-guided recovery workflow'}
          </p>
        </div>
      </div>

      {!started ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <p className="text-sm text-muted">Analyze your system state and get a personalized recovery plan.</p>
          <button
            onClick={fetchRecovery}
            className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 font-medium transition-colors flex items-center gap-2"
          >
            <Compass size={18} />
            Get Recovery Plan
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted">Analyzing your system...</p>
        </div>
      ) : (
        <>
          {/* Severity badge */}
          {severity && (
            <div className="mb-6">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.moderate}`}>
                {SEVERITY_LABELS[severity] || severity}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">AI recovery unavailable</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  No API key configured or the request failed. Here is a manual recovery plan instead.
                </p>
              </div>
            </div>
          )}

          {/* Steps list */}
          <div className="space-y-3 mb-8">
            {steps.map((step, idx) => (
              <Link
                key={idx}
                href={sanitizeLink(step.link)}
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {step.title}
                    </p>
                    <p className="text-xs text-muted mt-1">{step.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Encouragement */}
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-foreground">
              {result?.encouragement || "You're taking action -- that's what matters. One step at a time."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
