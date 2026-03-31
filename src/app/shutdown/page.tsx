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
  Target,
  Compass,
} from 'lucide-react';
import CompletionCelebration from '@/components/CompletionCelebration';
import { todayStr } from '@/lib/date-utils';

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

interface DisciplineItem {
  id: string;
  name: string;
  type: 'discipline' | 'value';
  description: string | null;
}

interface DisciplineLog {
  discipline_id: string;
  completed: number;
}

// ── Steps config ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'capture', label: 'Capture Sweep', icon: Inbox },
  { id: 'disciplines', label: 'Discipline Review', icon: Target },
  { id: 'reflection', label: 'Evening Reflection', icon: Sun },
  { id: 'complete', label: 'Day Complete', icon: Moon },
];

// ── Component ────────────────────────────────────────────────────────
export default function ShutdownPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Data
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [disciplineLogs, setDisciplineLogs] = useState<DisciplineLog[]>([]);
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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── Fetch data on mount ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const today = todayStr();
        const [noteRes, inboxRes, discRes, logsRes] = await Promise.all([
          fetch(`/api/daily-notes?date=${today}`),
          fetch('/api/inbox'),
          fetch('/api/disciplines'),
          fetch(`/api/disciplines/logs?date=${today}`),
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

        const discData = await discRes.json();
        setDisciplines(Array.isArray(discData) ? discData : []);

        const logsData = await logsRes.json();
        setDisciplineLogs(Array.isArray(logsData) ? logsData : []);

      } catch (err) {
        console.error('Failed to load shutdown data', err);
        setLoadError(true);
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
    if (step === 3) {
      setCompletedSteps((prev) => new Set(prev).add(3));
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

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">Failed to load data. Please try again.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Retry</button>
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

      // ── Step 1: Discipline Review ─────────────────────────────
      case 1: {
        const habitDisciplines = disciplines.filter(d => d.type === 'discipline');
        const valueDisciplines = disciplines.filter(d => d.type === 'value');
        const completedCount = disciplines.filter(d =>
          disciplineLogs.some(l => l.discipline_id === d.id && l.completed)
        ).length;

        const toggleDiscipline = async (discId: string) => {
          const existing = disciplineLogs.find(l => l.discipline_id === discId);
          const newCompleted = existing ? !existing.completed : true;

          // Optimistic update
          setDisciplineLogs(prev => {
            const without = prev.filter(l => l.discipline_id !== discId);
            return [...without, { discipline_id: discId, completed: newCompleted ? 1 : 0 }];
          });

          try {
            const res = await fetch('/api/disciplines/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ discipline_id: discId, date: todayStr(), completed: newCompleted ? 1 : 0 }),
            });
            if (!res.ok) throw new Error('Failed to save');
          } catch {
            // Rollback
            setDisciplineLogs(prev => {
              const without = prev.filter(l => l.discipline_id !== discId);
              if (existing) return [...without, existing];
              return without;
            });
          }
        };

        const renderToggle = (d: DisciplineItem) => {
          const isComplete = disciplineLogs.some(l => l.discipline_id === d.id && l.completed);
          return (
            <button
              key={d.id}
              onClick={() => toggleDiscipline(d.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                isComplete
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                  : 'bg-background border border-border hover:border-primary/30'
              }`}
            >
              <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                isComplete ? 'bg-green-500' : 'border-2 border-border'
              }`}>
                {isComplete && <Check size={12} className="text-white" />}
              </span>
              <div className="min-w-0">
                <span className={`text-sm ${isComplete ? 'text-foreground font-medium' : 'text-foreground'}`}>
                  {d.name}
                </span>
                {d.description && (
                  <p className="text-xs text-muted mt-0.5">{d.description}</p>
                )}
              </div>
            </button>
          );
        };

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Target size={24} className="text-emerald-500" />
                Discipline Review
              </h2>
              <p className="text-muted mt-1">
                Review how you showed up today.
              </p>
            </div>

            {disciplines.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center">
                <p className="text-muted text-sm">No active disciplines to review.</p>
                <p className="text-muted text-xs mt-1">Add them from the Disciplines page.</p>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Today&apos;s progress</span>
                    <span className="text-sm font-semibold text-primary">
                      {completedCount}/{disciplines.length}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${disciplines.length > 0 ? (completedCount / disciplines.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Habit disciplines */}
                {habitDisciplines.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Target size={16} className="text-emerald-500" />
                      Disciplines
                    </h3>
                    <div className="space-y-1.5">
                      {habitDisciplines.map(renderToggle)}
                    </div>
                  </div>
                )}

                {/* Value disciplines */}
                {valueDisciplines.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Compass size={16} className="text-amber-500" />
                      Values &mdash; Were you this today?
                    </h3>
                    <div className="space-y-1.5">
                      {valueDisciplines.map(renderToggle)}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => advance()}
              className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors"
            >
              <ChevronRight size={16} />
              Continue
            </button>
          </div>
        );
      }

      // ── Step 2: Evening Reflection ──────────────────────────────
      case 2:
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

      // ── Step 3: Day Complete ─────────────────────────────────────
      case 3:
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
