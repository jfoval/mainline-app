'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Check, Trash2, Search, GripVertical } from 'lucide-react';
import { Suspense } from 'react';
import { useOfflineStore, nextActionsStore, type NextAction } from '@/lib/offline';
import { useUndoableAction, useToast } from '@/lib/toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ContextItem {
  key: string;
  name: string;
  color: string | null;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  orange: 'bg-orange-100 text-orange-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  purple: 'bg-purple-100 text-purple-700',
  teal: 'bg-teal-100 text-teal-700',
  gray: 'bg-gray-100 text-gray-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  red: 'bg-red-100 text-red-700',
  pink: 'bg-pink-100 text-pink-700',
};

function getColorClasses(color: string | null): string {
  return COLOR_MAP[color || 'gray'] || 'bg-gray-100 text-gray-700';
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
        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-danger transition-all"
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

  const [contexts, setContexts] = useState<ContextItem[]>([]);

  useEffect(() => {
    fetch('/api/context-lists')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setContexts(data.map((c: { key: string; name: string; color: string | null }) => ({
            key: c.key,
            name: c.name,
            color: c.color,
          })));
        } else {
          // Fallback defaults if API fails or no contexts configured
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
      })
      .catch(() => {});
  }, []);

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
      body.waiting_since = new Date().toISOString().slice(0, 10);
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
    // Update sort_order for all affected items
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await update({ id: reordered[i].id, sort_order: i });
      }
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
      <div className="relative mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
          {contexts.map(ctx => (
            <button
              key={ctx.key}
              onClick={() => router.push(`/actions?context=${ctx.key}`)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeContext === ctx.key
                  ? getColorClasses(ctx.color)
                  : 'bg-card text-muted hover:bg-primary/5'
              }`}
            >
              @{ctx.name}
            </button>
          ))}
        </div>
        {/* Right fade to hint at scrollable content */}
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>

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
