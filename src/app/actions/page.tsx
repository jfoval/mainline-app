'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Check, Trash2, Search, GripVertical, Settings, X, Pencil } from 'lucide-react';
import { Suspense } from 'react';
import { useOfflineStore, nextActionsStore, type NextAction } from '@/lib/offline';
import { useUndoableAction, useToast } from '@/lib/toast';
import { useHotkeys } from '@/hooks/useGlobalHotkeys';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { todayStr } from '@/lib/date-utils';

interface ContextItem {
  id?: string;
  key: string;
  name: string;
  color: string | null;
  action_count?: number;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const COLOR_OPTIONS = Object.keys(COLOR_MAP);

function getColorClasses(color: string | null): string {
  return COLOR_MAP[color || 'gray'] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function SortableActionItem({ action, onComplete, onDelete }: { action: NextAction; onComplete: (id: string) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-4 rounded-xl bg-card border border-border group hover:border-primary/30 transition-colors">
      <button {...attributes} {...listeners} aria-label="Drag to reorder" className="mt-1 cursor-grab active:cursor-grabbing text-muted/40 hover:text-muted touch-none">
        <GripVertical size={14} />
      </button>
      <button
        onClick={() => onComplete(action.id)}
        aria-label="Complete action"
        className="mt-0.5 w-5 h-5 rounded border-2 border-muted/40 hover:border-success hover:bg-success/10 transition-colors flex-shrink-0 flex items-center justify-center"
      >
        <Check size={12} className="text-transparent group-hover:text-success/50" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{action.content}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {action.project_title && <span className="text-xs text-primary">{action.project_title}</span>}
          {action.waiting_on_person && (
            <span className="text-xs text-muted">
              Waiting on: {action.waiting_on_person}{action.waiting_since && ` (since ${action.waiting_since})`}
            </span>
          )}
          {action.agenda_person && <span className="text-xs text-muted">For: {action.agenda_person}</span>}
          <span className="text-xs text-muted">Added: {new Date(action.added_at).toLocaleDateString()}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(action.id)}
        aria-label="Delete action"
        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-danger/10 text-danger transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ActionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeContext = searchParams.get('context') || 'work';

  const [contexts, setContexts] = useState<ContextItem[]>(() => [
    { key: 'work', name: 'Work', color: 'blue' },
    { key: 'errands', name: 'Errands', color: 'green' },
    { key: 'home', name: 'Home', color: 'orange' },
    { key: 'waiting_for', name: 'Waiting For', color: 'yellow' },
    { key: 'agendas', name: 'Agendas', color: 'purple' },
    { key: 'calls', name: 'Calls', color: 'teal' },
    { key: 'computer', name: 'Computer', color: 'gray' },
    { key: 'anywhere', name: 'Anywhere', color: 'indigo' },
  ]);
  const [showContextManager, setShowContextManager] = useState(false);
  const [newContextName, setNewContextName] = useState('');
  const [newContextColor, setNewContextColor] = useState('gray');
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [editContextName, setEditContextName] = useState('');
  const [editContextColor, setEditContextColor] = useState('gray');

  async function fetchContexts() {
    try {
      const res = await fetch('/api/context-lists?counts=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setContexts(data.map((c: { id: string; key: string; name: string; color: string | null; action_count?: number }) => ({
            id: c.id,
            key: c.key,
            name: c.name,
            color: c.color,
            action_count: Number(c.action_count) || 0,
          })));
          return;
        }
      }
    } catch { /* fall through to defaults */ }
    setContexts([
      { key: 'work', name: 'Work', color: 'blue' },
      { key: 'errands', name: 'Errands', color: 'green' },
      { key: 'home', name: 'Home', color: 'orange' },
      { key: 'waiting_for', name: 'Waiting For', color: 'yellow' },
      { key: 'agendas', name: 'Agendas', color: 'purple' },
      { key: 'calls', name: 'Calls', color: 'teal' },
      { key: 'computer', name: 'Computer', color: 'gray' },
      { key: 'anywhere', name: 'Anywhere', color: 'indigo' },
    ]);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState is inside async callback, not synchronous
  useEffect(() => { fetchContexts(); }, []);

  // 1-9 hotkeys to switch context tabs
  const contextHotkeys = useMemo(() => {
    const map: Record<string, () => void> = {};
    contexts.forEach((ctx, i) => {
      if (i < 9) {
        map[String(i + 1)] = () => router.push(`/actions?context=${ctx.key}`);
      }
    });
    return map;
  }, [contexts, router]);
  useHotkeys(contextHotkeys);

  const [viewMode, setViewMode] = useState<'active' | 'completed'>('active');
  const { data: actions, create, update, remove } = useOfflineStore(
    nextActionsStore,
    { context: activeContext, status: viewMode }
  );
  const { pendingDeletes } = useToast();
  const { undoableDelete, undoableStatusChange } = useUndoableAction();
  const [newAction, setNewAction] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const visibleActions = actions.filter(a => !pendingDeletes.has(a.id));
  const filteredActions = search.trim()
    ? visibleActions.filter(a => a.content.toLowerCase().includes(search.toLowerCase()))
    : visibleActions;
  const [waitingPerson, setWaitingPerson] = useState('');
  const [agendaPerson, setAgendaPerson] = useState('');

  async function addAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newAction.trim()) return;

    const body: Record<string, string> = {
      content: newAction.trim(),
      context: activeContext,
    };

    if (activeContext === 'waiting_for' && waitingPerson) {
      body.waiting_on_person = waitingPerson;
      body.waiting_since = todayStr();
    }
    if (activeContext === 'agendas' && agendaPerson) {
      body.agenda_person = agendaPerson;
    }

    await create(body);
    setNewAction('');
    setWaitingPerson('');
    setAgendaPerson('');
    setShowAdd(false);
  }

  async function completeAction(id: string) {
    await undoableStatusChange(id, 'completed', 'active', update, 'Action completed');
  }

  function deleteAction(id: string) {
    undoableDelete(id, remove, 'Action deleted');
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredActions.findIndex(a => a.id === active.id);
    const newIndex = filteredActions.findIndex(a => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredActions, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await update({ id: reordered[i].id, sort_order: i });
      }
    }
  }

  // Context management handlers
  async function addContext() {
    if (!newContextName.trim()) return;
    const key = newContextName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (!key) return;
    if (contexts.some(c => c.key === key)) return;

    await fetch('/api/context-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newContextName.trim(), key, color: newContextColor }),
    });
    setNewContextName('');
    setNewContextColor('gray');
    fetchContexts();
  }

  async function saveEditContext() {
    if (!editingContextId || !editContextName.trim()) return;
    await fetch('/api/context-lists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingContextId, name: editContextName.trim(), color: editContextColor }),
    });
    setEditingContextId(null);
    fetchContexts();
  }

  async function deleteContext(ctx: ContextItem) {
    if (!ctx.id) return;
    await fetch(`/api/context-lists?id=${ctx.id}`, { method: 'DELETE' });
    fetchContexts();
    if (activeContext === ctx.key && contexts.length > 1) {
      const remaining = contexts.filter(c => c.id !== ctx.id);
      if (remaining.length > 0) router.push(`/actions?context=${remaining[0].key}`);
    }
  }

  const contextInfo = contexts.find(c => c.key === activeContext) || { key: activeContext, name: activeContext, color: 'gray' };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Next Actions</h1>
          <p className="text-sm text-muted mt-1">{actions.length} {viewMode} items</p>
        </div>
        {viewMode === 'active' && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <Plus size={18} />
            Add Action
          </button>
        )}
      </div>

      {/* Active / Completed toggle */}
      <div className="flex gap-1 mb-4 bg-card rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setViewMode('active')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'active' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
        >
          Active
        </button>
        <button
          onClick={() => setViewMode('completed')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'completed' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
        >
          Completed
        </button>
      </div>

      {/* Context Tabs */}
      <div className="relative mb-4">
        <div className="flex gap-2 overflow-x-auto md:overflow-visible md:flex-wrap pb-2 scrollbar-hide scroll-smooth items-center" style={{ WebkitOverflowScrolling: 'touch' }}>
          {contexts.map((ctx, idx) => (
            <button
              key={ctx.key}
              onClick={() => router.push(`/actions?context=${ctx.key}`)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 md:flex-shrink flex items-center gap-1.5 ${
                activeContext === ctx.key
                  ? getColorClasses(ctx.color)
                  : 'bg-card text-muted hover:bg-primary/5'
              }`}
            >
              @{ctx.name}
              {ctx.action_count ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[1.25rem] text-center ${
                  activeContext === ctx.key ? 'bg-black/15 dark:bg-white/20' : 'bg-primary/15 text-primary'
                }`}>
                  {ctx.action_count}
                </span>
              ) : null}
              {idx < 9 && (
                <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 leading-none opacity-40">
                  {idx + 1}
                </kbd>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowContextManager(!showContextManager)}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              showContextManager ? 'bg-primary/10 text-primary' : 'text-muted hover:text-foreground hover:bg-primary/5'
            }`}
            title="Manage contexts"
            aria-label="Manage contexts"
          >
            <Settings size={16} />
          </button>
        </div>
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
      </div>

      {/* Context Manager Panel */}
      {showContextManager && (
        <div className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Manage Contexts</h3>
            <button onClick={() => { setShowContextManager(false); setEditingContextId(null); }} className="p-1 text-muted hover:text-foreground" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {/* Existing contexts */}
          <div className="space-y-2">
            {contexts.map(ctx => (
              <div key={ctx.key} className="flex items-center gap-2">
                {editingContextId === ctx.id ? (
                  <>
                    <input
                      type="text"
                      value={editContextName}
                      onChange={e => setEditContextName(e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEditContext(); if (e.key === 'Escape') setEditingContextId(null); }}
                    />
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditContextColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${editContextColor === c ? 'border-foreground' : 'border-transparent'} ${COLOR_MAP[c].split(' ')[0]}`}
                          title={c}
                          aria-label={`Color: ${c}`}
                        />
                      ))}
                    </div>
                    <button onClick={saveEditContext} className="p-1 text-green-600 hover:bg-green-50 rounded" aria-label="Save">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingContextId(null)} className="p-1 text-muted hover:bg-card rounded" aria-label="Cancel">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_MAP[ctx.color || 'gray']?.split(' ')[0] || 'bg-gray-100'}`} />
                    <span className="flex-1 text-sm">@{ctx.name}</span>
                    <button
                      onClick={() => { setEditingContextId(ctx.id || null); setEditContextName(ctx.name); setEditContextColor(ctx.color || 'gray'); }}
                      className="p-1 text-muted hover:text-foreground rounded"
                      aria-label="Edit context"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteContext(ctx)}
                      className="p-1 text-muted hover:text-red-600 rounded"
                      aria-label="Delete context"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new context */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs text-muted font-medium">Add new context</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newContextName}
                onChange={e => setNewContextName(e.target.value)}
                placeholder="Context name..."
                className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={e => { if (e.key === 'Enter') addContext(); }}
              />
              <div className="flex gap-1">
                {COLOR_OPTIONS.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setNewContextColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${newContextColor === c ? 'border-foreground' : 'border-transparent'} ${COLOR_MAP[c].split(' ')[0]}`}
                    title={c}
                    aria-label={`Color: ${c}`}
                  />
                ))}
              </div>
              <button
                onClick={addContext}
                disabled={!newContextName.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs disabled:opacity-30"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {actions.length > 3 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actions..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      )}

      {/* Add Action Form */}
      {showAdd && (
        <form onSubmit={addAction} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
          <input
            type="text"
            value={newAction}
            onChange={e => setNewAction(e.target.value)}
            placeholder="Concrete, physical, visible action..."
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          {activeContext === 'waiting_for' && (
            <input
              type="text"
              value={waitingPerson}
              onChange={e => setWaitingPerson(e.target.value)}
              placeholder="Who are you waiting on?"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
          {activeContext === 'agendas' && (
            <input
              type="text"
              value={agendaPerson}
              onChange={e => setAgendaPerson(e.target.value)}
              placeholder="Who is this agenda item for?"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm"
            >
              Add to @{contextInfo.name}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg bg-background text-muted hover:text-foreground transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Actions List */}
      {filteredActions.length === 0 ? (
        <div className="text-center py-12 text-muted">
          {search ? (
            <>
              <p className="text-lg font-medium">No matches</p>
              <p className="text-sm mt-1">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No items in @{contextInfo.name}</p>
              <p className="text-sm mt-1">Add an action or process your inbox.</p>
            </>
          )}
        </div>
      ) : viewMode === 'active' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredActions.map(a => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {filteredActions.map(action => (
                <SortableActionItem key={action.id} action={action} onComplete={completeAction} onDelete={deleteAction} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {filteredActions.map(action => (
            <div
              key={action.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border"
            >
              <div className="mt-0.5 w-5 h-5 rounded bg-success/20 flex-shrink-0 flex items-center justify-center">
                <Check size={12} className="text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted line-through">{action.content}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {action.project_title && <span className="text-xs text-primary">{action.project_title}</span>}
                  <span className="text-xs text-muted">
                    {action.completed_at ? `Completed: ${new Date(action.completed_at).toLocaleDateString()}` : `Added: ${new Date(action.added_at).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto"><h1 className="text-2xl font-bold">Next Actions</h1></div>}>
      <ActionsContent />
    </Suspense>
  );
}
