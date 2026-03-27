'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check, Loader2, Lock, User, Key } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Check if already configured
  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(data => {
        if (data.configured) {
          router.replace('/login');
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleComplete() {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          display_name: displayName.trim() || null,
          anthropic_api_key: apiKey.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Setup failed');
        setSaving(false);
        return;
      }

      // Setup complete — auto-logged in, go to dashboard
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not connect to server');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Welcome to Mainline</h1>
          <p className="text-muted mt-2">Let&apos;s get your personal GTD system set up.</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8 justify-center">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i <= step ? 'bg-primary w-12' : 'bg-border w-8'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Password */}
        {step === 0 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Set Your Password</h2>
                <p className="text-xs text-muted">This is a single-user app. One password protects everything.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Type it again"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={() => {
                if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
                if (password !== confirmPassword) { setError('Passwords do not match'); return; }
                setError('');
                setStep(1);
              }}
              disabled={!password || !confirmPassword}
              className="w-full py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ChevronRight size={16} /> Continue
            </button>
          </div>
        )}

        {/* Step 1: Display Name */}
        {step === 1 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Your Name</h2>
                <p className="text-xs text-muted">Used for greetings and AI context. Optional.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="e.g., John"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-background font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover font-medium flex items-center justify-center gap-2"
              >
                <ChevronRight size={16} /> {displayName.trim() ? 'Continue' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: API Key + Finish */}
        {step === 2 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Key size={20} className="text-violet-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">AI Assistant (Optional)</h2>
                <p className="text-xs text-muted">Add your Anthropic API key to enable AI features. You can add this later in Settings.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-muted mt-1">
                Get one at{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  console.anthropic.com
                </a>
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-background font-medium"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-muted mt-6">
          This is your personal instance. All data stays on your server.
        </p>
      </div>
    </div>
  );
}
