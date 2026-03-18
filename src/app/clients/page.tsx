'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Plus, Trash2, FileText, Loader2, MessageSquare, Send, X, ChevronLeft } from 'lucide-react';

interface ClientNote {
  id: string;
  client_name: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface PipelineContact {
  id: string;
  name: string;
  contact_type: string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupByMonth(notes: ClientNote[]): Record<string, ClientNote[]> {
  const groups: Record<string, ClientNote[]> = {};
  for (const note of notes) {
    const key = note.date.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }
  return groups;
}

export default function ClientsPage() {
  const [dbClients, setDbClients] = useState<string[]>([]);
  const [manualClients, setManualClients] = useState<Set<string>>(new Set());
  const clients = useMemo(() => {
    return Array.from(new Set([...dbClients, ...manualClients])).sort();
  }, [dbClients, manualClients]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [noteDate, setNoteDate] = useState(todayStr());
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<string | null>(null);

  // AI state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const aiInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = useCallback(async () => {
    try {
      const pipelineRes = await fetch('/api/pipeline');
      const pipelineData = await pipelineRes.json();
      const pipelineNames: string[] = (pipelineData.contacts || [])
        .filter((c: PipelineContact) => c.contact_type === 'active_client' || c.contact_type === 'past_client')
        .map((c: PipelineContact) => c.name);

      const notesRes = await fetch('/api/client-notes');
      const notesData = await notesRes.json();
      const noteNames: string[] = (notesData || []).map((c: { client_name: string }) => c.client_name);

      const allNames = Array.from(new Set([...pipelineNames, ...noteNames])).sort();
      setDbClients(allNames);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchNotes = useCallback(async (clientName: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/client-notes?client=${encodeURIComponent(clientName)}`);
      const data = await res.json();
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  function selectClient(name: string) {
    setSelectedClient(name);
    setDeleteConfirm(null);
    setDeleteClientConfirm(null);
    setAiOpen(false);
    setAiResponse('');
    fetchNotes(name);
  }

  function addNewClient() {
    const name = newClientName.trim();
    if (!name) return;
    if (!clients.includes(name)) {
      setManualClients(prev => new Set([...prev, name]));
    }
    setNewClientName('');
    selectClient(name);
  }

  async function deleteClient(name: string) {
    try {
      await fetch(`/api/client-notes?client=${encodeURIComponent(name)}`, { method: 'DELETE' });
      setDeleteClientConfirm(null);
      setManualClients(prev => { const next = new Set(prev); next.delete(name); return next; });
      if (selectedClient === name) {
        setSelectedClient(null);
        setNotes([]);
      }
      await fetchClients();
    } catch {
      // ignore
    }
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !noteContent.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/client-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: selectedClient,
          date: noteDate,
          content: noteContent.trim(),
        }),
      });
      setNoteContent('');
      setNoteDate(todayStr());
      await fetchNotes(selectedClient);
      await fetchClients();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    if (!selectedClient) return;
    try {
      await fetch(`/api/client-notes?id=${id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      await fetchNotes(selectedClient);
      await fetchClients();
    } catch {
      // ignore
    }
  }

  async function askAI(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !aiQuestion.trim()) return;
    setAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'client_notes',
          data: { client_name: selectedClient, question: aiQuestion.trim() },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAiResponse(data.error);
      } else {
        setAiResponse(data.response);
      }
    } catch {
      setAiResponse('Failed to get AI response.');
    } finally {
      setAiLoading(false);
      setAiQuestion('');
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const grouped = groupByMonth(notes);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Users size={24} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Client Notes</h1>
          <p className="text-sm text-muted">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left panel — client list */}
        <div className={`w-full md:w-64 md:flex-shrink-0 ${selectedClient ? 'hidden md:block' : ''}`}>
          <div className="bg-card rounded-xl border border-border p-4">
            {/* Add new client */}
            <div className="flex items-center gap-2 mb-4">
              <input
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNewClient()}
                placeholder="New client name..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={addNewClient}
                disabled={!newClientName.trim()}
                className="flex-shrink-0 p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Client list */}
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {clients.length === 0 && (
                <p className="text-sm text-muted text-center py-4">No clients yet</p>
              )}
              {clients.map(name => (
                <div key={name} className="group relative flex items-center">
                  <button
                    onClick={() => selectClient(name)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedClient === name
                        ? 'bg-primary text-white font-medium'
                        : 'text-foreground hover:bg-background'
                    }`}
                  >
                    {name}
                  </button>
                  {/* Delete client button — shows on hover */}
                  {deleteClientConfirm === name ? (
                    <div className="absolute right-0 flex items-center gap-1 bg-card border border-border rounded-lg p-1 shadow-lg z-10">
                      <button
                        onClick={() => deleteClient(name)}
                        className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors whitespace-nowrap"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteClientConfirm(null)}
                        className="px-2 py-1 rounded text-xs text-muted hover:text-foreground transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteClientConfirm(name); }}
                      className={`absolute right-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                        selectedClient === name
                          ? 'hover:bg-white/20 text-white/70 hover:text-white'
                          : 'hover:bg-red-50 text-muted hover:text-red-600'
                      }`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — notes */}
        <div className={`flex-1 min-w-0 ${!selectedClient ? 'hidden md:block' : ''}`}>
          {!selectedClient ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <FileText size={32} className="mx-auto text-muted mb-3" />
              <p className="text-muted">Select a client to view notes</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedClient(null); setAiOpen(false); setAiResponse(''); }}
                    className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-lg font-semibold">{selectedClient}</h2>
                </div>
                <button
                  onClick={() => { setAiOpen(!aiOpen); setAiResponse(''); setTimeout(() => aiInputRef.current?.focus(), 100); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    aiOpen
                      ? 'bg-primary text-white'
                      : 'bg-card border border-border text-muted hover:text-foreground hover:border-primary/50'
                  }`}
                >
                  <MessageSquare size={14} />
                  Ask AI
                </button>
              </div>

              {/* AI Panel */}
              {aiOpen && (
                <div className="bg-card rounded-xl border border-primary/30 p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Ask about {selectedClient}&apos;s notes</p>
                    <button onClick={() => { setAiOpen(false); setAiResponse(''); }} className="text-muted hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <form onSubmit={askAI} className="flex gap-2 mb-3">
                    <input
                      ref={aiInputRef}
                      value={aiQuestion}
                      onChange={e => setAiQuestion(e.target.value)}
                      placeholder="e.g. &quot;What did we discuss last month?&quot; or &quot;What action items are pending?&quot;"
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={aiLoading}
                    />
                    <button
                      type="submit"
                      disabled={aiLoading || !aiQuestion.trim()}
                      className="flex-shrink-0 p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['Summarize our relationship', 'What action items are pending?', 'Key decisions made', 'Timeline of interactions'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setAiQuestion(q); }}
                        className="px-2.5 py-1 rounded-full bg-background border border-border text-xs text-muted hover:text-foreground hover:border-primary/50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  {aiResponse && (
                    <div className="p-3 rounded-lg bg-background border border-border text-sm whitespace-pre-wrap">
                      {aiResponse}
                    </div>
                  )}
                </div>
              )}

              {/* Add note form */}
              <form onSubmit={saveNote} className="bg-card rounded-xl border border-border p-4 mb-6 space-y-3">
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={noteDate}
                    onChange={e => setNoteDate(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="submit"
                    disabled={saving || !noteContent.trim()}
                    className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add Note
                  </button>
                </div>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Write a note about this client..."
                  className="w-full min-h-[100px] px-4 py-2.5 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </form>

              {/* Notes list */}
              {notesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-12 text-muted">
                  No notes yet for {selectedClient}. Add your first note above.
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedMonths.map(month => (
                    <div key={month}>
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                        {formatMonth(month)}
                      </h3>
                      <div className="space-y-2">
                        {grouped[month].map(note => (
                          <div key={note.id} className="p-4 rounded-xl bg-card border border-border">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted mb-1">{note.date}</p>
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              </div>
                              <div className="ml-3 flex-shrink-0">
                                {deleteConfirm === note.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => deleteNote(note.id)}
                                      className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="px-2 py-1 rounded text-xs text-muted hover:text-foreground transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(note.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
