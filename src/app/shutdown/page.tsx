'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Moon,
  Inbox,
  Check,
  ChevronRight,
  Plus,
  Loader2,
  Sun,
} from 'lucide-react';
import CompletionCelebration from '@/components/CompletionCelebration';

// ── Types ────────────────────────────────────────────────────────────
interface DailyNote {
  id: string;
  date: string;
  top3_first: string;
  top3_second: string;
  top3_third: string;
  reflection_matters_most: string;
  reflection_who_to_be: string;
  evening_did_well: string;
  evening_fell_short: string;
  evening_do_differently: string;
}

interface InboxItem {
  id: string;
  content: string;
  source: string;
  status: string;
}

// ── Steps config ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'capture', label: 'Capture Sweep', icon: Inbox },
  { id: 'reflection', label: 'Evening Reflection', icon: Sun },
  { id: 'complete', label: 'Day Complete', icon: Moon },
];

// ── Helpers ──────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Component ────────────────────────────────────────────────────────
export default function ShutdownPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Data
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  // Form state
  const [captureInput, setCaptureInput] = useState('');
  const [capturedCount, setCapturedCount] = useState(0);
  const [eveningReflection, setEveningReflection] = useState({
    did_well: '',
    fell_short: '',
    do_differently: '',
  });

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── Fetch data on mount ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [noteRes, inboxRes] = await Promise.all([
          fetch(`/api/daily-notes?date=${todayStr()}`),
          fetch('/api/inbox'),
        ]);

        const noteData = await noteRes.json();
        if (noteData && !noteData.error) {
          setDailyNote(noteData);
          setEveningReflection({
            did_well: noteData.evening_did_well || '',
            fell_short: noteData.evening_fell_short || '',
            do_differently: noteData.evening_do_differently || '',
          });
        }

        const inboxData = await inboxRes.json();
        setInboxItems(
          Array.isArray(inboxData)
            ? inboxData.filter((i: InboxItem) => i.status === 'pending')
            : []
        );

      } catch (err) {
        console.error('Failed to load shutdown data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save helper ────────────────────────────────────────────────────
  const patchNote = useCallback(
    async (fields: Record<string, string>) => {
      if (!dailyNote?.id) return;
      setSaving(true);
      try {
        const res = await fetch('/api/daily-notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dailyNote.id, ...fields }),
        });
        const updated = await res.json();
        if (updated && !updated.error) setDailyNote(updated);
      } finally {
        setSaving(false);
      }
    },
    [dailyNote?.id]
  );

  // ── Add to inbox ───────────────────────────────────────────────────
  const addToInbox = useCallback(async () => {
    const content = captureInput.trim();
    if (!content) return;
    setAdding(true);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source: 'manual' }),
      });
      if (res.ok) {
        setCaptureInput('');
        setCapturedCount((c) => c + 1);
        // Refresh inbox count
        const inboxRes = await fetch('/api/inbox');
        const inboxData = await inboxRes.json();
        setInboxItems(
          Array.isArray(inboxData)
            ? inboxData.filter((i: InboxItem) => i.status === 'pending')
            : []
        );
      }
    } finally {
      setAdding(false);
    }
  }, [captureInput]);

  // ── Step navigation ────────────────────────────────────────────────
  function advance() {
    setCompletedSteps((prev) => new Set(prev).add(step));
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  // ── Mark final step complete when reached ───────────────────────────
  useEffect(() => {
    if (step === 2) {
      setCompletedSteps((prev) => new Set(prev).add(2));
    }
  }, [step]);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  // ── Render steps ───────────────────────────────────────────────────
  function renderStepContent() {
    switch (step) {
      // ── Step 0: Capture Sweep ────────────────────────────────────
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Inbox size={24} className="text-blue-500" />
                Capture Sweep
              </h2>
              <p className="text-muted mt-1">
                Scan for uncaptured commitments from today&apos;s conversations, meetings, and texts.
              </p>
            </div>

            {/* Pending inbox count */}
            {inboxItems.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <Inbox size={18} className="text-muted" />
                <span className="text-foreground text-sm">
                  <span className="font-semibold">{inboxItems.length}</span> pending inbox item{inboxItems.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Quick-add form */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Quick Capture to Inbox</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !adding) addToInbox();
                  }}
                  className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Anything still on your mind..."
                />
                <button
                  onClick={addToInbox}
                  disabled={adding || !captureInput.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
                >
                  {adding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add
                </button>
              </div>

              {capturedCount > 0 && (
                <p className="text-sm text-green-500 flex items-center gap-1.5">
                  <Check size={14} />
                  {capturedCount} item{capturedCount !== 1 ? 's' : ''} captured this session
                </p>
              )}
            </div>

            <button
              onClick={() => advance()}
              className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors"
            >
              <ChevronRight size={16} />
              {capturedCount === 0 ? 'Nothing to Capture' : 'Done Capturing'}
            </button>
          </div>
        );

      // ── Step 1: Evening Reflection ──────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sun size={24} className="text-amber-500" />
                Evening Reflection
              </h2>
              <p className="text-muted mt-1">
                Look back on your day with honesty and self-respect.
              </p>
            </div>

            {/* Morning Review — read-only context */}
            {(dailyNote?.top3_first || dailyNote?.reflection_matters_most || dailyNote?.reflection_who_to_be) && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">This morning you said:</h3>

                {dailyNote?.top3_first && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Top 3</h4>
                    <ol className="list-decimal list-inside space-y-1 text-foreground text-sm">
                      <li className="font-semibold">{dailyNote.top3_first}</li>
                      {dailyNote.top3_second && <li>{dailyNote.top3_second}</li>}
                      {dailyNote.top3_third && <li>{dailyNote.top3_third}</li>}
                    </ol>
                  </div>
                )}

                {dailyNote?.reflection_matters_most && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">What could hold me back</h4>
                    <p className="text-foreground text-sm italic">&ldquo;{dailyNote.reflection_matters_most}&rdquo;</p>
                  </div>
                )}

                {dailyNote?.reflection_who_to_be && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Who I wanted to be</h4>
                    <p className="text-foreground text-sm italic">&ldquo;{dailyNote.reflection_who_to_be}&rdquo;</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">What did I do well today?</label>
                <textarea
                  rows={2}
                  value={eveningReflection.did_well}
                  onChange={(e) => setEveningReflection((r) => ({ ...r, did_well: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Recognize what's working..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Where did I fall short, and why?</label>
                <textarea
                  rows={2}
                  value={eveningReflection.fell_short}
                  onChange={(e) => setEveningReflection((r) => ({ ...r, fell_short: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Honest awareness — the 'why' is where the lesson is..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">What will I do differently tomorrow?</label>
                <textarea
                  rows={2}
                  value={eveningReflection.do_differently}
                  onChange={(e) => setEveningReflection((r) => ({ ...r, do_differently: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Turn insight into improvement..."
                />
              </div>
            </div>

            <button
              onClick={async () => {
                await patchNote({
                  evening_did_well: eveningReflection.did_well,
                  evening_fell_short: eveningReflection.fell_short,
                  evening_do_differently: eveningReflection.do_differently,
                });
                advance();
              }}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ChevronRight size={16} />
              )}
              Save &amp; Continue
            </button>
          </div>
        );

      // ── Step 2: Day Complete ─────────────────────────────────────
      case 2:
        return (
          <CompletionCelebration
            title="Shutdown Complete"
            subtitle="Your mind is clear. Enjoy your evening."
          />
        );

      default:
        return null;
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Shutdown Routine</h1>
          <p className="text-muted mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Step sidebar */}
          <div className="md:w-64 flex-shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === i;
                const isDone = completedSteps.has(i);

                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isDone || i <= step) setStep(i);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : isDone
                          ? 'bg-card border border-border text-foreground'
                          : 'text-muted hover:bg-card'
                    }`}
                  >
                    <span className="relative flex-shrink-0">
                      {isDone && !isActive ? (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </span>
                      ) : (
                        <Icon size={18} />
                      )}
                    </span>
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Progress indicator */}
            <div className="hidden md:block mt-6 px-4">
              <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedSteps.size / STEPS.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted mt-2">
                {completedSteps.size} of {STEPS.length} steps complete
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">{renderStepContent()}</div>
        </div>
      </div>
    </div>
  );
}
