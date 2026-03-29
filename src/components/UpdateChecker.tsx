'use client';

import { useEffect, useState } from 'react';
import { ArrowUpCircle, X, ExternalLink } from 'lucide-react';

interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseNotes: string | null;
  releaseUrl: string | null;
}

const CACHE_KEY = 'mainline-update-check';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getDismissKey(version: string) {
  return `mainline-update-dismissed-${version}`;
}

export default function UpdateChecker() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function check() {
      // Try localStorage cache first
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Date.now() - cached.fetchedAt < CACHE_TTL) {
            if (cached.data.updateAvailable && !localStorage.getItem(getDismissKey(cached.data.latest))) {
              setInfo(cached.data);
              setShowBanner(true);
            }
            return;
          }
        }
      } catch {
        // Corrupted cache — ignore
      }

      // Fetch fresh data
      try {
        const res = await fetch('/api/version');
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));

        if (data.updateAvailable && data.latest && !localStorage.getItem(getDismissKey(data.latest))) {
          setInfo(data);
          setShowBanner(true);
        }
      } catch {
        // Offline or error — no banner
      }
    }

    check();
  }, []);

  function dismiss() {
    if (info?.latest) {
      localStorage.setItem(getDismissKey(info.latest), 'true');
    }
    setShowBanner(false);
  }

  if (!showBanner || !info) return null;

  return (
    <>
      {/* Update banner */}
      <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ArrowUpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              Version {info.latest} is available
              <span className="text-indigo-600 dark:text-indigo-400 font-normal ml-1">(you have {info.current})</span>
            </p>
            {info.releaseNotes && (
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5 truncate">
                {info.releaseNotes.split('\n')[0].replace(/^#+\s*/, '').slice(0, 100)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Update Now
          </button>
          <button
            onClick={dismiss}
            className="p-1.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            title="Dismiss"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Update instructions modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">How to Update</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted">
              Updating takes about 2 minutes. Your data stays safe — only the app code changes.
            </p>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Open your project on GitHub</p>
                  <p className="text-xs text-muted mt-1">
                    Click below to go to the Mainline repo. At the top, you&apos;ll see a link to your personal copy (fork) — click it.
                  </p>
                  <a
                    href="https://github.com/jfoval/mainline-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    Go to GitHub <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">Sync your fork</p>
                  <p className="text-xs text-muted mt-1">
                    On your fork&apos;s page, you&apos;ll see a message saying your branch is behind.
                    Click the <strong>&quot;Sync fork&quot;</strong> button, then click <strong>&quot;Update branch&quot;</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">Wait about 1 minute, then refresh</p>
                  <p className="text-xs text-muted mt-1">
                    Vercel automatically rebuilds your app when GitHub updates. After a minute or so,
                    refresh this page and you&apos;ll be on the latest version.
                  </p>
                </div>
              </div>
            </div>

            {info.releaseUrl && (
              <a
                href={info.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
              >
                View full release notes <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 text-sm font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/15 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
