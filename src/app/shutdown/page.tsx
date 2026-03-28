'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Moon,
  Inbox,
  PenLine,
  Target,
  Check,
  ChevronRight,
  Plus,
  Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────
interface DailyNote {
  id: string;
  date: string;
  top3_first: string;
  top3_second: string;
  top3_third: string;
  tomorrow: string;
}

interface InboxItem {
  id: string;
  content: string;
  source: string;
  status: string;
}

interface ShutdownDiscipline {
  id: string;
  name: string;
  type: 'discipline' | 'value';
  description: string | null;
}

interface ShutdownDisciplineLog {
  discipline_id: string;
  completed: number;
  notes: string | null;
}

// ── Steps config ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'capture', label: 'Capture Sweep', icon: Inbox },
  { id: 'disciplines', label: 'Disciplines Check-In', icon: Target },
  { id: 'tomorrow', label: 'Write Tomorrow', icon: PenLine },
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
  const [allDisciplines, setAllDisciplines] = useState<ShutdownDiscipline[]>([]);
  const [disciplineLogs, setDisciplineLogs] = useState<ShutdownDisciplineLog[]>([]);

  // Form state
  const [captureInput, setCaptureInput] = useState('');
  const [capturedCount, setCapturedCount] = useState(0);
  const [tomorrowText, setTomorrowText] = useState('');

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── Fetch data on mount ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [noteRes, inboxRes, discRes, discLogsRes] = await Promise.all([
          fetch(`/api/daily-notes?date=${todayStr()}`),
          fetch('/api/inbox'),
          fetch('/api/disciplines'),
          fetch(`/api/disciplines/logs?date=${todayStr()}`),
        ]);

        const noteData = await noteRes.json();
        if (noteData && !noteData.error) {
          setDailyNote(noteData);
          setTomorrowText(noteData.tomorrow || '');
        }

        const inboxData = await inboxRes.json();
        setInboxItems(
          Array.isArray(inboxData)
            ? inboxData.filter((i: InboxItem) => i.status === 'pending')
            : []
        );

        const discData = await discRes.json();
        if (Array.isArray(discData)) {
          setAllDisciplines(discData);
        }
        const dlData = await discLogsRes.json();
        if (Array.isArray(dlData)) {
          setDisciplineLogs(dlData);
        }
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
    if (step === 3) {
      setCompletedSteps((prev) => new Set(prev).add(3));
    }
  }, [step]);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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

      // ── Step 1: Disciplines Check-In ────────────────────────────
      case 1: {
        // Show ALL disciplines (not just shutdown ones) so user can check off anything they did today
        const toggleDiscipline = async (disciplineId: string) => {
          const existing = disciplineLogs.find(l => l.discipline_id === disciplineId);
          const newCompleted = existing?.completed === 1 ? 0 : 1;

          await fetch('/api/disciplines/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              discipline_id: disciplineId,
              date: todayStr(),
              completed: newCompleted,
            }),
          });

          if (existing) {
            setDisciplineLogs(disciplineLogs.map(l =>
              l.discipline_id === disciplineId ? { ...l, completed: newCompleted } : l
            ));
          } else {
            setDisciplineLogs([...disciplineLogs, { discipline_id: disciplineId, completed: newCompleted, notes: null }]);
          }
        };

        const checkedCount = allDisciplines.filter(d =>
          disciplineLogs.find(l => l.discipline_id === d.id)?.completed === 1
        ).length;

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Target size={24} className="text-emerald-500" />
                Disciplines Check-In
              </h2>
              <p className="text-muted mt-1">
                Review your disciplines for today. {allDisciplines.length > 0 ? `${checkedCount}/${allDisciplines.length} completed.` : ''}
              </p>
            </div>

            {allDisciplines.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center">
                <p className="text-muted text-sm">No active disciplines. Set them up in the Disciplines page.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-6 space-y-2">
                {allDisciplines.map(d => {
                  const log = disciplineLogs.find(l => l.discipline_id === d.id);
                  const done = log?.completed === 1;
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDiscipline(d.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        done ? 'bg-green-50 border border-green-200' : 'bg-background border border-border hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-green-500' : 'border-2 border-border'
                      }`}>
                        {done && <Check size={12} className="text-white" />}
                      </span>
                      <div>
                        <span className={`text-sm ${done ? 'line-through text-muted' : 'text-foreground'}`}>
                          {d.name}
                        </span>
                        {d.description && (
                          <p className="text-xs text-muted">{d.description}</p>
                        )}
                      </div>
                      <span className="ml-auto text-xs text-muted">
                        {d.type === 'value' ? 'value' : 'discipline'}
                      </span>
                    </button>
                  );
                })}
              </div>
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

      // ── Step 2: Write Tomorrow ───────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <PenLine size={24} className="text-violet-500" />
                Write Tomorrow
              </h2>
              <p className="text-muted mt-1">
                What needs to happen tomorrow? Things to prep for, notes for morning-you.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Tomorrow</h3>
              <textarea
                rows={5}
                value={tomorrowText}
                onChange={(e) => setTomorrowText(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                placeholder="What does tomorrow-you need to know? Key meetings, deadlines, things to prep..."
              />
            </div>

            <button
              onClick={async () => {
                await patchNote({ tomorrow: tomorrowText.trim() });
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
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Moon size={24} className="text-indigo-400" />
                Day Complete
              </h2>
              <p className="text-muted mt-1">Here&apos;s a summary of your shutdown routine.</p>
            </div>

            {/* Summary */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Shutdown Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Inbox size={18} className="text-blue-500" />
                  <div>
                    <p className="text-sm text-muted">Items Captured</p>
                    <p className="text-lg font-semibold text-foreground">{capturedCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <PenLine size={18} className="text-violet-500" />
                  <div>
                    <p className="text-sm text-muted">Tomorrow</p>
                    <p className="text-lg font-semibold text-foreground">
                      {tomorrowText.trim() ? 'Written' : 'Skipped'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Disciplines summary */}
            {allDisciplines.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Target size={16} className="text-emerald-500" /> Disciplines
                  </h3>
                  <span className="text-sm font-medium text-primary">
                    {disciplineLogs.filter(l => l.completed === 1).length}/{allDisciplines.length}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${allDisciplines.length > 0 ? (disciplineLogs.filter(l => l.completed === 1).length / allDisciplines.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Top 3 mini-reflection */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Today&apos;s Top 3 &mdash; Did you get to them?</h3>
              <ol className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <span className="text-foreground pt-0.5">
                    {dailyNote?.top3_first || (
                      <span className="text-muted italic">Not set</span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <span className="text-foreground pt-0.5">
                    {dailyNote?.top3_second || (
                      <span className="text-muted italic">Not set</span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <span className="text-foreground pt-0.5">
                    {dailyNote?.top3_third || (
                      <span className="text-muted italic">Not set</span>
                    )}
                  </span>
                </li>
              </ol>
            </div>

            {/* Shutdown complete message */}
            <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
              <Moon size={48} className="mx-auto text-indigo-400" />
              <h3 className="text-xl font-bold text-foreground">
                Shutdown Complete
              </h3>
              <p className="text-muted">Enjoy your evening.</p>
            </div>
          </div>
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
