'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sun,
  Inbox,
  ListChecks,
  Target,
  Rocket,
  Check,
  ChevronRight,
  Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────
interface DailyNote {
  id: string;
  date: string;
  reflection_showed_up: string;
  reflection_fell_short: string;
  reflection_noticed: string;
  reflection_grateful: string;
  top3_first: string;
  top3_second: string;
  top3_third: string;
  notes: string;
  tomorrow: string;
}

interface InboxItem {
  id: string;
  content: string;
  source: string;
  status: string;
}

interface Action {
  content: string;
  context: string;
  status: string;
}

interface DisciplineItem {
  id: string;
  name: string;
  type: 'discipline' | 'value';
  description: string | null;
  time_of_day: string;
}

interface DisciplineLogItem {
  discipline_id: string;
  completed: number;
}

// ── Steps config ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'reflection', label: 'Daily Note & Reflection', icon: Sun },
  { id: 'inbox', label: 'Process Inbox', icon: Inbox },
  { id: 'top3', label: 'Pick Top 3', icon: ListChecks },
  { id: 'disciplines', label: 'Disciplines', icon: Target },
  { id: 'ready', label: 'Ready to Work', icon: Rocket },
];

// ── Helpers ──────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Component ────────────────────────────────────────────────────────
export default function MorningProcessPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Data
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [yesterdayNote, setYesterdayNote] = useState<DailyNote | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [stalledProjects, setStalledProjects] = useState<{title: string}[]>([]);

  // Form state
  const [reflection, setReflection] = useState({
    showed_up: '',
    fell_short: '',
    noticed: '',
    grateful: '',
  });
  const [top3First, setTop3First] = useState('');
  const [top3Second, setTop3Second] = useState('');
  const [top3Third, setTop3Third] = useState('');
  const [morningDisciplines, setMorningDisciplines] = useState<DisciplineItem[]>([]);
  const [disciplineLogs, setDisciplineLogs] = useState<DisciplineLogItem[]>([]);

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch all data on mount ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [noteRes, yesterdayRes, inboxRes, actionsRes, projectsRes, discRes, discLogsRes] =
          await Promise.all([
            fetch(`/api/daily-notes?date=${todayStr()}`),
            fetch(`/api/daily-notes?date=${yesterdayStr()}`),
            fetch('/api/inbox'),
            fetch('/api/actions'),
            fetch('/api/projects?status=active'),
            fetch('/api/disciplines'),
            fetch(`/api/disciplines/logs?date=${todayStr()}`),
          ]);

        const noteData = await noteRes.json();
        if (noteData && !noteData.error) {
          setDailyNote(noteData);
          setReflection({
            showed_up: noteData.reflection_showed_up || '',
            fell_short: noteData.reflection_fell_short || '',
            noticed: noteData.reflection_noticed || '',
            grateful: noteData.reflection_grateful || '',
          });
          if (noteData.top3_first) setTop3First(noteData.top3_first);
          if (noteData.top3_second) setTop3Second(noteData.top3_second);
          if (noteData.top3_third) setTop3Third(noteData.top3_third);
        }

        const yData = await yesterdayRes.json();
        if (yData && !yData.error) setYesterdayNote(yData);

        const inboxData = await inboxRes.json();
        setInboxItems(Array.isArray(inboxData) ? inboxData.filter((i: InboxItem) => i.status === 'pending') : []);

        const aData = await actionsRes.json();
        setActions(Array.isArray(aData) ? aData.filter((a: Action) => a.status === 'active') : []);

        const pjData = await projectsRes.json();
        if (Array.isArray(pjData)) {
          setStalledProjects(
            pjData.filter((p: { active_action_count?: number }) => p.active_action_count === 0)
              .map((p: { title: string }) => ({ title: p.title }))
          );
        }

        const discData = await discRes.json();
        if (Array.isArray(discData)) {
          setMorningDisciplines(discData.filter((d: DisciplineItem) => d.time_of_day === 'morning'));
        }
        const dlData = await discLogsRes.json();
        if (Array.isArray(dlData)) {
          setDisciplineLogs(dlData);
        }
      } catch (err) {
        console.error('Failed to load morning process data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save helper ──────────────────────────────────────────────────
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
    [dailyNote?.id],
  );

  // ── Refresh inbox count ──────────────────────────────────────────
  const refreshInbox = useCallback(async () => {
    const res = await fetch('/api/inbox');
    const data = await res.json();
    setInboxItems(Array.isArray(data) ? data.filter((i: InboxItem) => i.status === 'pending') : []);
  }, []);

  // ── Step navigation ──────────────────────────────────────────────
  function advance() {
    setCompletedSteps((prev) => new Set(prev).add(step));
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  // ── Render steps ─────────────────────────────────────────────────
  function renderStepContent() {
    switch (step) {
      // ── Step 0: Daily Note & Reflection ──────────────────────────
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sun size={24} className="text-amber-500" />
                Daily Note &amp; Reflection
              </h2>
              <p className="text-muted mt-1">Good morning. Take a breath, then reflect on yesterday.</p>
            </div>

            {/* Yesterday's "tomorrow" field */}
            {yesterdayNote?.tomorrow && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
                  Yesterday you said about today:
                </h3>
                <p className="text-foreground italic">&ldquo;{yesterdayNote.tomorrow}&rdquo;</p>
              </div>
            )}

            {/* Reflection fields */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h3 className="font-semibold text-foreground">Reflection</h3>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Where did I show up well yesterday?</label>
                <textarea
                  rows={2}
                  value={reflection.showed_up}
                  onChange={(e) => setReflection((r) => ({ ...r, showed_up: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="What went well..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Where did I fall short?</label>
                <textarea
                  rows={2}
                  value={reflection.fell_short}
                  onChange={(e) => setReflection((r) => ({ ...r, fell_short: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="What could improve..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">What did I notice about myself?</label>
                <textarea
                  rows={2}
                  value={reflection.noticed}
                  onChange={(e) => setReflection((r) => ({ ...r, noticed: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Observations, patterns..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">What am I grateful for?</label>
                <textarea
                  rows={2}
                  value={reflection.grateful}
                  onChange={(e) => setReflection((r) => ({ ...r, grateful: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Gratitude..."
                />
              </div>
            </div>

            <button
              onClick={async () => {
                await patchNote({
                  reflection_showed_up: reflection.showed_up,
                  reflection_fell_short: reflection.fell_short,
                  reflection_noticed: reflection.noticed,
                  reflection_grateful: reflection.grateful,
                });
                advance();
              }}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Save &amp; Continue
            </button>
          </div>
        );

      // ── Step 1: Process Inbox ────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Inbox size={24} className="text-blue-500" />
                Process Inbox
              </h2>
              <p className="text-muted mt-1">Clarify and organize every open loop before you plan.</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Inbox size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Check your physical desk inbox too</p>
                <p className="text-xs text-amber-600">Papers, notes, business cards — anything on your desk that needs processing.</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 text-center space-y-4">
              {inboxItems.length === 0 ? (
                <div className="py-6">
                  <Check size={48} className="mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-semibold text-foreground">0 items &mdash; inbox clear!</p>
                  <p className="text-muted text-sm mt-1">Nothing to process. Nice work.</p>
                </div>
              ) : (
                <>
                  <div className="py-4">
                    <span className="text-4xl font-bold text-foreground">{inboxItems.length}</span>
                    <p className="text-muted mt-1">pending item{inboxItems.length !== 1 ? 's' : ''} to process</p>
                  </div>
                  <Link
                    href="/inbox/process"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Inbox size={16} />
                    Process Inbox Items
                  </Link>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={refreshInbox}
                className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-card font-medium transition-colors"
              >
                Refresh Count
              </button>
              <button
                onClick={() => advance()}
                className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors"
              >
                <ChevronRight size={16} />
                {inboxItems.length === 0 ? 'Continue' : 'Skip for Now'}
              </button>
            </div>
          </div>
        );

      // ── Step 2: Pick Top 3 ───────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ListChecks size={24} className="text-violet-500" />
                Pick Your Top 3
              </h2>
              <p className="text-muted mt-1">
                What three outcomes would make today a win?
              </p>
            </div>

            {stalledProjects.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-1">{stalledProjects.length} stalled project{stalledProjects.length !== 1 ? 's' : ''} (no next action)</h3>
                <ul className="text-xs text-red-600 list-disc ml-5">
                  {stalledProjects.map((p, i) => <li key={i}>{p.title}</li>)}
                </ul>
              </div>
            )}

            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              {/* Slot 1 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#1 — Most important</label>
                <textarea
                  rows={2}
                  value={top3First}
                  onChange={(e) => setTop3First(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="The single most important outcome for today..."
                />
              </div>

              {/* Slot 2 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#2</label>
                <textarea
                  rows={2}
                  value={top3Second}
                  onChange={(e) => setTop3Second(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Second most important outcome for today..."
                />
              </div>

              {/* Slot 3 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#3</label>
                <textarea
                  rows={2}
                  value={top3Third}
                  onChange={(e) => setTop3Third(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Third most important outcome for today..."
                />
              </div>
            </div>

            <button
              onClick={async () => {
                await patchNote({
                  top3_first: top3First.trim(),
                  top3_second: top3Second.trim(),
                  top3_third: top3Third.trim(),
                });
                advance();
              }}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Save Top 3 &amp; Continue
            </button>
          </div>
        );

      // ── Step 3: Today's Disciplines ───────────────────────────────
      case 3: {
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
            setDisciplineLogs([...disciplineLogs, { discipline_id: disciplineId, completed: newCompleted }]);
          }
        };

        const morningChecked = morningDisciplines.filter(d =>
          disciplineLogs.find(l => l.discipline_id === d.id)?.completed === 1
        ).length;

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Target size={24} className="text-emerald-500" />
                Today&apos;s Disciplines
              </h2>
              <p className="text-muted mt-1">
                Check off your morning disciplines. {morningDisciplines.length > 0 ? `${morningChecked}/${morningDisciplines.length} done.` : ''}
              </p>
            </div>

            {morningDisciplines.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center space-y-3">
                <Target size={36} className="mx-auto text-muted" />
                <p className="text-foreground font-medium">No morning disciplines set up yet.</p>
                <p className="text-muted text-sm">
                  Add disciplines in the <Link href="/disciplines" className="text-primary underline">Disciplines</Link> page.
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-6 space-y-2">
                {morningDisciplines.map(d => {
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

      // ── Step 4: Ready to Work ────────────────────────────────────
      case 4: {
        const contextCounts: Record<string, number> = {};
        actions.forEach((a) => {
          const ctx = a.context || 'uncategorized';
          contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;
        });

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Rocket size={24} className="text-orange-500" />
                Ready to Work
              </h2>
              <p className="text-muted mt-1">You&apos;re set. Here&apos;s your day at a glance.</p>
            </div>

            {/* Top 3 summary */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Today&apos;s Top 3</h3>
              <ol className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm font-bold">1</span>
                  <span className="text-foreground pt-0.5">{top3First || <span className="text-muted italic">Not set</span>}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center text-sm font-bold">2</span>
                  <span className="text-foreground pt-0.5">{top3Second || <span className="text-muted italic">Not set</span>}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold">3</span>
                  <span className="text-foreground pt-0.5">{top3Third || <span className="text-muted italic">Not set</span>}</span>
                </li>
              </ol>
            </div>

            {/* Context actions */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-3">
              <h3 className="font-semibold text-foreground">Context Actions Available</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(contextCounts).map(([ctx, count]) => (
                  <span key={ctx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground">
                    <span className="font-medium">@{ctx}</span>
                    <span className="text-muted">{count}</span>
                  </span>
                ))}
                {Object.keys(contextCounts).length === 0 && (
                  <p className="text-muted text-sm">No active context actions.</p>
                )}
              </div>
              <p className="text-sm text-muted mt-2">
                {actions.length} active action{actions.length !== 1 ? 's' : ''} across {Object.keys(contextCounts).length} context{Object.keys(contextCounts).length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Start your day */}
            <Link
              href="/actions"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-hover font-semibold text-lg transition-colors"
            >
              <Rocket size={20} />
              Start Your Day
            </Link>
          </div>
        );
      }

      default:
        return null;
    }
  }

  // ── Layout ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Morning Process</h1>
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
          {/* Step sidebar (left on desktop, top on mobile) */}
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
                      // Allow navigating to completed steps or the current frontier
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
                  style={{ width: `${((completedSteps.size) / STEPS.length) * 100}%` }}
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
