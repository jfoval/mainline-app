'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sun,
  Inbox,
  Rocket,
  Check,
  ChevronRight,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import CompletionCelebration from '@/components/CompletionCelebration';

// ── Types ────────────────────────────────────────────────────────────
interface DailyNote {
  id: string;
  date: string;
  reflection_matters_most: string;
  reflection_who_to_be: string;
  reflection_one_action: string;
  top3_first: string;
  top3_second: string;
  top3_third: string;
  notes: string;
  tomorrow: string;
  inbox_checks: string | null;
}

interface InboxItem {
  id: string;
  content: string;
  source: string;
  status: string;
}

interface InboxType {
  id: string;
  name: string;
}

// ── Steps config ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'reflection', label: 'Daily Note & Reflection', icon: Sun },
  { id: 'inbox', label: 'Process Inbox', icon: Inbox },
  { id: 'ready', label: 'Ready to Work', icon: Rocket },
];

const DEFAULT_INBOX_TYPES: InboxType[] = [
  { id: 'default_physical', name: 'Physical (notes, paper, etc.)' },
  { id: 'default_work_email', name: 'Work Email' },
  { id: 'default_personal_email', name: 'Personal Email' },
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

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ── Component ────────────────────────────────────────────────────────
export default function MorningProcessPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Data
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [yesterdayNote, setYesterdayNote] = useState<DailyNote | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [stalledProjects, setStalledProjects] = useState<{title: string}[]>([]);

  // Form state
  const [reflection, setReflection] = useState({
    matters_most: '',
    who_to_be: '',
  });
  const [top3First, setTop3First] = useState('');
  const [top3Second, setTop3Second] = useState('');
  const [top3Third, setTop3Third] = useState('');
  // Inbox types
  const [inboxTypes, setInboxTypes] = useState<InboxType[]>([]);
  const [inboxChecks, setInboxChecks] = useState<Record<string, boolean>>({});
  const [editingInboxTypes, setEditingInboxTypes] = useState(false);
  const [newInboxTypeName, setNewInboxTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch all data on mount ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [noteRes, yesterdayRes, inboxRes, projectsRes, settingsRes] =
          await Promise.all([
            fetch(`/api/daily-notes?date=${todayStr()}`),
            fetch(`/api/daily-notes?date=${yesterdayStr()}`),
            fetch('/api/inbox'),
            fetch('/api/projects?status=active'),
            fetch('/api/settings'),
          ]);

        const noteData = await noteRes.json();
        if (noteData && !noteData.error) {
          setDailyNote(noteData);
          setReflection({
            matters_most: noteData.reflection_matters_most || '',
            who_to_be: noteData.reflection_who_to_be || '',
          });
          setTop3First(noteData.top3_first || noteData.reflection_one_action || '');
          if (noteData.top3_second) setTop3Second(noteData.top3_second);
          if (noteData.top3_third) setTop3Third(noteData.top3_third);
          if (noteData.inbox_checks) {
            try { setInboxChecks(JSON.parse(noteData.inbox_checks)); } catch { /* invalid JSON */ }
          }
        }

        const yData = await yesterdayRes.json();
        if (yData && !yData.error) setYesterdayNote(yData);

        const inboxData = await inboxRes.json();
        setInboxItems(Array.isArray(inboxData) ? inboxData.filter((i: InboxItem) => i.status === 'pending') : []);

        const pjData = await projectsRes.json();
        if (Array.isArray(pjData)) {
          setStalledProjects(
            pjData.filter((p: { active_action_count?: number }) => p.active_action_count === 0)
              .map((p: { title: string }) => ({ title: p.title }))
          );
        }

        // Load inbox types from settings
        const settings = await settingsRes.json();
        if (settings.inbox_types) {
          try {
            const parsed = JSON.parse(settings.inbox_types);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setInboxTypes(parsed);
            } else {
              await seedDefaultInboxTypes();
            }
          } catch {
            await seedDefaultInboxTypes();
          }
        } else {
          await seedDefaultInboxTypes();
        }
      } catch (err) {
        console.error('Failed to load morning process data', err);
      } finally {
        setLoading(false);
      }
    }

    async function seedDefaultInboxTypes() {
      setInboxTypes(DEFAULT_INBOX_TYPES);
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_types: JSON.stringify(DEFAULT_INBOX_TYPES) }),
      });
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

  // ── Inbox type management ─────────────────────────────────────────
  async function saveInboxTypes(types: InboxType[]) {
    setInboxTypes(types);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox_types: JSON.stringify(types) }),
    });
  }

  function addInboxType() {
    if (!newInboxTypeName.trim()) return;
    const newType: InboxType = { id: generateId(), name: newInboxTypeName.trim() };
    saveInboxTypes([...inboxTypes, newType]);
    setNewInboxTypeName('');
  }

  function deleteInboxType(id: string) {
    saveInboxTypes(inboxTypes.filter(t => t.id !== id));
    const updated = { ...inboxChecks };
    delete updated[id];
    setInboxChecks(updated);
    if (dailyNote?.id) {
      patchNote({ inbox_checks: JSON.stringify(updated) });
    }
  }

  function saveEditInboxType() {
    if (!editingTypeId || !editingTypeName.trim()) return;
    saveInboxTypes(inboxTypes.map(t => t.id === editingTypeId ? { ...t, name: editingTypeName.trim() } : t));
    setEditingTypeId(null);
    setEditingTypeName('');
  }

  function toggleInboxCheck(typeId: string) {
    const updated = { ...inboxChecks, [typeId]: !inboxChecks[typeId] };
    setInboxChecks(updated);
    if (dailyNote?.id) {
      patchNote({ inbox_checks: JSON.stringify(updated) });
    }
  }

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
      <div className="flex items-center justify-center min-h-[400px]">
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
              <p className="text-muted mt-1">Good morning. Take a breath, then set your intention for today.</p>
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

            {stalledProjects.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-1">{stalledProjects.length} stalled project{stalledProjects.length !== 1 ? 's' : ''} (no next action)</h3>
                <ul className="text-xs text-red-600 list-disc ml-5">
                  {stalledProjects.map((p, i) => <li key={i}>{p.title}</li>)}
                </ul>
              </div>
            )}

            {/* Morning reflection fields */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h3 className="font-semibold text-foreground">Morning Reflection</h3>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">What matters most today?</label>
                <textarea
                  rows={2}
                  value={reflection.matters_most}
                  onChange={(e) => setReflection((r) => ({ ...r, matters_most: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Cut through the noise — what's the priority?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Who do I want to be today?</label>
                <textarea
                  rows={2}
                  value={reflection.who_to_be}
                  onChange={(e) => setReflection((r) => ({ ...r, who_to_be: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Calm, disciplined, courageous, generous, focused..."
                />
              </div>
              <h3 className="font-semibold text-foreground pt-2">Today&apos;s Top 3</h3>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#1 — What one action, if completed today, would move my life forward most? <span className="font-normal text-muted-foreground">(do the hardest thing first)</span></label>
                <textarea
                  rows={2}
                  value={top3First}
                  onChange={(e) => setTop3First(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Progress, not just activity..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#2 — Second most important</label>
                <textarea
                  rows={2}
                  value={top3Second}
                  onChange={(e) => setTop3Second(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Second most important outcome for today..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">#3 — Third most important</label>
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
                  reflection_matters_most: reflection.matters_most,
                  reflection_who_to_be: reflection.who_to_be,
                  reflection_one_action: top3First.trim(),
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

            {/* Inbox type checkboxes */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Check your inboxes</h3>
                <button
                  onClick={() => setEditingInboxTypes(!editingInboxTypes)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-primary/5 transition-colors"
                  title="Manage inbox types"
                  aria-label="Manage inbox types"
                >
                  <Settings size={14} />
                </button>
              </div>

              {editingInboxTypes ? (
                <div className="space-y-2">
                  {inboxTypes.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      {editingTypeId === t.id ? (
                        <>
                          <input
                            type="text"
                            value={editingTypeName}
                            onChange={e => setEditingTypeName(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveEditInboxType(); if (e.key === 'Escape') setEditingTypeId(null); }}
                          />
                          <button onClick={saveEditInboxType} className="p-1 text-green-600 hover:bg-green-50 rounded" aria-label="Save">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingTypeId(null)} className="p-1 text-muted hover:bg-card rounded" aria-label="Cancel">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-foreground">{t.name}</span>
                          <button onClick={() => { setEditingTypeId(t.id); setEditingTypeName(t.name); }} className="p-1 text-muted hover:text-foreground rounded" aria-label="Edit">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteInboxType(t.id)} className="p-1 text-muted hover:text-red-600 rounded" aria-label="Delete">
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newInboxTypeName}
                      onChange={e => setNewInboxTypeName(e.target.value)}
                      placeholder="Add inbox type..."
                      className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      onKeyDown={e => { if (e.key === 'Enter') addInboxType(); }}
                    />
                    <button onClick={addInboxType} disabled={!newInboxTypeName.trim()} className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-30" aria-label="Add inbox type">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => setEditingInboxTypes(false)} className="text-xs text-primary hover:underline mt-1">
                    Done editing
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {inboxTypes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => toggleInboxCheck(t.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        inboxChecks[t.id] ? 'bg-green-50 border border-green-200' : 'bg-background border border-border hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                        inboxChecks[t.id] ? 'bg-green-500' : 'border-2 border-border'
                      }`}>
                        {inboxChecks[t.id] && <Check size={10} className="text-white" />}
                      </span>
                      <span className={`text-sm ${inboxChecks[t.id] ? 'line-through text-muted' : 'text-foreground'}`}>
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* App inbox count */}
            <div className="bg-card rounded-xl border border-border p-6 text-center space-y-4">
              {inboxItems.length === 0 ? (
                <div className="py-6">
                  <Check size={48} className="mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-semibold text-foreground">0 items &mdash; app inbox clear!</p>
                  <p className="text-muted text-sm mt-1">Nothing to process. Nice work.</p>
                </div>
              ) : (
                <>
                  <div className="py-4">
                    <span className="text-4xl font-bold text-foreground">{inboxItems.length}</span>
                    <p className="text-muted mt-1">pending item{inboxItems.length !== 1 ? 's' : ''} in app inbox</p>
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

      // ── Step 2: Ready to Work ────────────────────────────────────
      case 2:
        return (
          <CompletionCelebration
            title="You're ready!"
            subtitle="Go make it a great day."
          />
        );

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
