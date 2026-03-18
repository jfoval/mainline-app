'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Check, Trash2 } from 'lucide-react';
import { Suspense } from 'react';
import { useOfflineStore, nextActionsStore } from '@/lib/offline';

const CONTEXTS = [
  { key: 'work', label: '@Work', color: 'bg-blue-100 text-blue-700' },
  { key: 'errands', label: '@Errands', color: 'bg-green-100 text-green-700' },
  { key: 'home', label: '@Home', color: 'bg-orange-100 text-orange-700' },
  { key: 'waiting_for', label: '@Waiting For', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'agendas', label: '@Agendas', color: 'bg-purple-100 text-purple-700' },
  { key: 'haley', label: '@Haley', color: 'bg-pink-100 text-pink-700' },
  { key: 'prayers', label: '@Prayers', color: 'bg-indigo-100 text-indigo-700' },
];

function ActionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeContext = searchParams.get('context') || 'work';

  const { data: actions, create, update, remove } = useOfflineStore(
    nextActionsStore,
    { context: activeContext, status: 'active' }
  );
  const [newAction, setNewAction] = useState('');
  const [showAdd, setShowAdd] = useState(false);
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
    await update({ id, status: 'completed' });
  }

  async function deleteAction(id: string) {
    await remove(id);
  }

  const contextInfo = CONTEXTS.find(c => c.key === activeContext)!;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Next Actions</h1>
          <p className="text-sm text-muted mt-1">{actions.length} active items</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          <Plus size={18} />
          Add Action
        </button>
      </div>

      {/* Context Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {CONTEXTS.map(ctx => (
          <button
            key={ctx.key}
            onClick={() => router.push(`/actions?context=${ctx.key}`)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeContext === ctx.key
                ? ctx.color
                : 'bg-card text-muted hover:bg-primary/5'
            }`}
          >
            {ctx.label}
          </button>
        ))}
      </div>

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
              Add to {contextInfo.label}
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
      {actions.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg font-medium">No items in {contextInfo.label}</p>
          <p className="text-sm mt-1">Add an action or process your inbox.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map(action => (
            <div
              key={action.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border group hover:border-primary/30 transition-colors"
            >
              <button
                onClick={() => completeAction(action.id)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-muted/40 hover:border-success hover:bg-success/10 transition-colors flex-shrink-0 flex items-center justify-center"
              >
                <Check size={12} className="text-transparent group-hover:text-success/50" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{action.content}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {action.project_title && (
                    <span className="text-xs text-primary">
                      {action.project_title}
                    </span>
                  )}
                  {action.waiting_on_person && (
                    <span className="text-xs text-muted">
                      Waiting on: {action.waiting_on_person}
                      {action.waiting_since && ` (since ${action.waiting_since})`}
                    </span>
                  )}
                  {action.agenda_person && (
                    <span className="text-xs text-muted">
                      For: {action.agenda_person}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    Added: {new Date(action.added_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteAction(action.id)}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-danger transition-all"
              >
                <Trash2 size={14} />
              </button>
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
