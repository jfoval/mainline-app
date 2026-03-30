'use client';

import { useState, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  Sun, Moon, Sparkles, X, Check,
} from 'lucide-react';
import { useOfflineStore, dailyNotesStore, journalEntriesStore } from '@/lib/offline';
import { useUndoableAction } from '@/lib/toast/useUndoableAction';
import { todayStr, localDateStr } from '@/lib/date-utils';

const TAG_OPTIONS = ['gratitude', 'idea', 'lesson', 'goal', 'win', 'struggle'];

const TAG_COLORS: Record<string, string> = {
  gratitude: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  idea: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  lesson: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  goal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  win: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  struggle: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  // Handle both "YYYY-MM-DD HH:MM:SS" and ISO formats
  const d = new Date(timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Data
  const { data: dailyNotes } = useOfflineStore(dailyNotesStore, { date: selectedDate });
  const { data: journalEntries, create, update, remove } = useOfflineStore(journalEntriesStore, { date: selectedDate });
  const { undoableDelete } = useUndoableAction();

  const dailyNote = dailyNotes?.[0] ?? null;

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTag, setNewTag] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTag, setEditTag] = useState('');

  // AI Insights state
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Morning reflection fields
  const morningFields = useMemo(() => {
    if (!dailyNote) return [];
    const fields: { label: string; value: string }[] = [];
    if (dailyNote.reflection_matters_most) fields.push({ label: 'What matters most today', value: dailyNote.reflection_matters_most });
    if (dailyNote.reflection_who_to_be) fields.push({ label: 'Who I want to be today', value: dailyNote.reflection_who_to_be });
    const topAction = dailyNote.top3_first || dailyNote.reflection_one_action;
    if (topAction) fields.push({ label: '#1 — Most important action', value: topAction });
    if (dailyNote.top3_second) fields.push({ label: '#2 — Second most important', value: dailyNote.top3_second });
    if (dailyNote.top3_third) fields.push({ label: '#3 — Third most important', value: dailyNote.top3_third });
    return fields;
  }, [dailyNote]);

  // Evening reflection fields
  const eveningFields = useMemo(() => {
    if (!dailyNote) return [];
    const fields: { label: string; value: string }[] = [];
    if (dailyNote.evening_did_well) fields.push({ label: 'What I did well', value: dailyNote.evening_did_well });
    if (dailyNote.evening_fell_short) fields.push({ label: 'Where I fell short', value: dailyNote.evening_fell_short });
    if (dailyNote.evening_do_differently) fields.push({ label: 'What I\'ll do differently', value: dailyNote.evening_do_differently });
    return fields;
  }, [dailyNote]);

  const isToday = selectedDate === todayStr();

  // Handlers
  async function handleAdd() {
    if (!newContent.trim()) return;
    await create({ entry_date: selectedDate, content: newContent.trim(), tag: newTag || null });
    setNewContent('');
    setNewTag('');
    setShowAdd(false);
  }

  function startEdit(entry: { id: string; content: string; tag: string | null }) {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditTag(entry.tag || '');
  }

  async function handleSaveEdit() {
    if (!editingId || !editContent.trim()) return;
    await update({ id: editingId, content: editContent.trim(), tag: editTag || null });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    undoableDelete(id, remove, 'Journal entry deleted');
  }

  async function handleAiInsights() {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'journal_insights', data: { days: 14 } }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get insights');
      }
      const result = await res.json();
      setAiInsights(result.insights);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Failed to get insights');
    } finally {
      setLoadingInsights(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          className="p-2 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => dateInputRef.current?.showPicker()}
            className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
          >
            {formatDateDisplay(selectedDate)}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr())}
              className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground font-medium"
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={() => setSelectedDate(d => shiftDate(d, 1))}
          className="p-2 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Morning Reflections */}
      {morningFields.length > 0 && (
        <div className="bg-card rounded-xl p-5 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-foreground">Morning Reflection</h2>
          </div>
          <div className="space-y-3">
            {morningFields.map((f) => (
              <div key={f.label}>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{f.label}</p>
                <p className="text-sm text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
          <a href="/process" className="inline-block mt-3 text-xs text-primary hover:underline">
            Edit in Morning Process
          </a>
        </div>
      )}

      {/* Journal Entries Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">
            Journal Entries
            {journalEntries.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({journalEntries.length})
              </span>
            )}
          </h2>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          )}
        </div>

        {/* Add Form */}
        {showAdd && (
          <div className="bg-card rounded-xl p-4 mb-4 space-y-3">
            <textarea
              autoFocus
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full rounded-lg border border-border bg-background text-foreground p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tag (optional)</p>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewTag(newTag === t ? '' : t)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      newTag === t
                        ? TAG_COLORS[t] || 'bg-gray-200 text-gray-700'
                        : 'bg-muted/30 text-muted-foreground hover:bg-border'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <input
                  value={TAG_OPTIONS.includes(newTag) ? '' : newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="custom..."
                  className="text-xs px-2.5 py-1 rounded-full bg-muted/30 text-foreground border-none focus:outline-none focus:ring-1 focus:ring-primary w-20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAdd(false); setNewContent(''); setNewTag(''); }}
                className="text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted/30"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Entries List */}
        {journalEntries.length === 0 && !showAdd ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No journal entries for this date.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Start writing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {journalEntries.map((entry) => (
              <div key={entry.id} className="bg-card rounded-xl p-4">
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    <textarea
                      autoFocus
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background text-foreground p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {TAG_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setEditTag(editTag === t ? '' : t)}
                          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                            editTag === t
                              ? TAG_COLORS[t] || 'bg-gray-200 text-gray-700'
                              : 'bg-muted/30 text-muted-foreground hover:bg-border'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      <input
                        value={TAG_OPTIONS.includes(editTag) ? '' : editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                        placeholder="custom..."
                        className="text-xs px-2.5 py-1 rounded-full bg-muted/30 text-foreground border-none focus:outline-none focus:ring-1 focus:ring-primary w-20"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/30"
                        aria-label="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim()}
                        className="p-1.5 rounded-lg text-primary hover:bg-muted/30 disabled:opacity-50"
                        aria-label="Save edit"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{entry.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {entry.tag && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[entry.tag] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                            {entry.tag}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(entry.created_at)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                          aria-label="Edit entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evening Reflections */}
      {eveningFields.length > 0 && (
        <div className="bg-card rounded-xl p-5 border-l-4 border-indigo-400">
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-foreground">Evening Reflection</h2>
          </div>
          <div className="space-y-3">
            {eveningFields.map((f) => (
              <div key={f.label}>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{f.label}</p>
                <p className="text-sm text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
          <a href="/shutdown" className="inline-block mt-3 text-xs text-primary hover:underline">
            Edit in Shutdown Routine
          </a>
        </div>
      )}

      {/* AI Insights */}
      <div className="pt-2">
        <button
          onClick={handleAiInsights}
          disabled={loadingInsights}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-card text-foreground hover:bg-muted/30 border border-border transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 text-primary ${loadingInsights ? 'motion-safe:animate-pulse' : ''}`} />
          {loadingInsights ? 'Analyzing...' : 'Analyze Recent Entries'}
        </button>

        {insightsError && (
          <div className="mt-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
            {insightsError}
          </div>
        )}

        {aiInsights && (
          <div className="mt-3 bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Insights (Last 14 Days)</h3>
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {aiInsights}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
