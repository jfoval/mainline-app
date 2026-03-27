'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('pwa-install-dismissed')) return;

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari: detect and show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function dismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  if (dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border border-border rounded-xl shadow-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-primary" />
          <p className="font-medium text-sm">Install Mainline</p>
        </div>
        <button onClick={dismiss} className="p-1 text-muted hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {deferredPrompt ? (
        <>
          <p className="text-xs text-muted mb-3">Add to your home screen for quick access and a native app experience.</p>
          <button
            onClick={handleInstall}
            className="w-full px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm font-medium"
          >
            Install App
          </button>
        </>
      ) : showIOSPrompt ? (
        <>
          <p className="text-xs text-muted mb-2">To install on your iPhone:</p>
          <ol className="text-xs text-muted space-y-1 mb-2">
            <li className="flex items-center gap-1.5">
              <span className="font-medium">1.</span> Tap the <Share size={12} className="inline text-primary" /> Share button in Safari
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-medium">2.</span> Scroll down and tap <span className="font-medium">&quot;Add to Home Screen&quot;</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-medium">3.</span> Tap <span className="font-medium">&quot;Add&quot;</span>
            </li>
          </ol>
        </>
      ) : null}
    </div>
  );
}
