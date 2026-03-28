'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, CheckSquare, FolderKanban, BookOpen, Lightbulb,
  ShoppingBag, Book, Film, Tv, Music, Plane, Users,
  ArrowRight, ArrowLeft, Zap, Archive, Sparkles, Loader2, Plus, Undo2
} from 'lucide-react';

interface InboxItem {
  id: string;
  content: string;
  source: string;
  url: string | null;
  captured_at: string;
}

interface Project {
  id: string;
  title: string;
  category: string;
}

interface ContextItem {
  key: string;
  label: string;
}

const FALLBACK_CONTEXTS: ContextItem[] = [
  { key: 'work', label: '@Work' },
  { key: 'errands', label: '@Errands' },
  { key: 'home', label: '@Home' },
  { key: 'waiting_for', label: '@Waiting For' },
  { key: 'agendas', label: '@Agendas' },
  { key: 'calls', label: '@Calls' },
  { key: 'computer', label: '@Computer' },
  { key: 'anywhere', label: '@Anywhere' },
];

const CATEGORIES = [
  'business', 'personal', 'home', 'family', 'health', 'finance', 'learning', 'other'
];

type RouteDestination =
  | { type: 'action'; context: string; projectId?: string }
  | { type: 'project'; category: string; title: string; firstAction: string; context: string }
  | { type: 'reference'; category: string; title: string }
  | { type: 'thinking' }
  | { type: 'list'; listType: string }
  | { type: 'someday' }
  | { type: 'trash' }
  | { type: 'do_now' };

export default function ProcessPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contexts, setContexts] = useState<ContextItem[]>(FALLBACK_CONTEXTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<'actionable' | 'route_action' | 'route_non_action' | 'route_reference' | 'create_project' | 'done' | 'error'>('actionable');

  // Form state for routing
  const [selectedContext, setSelectedContext] = useState('work');
  const [selectedProject, setSelectedProject] = useState('');
  const [actionText, setActionText] = useState('');
  const [waitingPerson, setWaitingPerson] = useState('');

  // New project form
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('personal');
  const [firstAction, setFirstAction] = useState('');
  const [firstActionContext, setFirstActionContext] = useState('work');

  // Reference filing
  const [referenceCategories, setReferenceCategories] = useState<string[]>([]);
  const [selectedRefCategory, setSelectedRefCategory] = useState('');
  const [newRefCategory, setNewRefCategory] = useState('');
  const [showNewRefCategory, setShowNewRefCategory] = useState(false);
  const [refTitle, setRefTitle] = useState('');

  // AI suggestion
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestion?: string; context?: string; project_match?: string; category?: string; two_minute?: boolean; concrete?: boolean; reworded?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  // Undo support
  const [undoEntry, setUndoEntry] = useState<{
    inboxItemId: string;
    createdType: string | null;
    createdId: string | null;
    createdActionId?: string | null;
    previousIndex: number;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [inboxRes, projectsRes, ctxRes] = await Promise.all([
        fetch('/api/inbox'),
        fetch('/api/projects'),
        fetch('/api/context-lists'),
      ]);

      if (!inboxRes.ok || !projectsRes.ok) {
        setStep('error');
        return;
      }

      const inboxData = await inboxRes.json();
      const projectsData = await projectsRes.json();
      setItems(inboxData);
      setProjects(projectsData);

      const ctxData = await ctxRes.json();
      if (Array.isArray(ctxData) && ctxData.length > 0) {
        setContexts(ctxData.map((c: { key: string; name: string }) => ({
          key: c.key,
          label: `@${c.name}`,
        })));
      }

      if (inboxData.length === 0) {
        setStep('done');
      }
    } catch {
      setStep('error');
    }
  }

  const currentItem = items[currentIndex];
  const progress = items.length > 0 ? ((currentIndex) / items.length) * 100 : 100;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (step === 'actionable') {
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); if (currentItem) { setActionText(currentItem.content); setStep('route_action'); } }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setStep('route_non_action'); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); routeItem({ type: 'do_now' }); }
    } else if (step === 'route_action') {
      if (e.key === 'Escape') { e.preventDefault(); setStep('actionable'); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (currentItem) { setNewProjectTitle(currentItem.content); setStep('create_project'); } }
      else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < contexts.length) {
          e.preventDefault();
          routeItem({ type: 'action', context: contexts[idx].key });
        }
      }
    } else if (step === 'route_non_action') {
      if (e.key === 'Escape') { e.preventDefault(); setStep('actionable'); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); routeItem({ type: 'trash' }); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); routeItem({ type: 'someday' }); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setStep('route_reference'); }
    } else if (step === 'route_reference' || step === 'create_project') {
      if (e.key === 'Escape') { e.preventDefault(); setStep(step === 'route_reference' ? 'route_non_action' : 'route_action'); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentItem, contexts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  async function routeItem(destination: RouteDestination) {
    if (!currentItem) return;

    let createdType: string | null = null;
    let createdId: string | null = null;
    let createdActionId: string | null = null;

    switch (destination.type) {
      case 'action': {
        const body: Record<string, string> = {
          content: actionText || currentItem.content,
          context: destination.context,
        };
        if (destination.projectId) body.project_id = destination.projectId;
        if (destination.context === 'waiting_for' && waitingPerson) {
          body.waiting_on_person = waitingPerson;
          body.waiting_since = new Date().toISOString().slice(0, 10);
        }
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        createdType = 'action';
        createdId = created.id;
        break;
      }
      case 'project': {
        const projRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: destination.title,
            category: destination.category,
          }),
        });
        const newProject = await projRes.json();
        createdType = 'project';
        createdId = newProject.id;

        if (destination.firstAction) {
          const actionRes = await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: destination.firstAction,
              context: destination.context,
              project_id: newProject.id,
            }),
          });
          const newAction = await actionRes.json();
          createdActionId = newAction.id;
        }
        break;
      }
      case 'someday': {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentItem.content,
            category: 'personal',
            status: 'someday_maybe',
          }),
        });
        const created = await res.json();
        createdType = 'someday';
        createdId = created.id;
        break;
      }
      case 'list': {
        const res = await fetch('/api/lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentItem.content,
            list_type: destination.listType,
            url: currentItem.url,
          }),
        });
        const created = await res.json();
        createdType = 'list';
        createdId = created.id;
        break;
      }
      case 'reference': {
        const res = await fetch('/api/reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: destination.title,
            category: destination.category,
            content: currentItem.url ? `Source: ${currentItem.url}` : '',
          }),
        });
        const created = await res.json();
        createdType = 'reference';
        createdId = created.id;
        break;
      }
      case 'trash':
      case 'do_now':
        break;
    }

    // Mark inbox item as processed
    await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentItem.id, status: 'processed' }),
    });

    // Save undo entry
    setUndoEntry({
      inboxItemId: currentItem.id,
      createdType,
      createdId,
      createdActionId,
      previousIndex: currentIndex,
    });

    // Move to next item
    resetForms();
    if (currentIndex + 1 >= items.length) {
      setStep('done');
    } else {
      setCurrentIndex(currentIndex + 1);
      setStep('actionable');
    }
  }

  async function undoLastAction() {
    if (!undoEntry || undoing) return;
    setUndoing(true);
    try {
      // Delete created entities
      if (undoEntry.createdActionId) {
        await fetch(`/api/actions?id=${undoEntry.createdActionId}`, { method: 'DELETE' });
      }
      if (undoEntry.createdId) {
        const endpoint = undoEntry.createdType === 'action' ? '/api/actions'
          : undoEntry.createdType === 'project' || undoEntry.createdType === 'someday' ? '/api/projects'
          : undoEntry.createdType === 'reference' ? '/api/reference'
          : undoEntry.createdType === 'list' ? '/api/lists'
          : null;
        if (endpoint) {
          await fetch(`${endpoint}?id=${undoEntry.createdId}`, { method: 'DELETE' });
        }
      }

      // Un-process the inbox item
      await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: undoEntry.inboxItemId, status: 'pending' }),
      });

      // Navigate back
      setCurrentIndex(undoEntry.previousIndex);
      setStep('actionable');
      setUndoEntry(null);
      resetForms();
    } catch {
      // Undo failed — just clear the entry
    }
    setUndoing(false);
  }

  function resetForms() {
    setActionText('');
    setSelectedContext('work');
    setSelectedProject('');
    setWaitingPerson('');
    setNewProjectTitle('');
    setNewProjectCategory('personal');
    setFirstAction('');
    setFirstActionContext('work');
    setSelectedRefCategory('');
    setNewRefCategory('');
    setShowNewRefCategory(false);
    setRefTitle('');
    setAiSuggestion(null);
    setAiError(false);
  }

  async function getAiSuggestion() {
    if (!currentItem) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_inbox', data: { content: currentItem.content } }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      if (data.result) setAiSuggestion(data.result);
      else throw new Error('No result');
    } catch {
      setAiError(true);
    }
    setAiLoading(false);
  }

  if (step === 'error') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-4">&#9888;</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted mb-8">Could not load your inbox. Check your connection and try again.</p>
        <button
          onClick={() => { setStep('actionable'); fetchData(); }}
          className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold mb-2">Inbox Zero</h1>
        <p className="text-muted mb-8">All items processed. Nice work.</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!currentItem) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted mb-2">
          <div className="flex items-center gap-2">
            <span>Processing Inbox</span>
            {undoEntry && (
              <button
                onClick={undoLastAction}
                disabled={undoing}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-border hover:bg-card transition-colors disabled:opacity-50"
              >
                <Undo2 size={12} />
                {undoing ? 'Undoing...' : 'Undo'}
              </button>
            )}
          </div>
          <span>{currentIndex + 1} of {items.length}</span>
        </div>
        <div className="w-full bg-border rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Item */}
      <div className="bg-card rounded-xl p-6 border-2 border-primary mb-6">
        <p className="text-lg font-medium">{currentItem.content}</p>
        {currentItem.url && (
          <a href={currentItem.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 block">
            {currentItem.url}
          </a>
        )}
        <p className="text-xs text-muted mt-2">
          {currentItem.source !== 'manual' && `via ${currentItem.source} · `}
          {new Date(currentItem.captured_at).toLocaleString()}
        </p>
      </div>

      {/* AI Suggestion */}
      {step === 'actionable' && (
        <div className="mb-4">
          {aiSuggestion ? (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm">
              <p className="font-medium text-purple-700 flex items-center gap-1 mb-1"><Sparkles size={14} /> AI Suggestion</p>
              <p className="text-purple-900">{aiSuggestion.suggestion}</p>
              {aiSuggestion.context && <p className="text-xs text-purple-600 mt-1">Context: {aiSuggestion.context}</p>}
              {aiSuggestion.project_match && <p className="text-xs text-purple-600">Project: {aiSuggestion.project_match}</p>}
              {aiSuggestion.two_minute && <p className="text-xs text-amber-600 font-medium mt-1">2-minute rule — just do it now!</p>}
              {aiSuggestion.concrete === false && aiSuggestion.reworded && (
                <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">This action seems vague. Try:</p>
                  <p className="text-sm text-amber-900 mt-0.5">{aiSuggestion.reworded}</p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={getAiSuggestion}
              disabled={aiLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-50 transition-colors ${aiError ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-purple-600 border-purple-200 hover:bg-purple-50'}`}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiError ? 'AI unavailable — retry?' : 'AI suggest routing'}
            </button>
          )}
        </div>
      )}

      {/* Step 1: Is it actionable? */}
      {step === 'actionable' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Is this actionable?</h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setActionText(currentItem.content);
                setStep('route_action');
              }}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left"
            >
              <Zap size={20} className="text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Yes, actionable <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">Y</kbd></p>
                <p className="text-xs text-muted">Route to a context list or project</p>
              </div>
            </button>

            <button
              onClick={() => setStep('route_non_action')}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left"
            >
              <Archive size={20} className="text-muted shrink-0" />
              <div>
                <p className="font-medium text-sm">No, not actionable <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">N</kbd></p>
                <p className="text-xs text-muted">Reference, idea, list, or trash</p>
              </div>
            </button>
          </div>

          <button
            onClick={() => routeItem({ type: 'do_now' })}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/30 hover:border-accent transition-colors text-left"
          >
            <ArrowRight size={20} className="text-accent shrink-0" />
            <div>
              <p className="font-medium text-sm">Under 2 minutes — do it now <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">D</kbd></p>
              <p className="text-xs text-muted">Handle it and move on</p>
            </div>
          </button>
        </div>
      )}

      {/* Step 2a: Route actionable item */}
      {step === 'route_action' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('actionable')} className="p-1 rounded hover:bg-card">
              <ArrowLeft size={18} />
            </button>
            <h2 className="font-semibold text-lg">Route this action</h2>
          </div>

          {/* Refine action text */}
          <div>
            <label className="text-xs text-muted block mb-1">Action (make it concrete and physical)</label>
            <input
              type="text"
              value={actionText}
              onChange={e => setActionText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Single action or multi-step? */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} className="text-primary" />
                <p className="font-medium text-sm">Single action</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {contexts.map((ctx, idx) => (
                  <button
                    key={ctx.key}
                    onClick={() => {
                      setSelectedContext(ctx.key);
                      if (ctx.key !== 'waiting_for') {
                        routeItem({ type: 'action', context: ctx.key, projectId: selectedProject || undefined });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedContext === ctx.key ? 'bg-primary text-white' : 'bg-background hover:bg-primary/10'
                    }`}
                  >
                    {ctx.label} <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono ml-0.5">{idx + 1}</kbd>
                  </button>
                ))}
              </div>

              {selectedContext === 'waiting_for' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={waitingPerson}
                    onChange={e => setWaitingPerson(e.target.value)}
                    placeholder="Who are you waiting on?"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => routeItem({ type: 'action', context: 'waiting_for' })}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs"
                  >
                    Add to @Waiting For
                  </button>
                </div>
              )}

              {/* Optional: link to existing project */}
              {projects.length > 0 && (
                <div>
                  <label className="text-xs text-muted block mb-1">Link to project (optional)</label>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none"
                  >
                    <option value="">None</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.category}: {p.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setNewProjectTitle(currentItem.content);
                setStep('create_project');
              }}
              className="flex flex-col items-start gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FolderKanban size={18} className="text-purple-600" />
                <p className="font-medium text-sm">Multi-step project</p>
              </div>
              <p className="text-xs text-muted">Create a project and define the first next action</p>
            </button>
          </div>
        </div>
      )}

      {/* Step 2b: Route non-actionable item */}
      {step === 'route_non_action' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('actionable')} className="p-1 rounded hover:bg-card">
              <ArrowLeft size={18} />
            </button>
            <h2 className="font-semibold text-lg">Where does this belong?</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => routeItem({ type: 'trash' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-danger/50 transition-colors text-left">
              <Trash2 size={18} className="text-danger" />
              <div>
                <p className="text-sm font-medium">Trash <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">T</kbd></p>
                <p className="text-xs text-muted">Delete it</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'someday' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Archive size={18} className="text-muted" />
              <div>
                <p className="text-sm font-medium">Someday/Maybe <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">S</kbd></p>
                <p className="text-xs text-muted">Not now, but maybe later</p>
              </div>
            </button>

            <button
              onClick={async () => {
                setRefTitle(currentItem.content);
                try {
                  const res = await fetch('/api/reference?categories=true');
                  const cats = await res.json();
                  setReferenceCategories(cats);
                } catch { /* offline — will use empty list */ }
                setStep('route_reference');
              }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left"
            >
              <BookOpen size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-medium">Reference <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-muted font-mono ml-1">R</kbd></p>
                <p className="text-xs text-muted">File for later lookup</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'wish_list' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <ShoppingBag size={18} className="text-pink-600" />
              <div>
                <p className="text-sm font-medium">Wish List</p>
                <p className="text-xs text-muted">Something to buy</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'reading' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Book size={18} className="text-blue-600" />
              <div>
                <p className="text-sm font-medium">Reading List</p>
                <p className="text-xs text-muted">Book to read</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'movies' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Film size={18} className="text-red-600" />
              <div>
                <p className="text-sm font-medium">Movie</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'shows' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Tv size={18} className="text-purple-600" />
              <div>
                <p className="text-sm font-medium">Show</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'albums' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Music size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-medium">Album</p>
              </div>
            </button>

            <button onClick={() => routeItem({ type: 'list', listType: 'travel' })} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left">
              <Plane size={18} className="text-blue-600" />
              <div>
                <p className="text-sm font-medium">Travel Idea</p>
              </div>
            </button>

          </div>
        </div>
      )}

      {/* Step 2c: File as reference */}
      {step === 'route_reference' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('route_non_action')} className="p-1 rounded hover:bg-card">
              <ArrowLeft size={18} />
            </button>
            <h2 className="font-semibold text-lg">File as Reference</h2>
          </div>

          <div className="p-4 bg-card rounded-xl border border-border space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Title</label>
              <input
                type="text"
                value={refTitle}
                onChange={e => setRefTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Category</label>
              {referenceCategories.length > 0 && !showNewRefCategory && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {referenceCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedRefCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedRefCategory === cat ? 'bg-green-600 text-white' : 'bg-background hover:bg-green-50 border border-border'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {!showNewRefCategory ? (
                <button
                  onClick={() => {
                    setShowNewRefCategory(true);
                    setSelectedRefCategory('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-700 border border-green-200 hover:bg-green-50 transition-colors"
                >
                  <Plus size={12} /> New category
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newRefCategory}
                    onChange={e => setNewRefCategory(e.target.value)}
                    placeholder="Type new category name..."
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                  {referenceCategories.length > 0 && (
                    <button
                      onClick={() => {
                        setShowNewRefCategory(false);
                        setNewRefCategory('');
                      }}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel — pick existing
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const category = showNewRefCategory ? newRefCategory.trim() : selectedRefCategory;
                if (!category || !refTitle.trim()) return;
                routeItem({ type: 'reference', category, title: refTitle.trim() });
              }}
              disabled={!refTitle.trim() || !(showNewRefCategory ? newRefCategory.trim() : selectedRefCategory)}
              className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              File Reference
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Create new project */}
      {step === 'create_project' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('route_action')} className="p-1 rounded hover:bg-card">
              <ArrowLeft size={18} />
            </button>
            <h2 className="font-semibold text-lg">Create Project</h2>
          </div>

          <div className="p-4 bg-card rounded-xl border border-border space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Project name (done-state)</label>
              <input
                type="text"
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                placeholder="e.g., ZGC engaged as client"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Category</label>
              <select
                value={newProjectCategory}
                onChange={e => setNewProjectCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">First next action (every project needs one)</label>
              <input
                type="text"
                value={firstAction}
                onChange={e => setFirstAction(e.target.value)}
                placeholder="Concrete, physical, visible action..."
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Context for first action</label>
              <div className="flex flex-wrap gap-2">
                {contexts.map(ctx => (
                  <button
                    key={ctx.key}
                    onClick={() => setFirstActionContext(ctx.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      firstActionContext === ctx.key ? 'bg-primary text-white' : 'bg-background hover:bg-primary/10'
                    }`}
                  >
                    {ctx.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => routeItem({
                type: 'project',
                title: newProjectTitle,
                category: newProjectCategory,
                firstAction,
                context: firstActionContext,
              })}
              disabled={!newProjectTitle.trim() || !firstAction.trim()}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Create Project & Action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
