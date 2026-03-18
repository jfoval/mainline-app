'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Check, Trash2, AlertTriangle, Archive } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  category: string;
  purpose: string;
  key_milestones: string;
  planning_steps: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface NextAction {
  id: string;
  content: string;
  context: string;
  status: string;
  added_at: string;
  completed_at: string | null;
}

const CONTEXTS = [
  { key: 'work', label: '@Work' },
  { key: 'errands', label: '@Errands' },
  { key: 'home', label: '@Home' },
  { key: 'waiting_for', label: '@Waiting For' },
  { key: 'agendas', label: '@Agendas' },
  { key: 'haley', label: '@Haley' },
  { key: 'prayers', label: '@Prayers' },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [actions, setActions] = useState<NextAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Add action form
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newContext, setNewContext] = useState('work');

  useEffect(() => {
    fetchProject();
  }, [id]);

  async function fetchProject() {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setProject(data.project);
    setActions(data.actions);
  }

  async function saveProject() {
    if (!project) return;
    setSaving(true);
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: project.title,
        purpose: project.purpose,
        key_milestones: project.key_milestones,
        planning_steps: project.planning_steps,
        notes: project.notes,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newAction.trim()) return;

    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: newAction.trim(),
        context: newContext,
        project_id: id,
      }),
    });

    setNewAction('');
    setShowAdd(false);
    fetchProject();
  }

  async function completeAction(actionId: string) {
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: actionId, status: 'completed' }),
    });
    fetchProject();
  }

  async function deleteAction(actionId: string) {
    await fetch(`/api/actions?id=${actionId}`, { method: 'DELETE' });
    fetchProject();
  }

  async function archiveProject() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    router.push('/projects');
  }

  if (!project) return null;

  const activeActions = actions.filter(a => a.status === 'active');
  const completedActions = actions.filter(a => a.status === 'completed');

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/projects')} className="p-2 rounded-lg hover:bg-card">
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">{project.category}</p>
            <h1 className="text-2xl font-bold">{project.title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={archiveProject}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border border-border hover:bg-muted/10 text-muted transition-colors"
          >
            <Archive size={16} />
            Archive
          </button>
          <button
            onClick={saveProject}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
              saved ? 'bg-success/10 text-success' : 'bg-primary text-white hover:bg-primary-hover'
            }`}
          >
            <Save size={16} />
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stalled Warning */}
      {activeActions.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
          <AlertTriangle size={20} className="text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">This project is stalled</p>
            <p className="text-xs text-red-600">Every active project needs at least one next action. Add one below.</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Purpose */}
        <section className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-semibold mb-2">Purpose / Desired Outcome</h2>
          <textarea
            value={project.purpose || ''}
            onChange={e => setProject({ ...project, purpose: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
            placeholder="What does 'done' look like?"
          />
        </section>

        {/* Key Milestones */}
        <section className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-semibold mb-2">Key Milestones</h2>
          <textarea
            value={project.key_milestones || ''}
            onChange={e => setProject({ ...project, key_milestones: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
            placeholder="Major checkpoints on the way to done"
          />
        </section>

        {/* Planning Steps */}
        <section className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-semibold mb-2">Planning / Steps</h2>
          <p className="text-xs text-muted mb-2">Sketch out steps here. Active next actions go on context lists, not here.</p>
          <textarea
            value={project.planning_steps || ''}
            onChange={e => setProject({ ...project, planning_steps: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={4}
          />
        </section>

        {/* Next Actions */}
        <section className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Next Actions ({activeActions.length})</h2>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary-hover"
            >
              <Plus size={14} />
              Add Action
            </button>
          </div>

          {showAdd && (
            <form onSubmit={addAction} className="mb-4 p-3 bg-background rounded-lg space-y-2">
              <input
                type="text"
                value={newAction}
                onChange={e => setNewAction(e.target.value)}
                placeholder="Concrete, physical, visible action..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <select
                  value={newContext}
                  onChange={e => setNewContext(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-card text-xs"
                >
                  {CONTEXTS.map(ctx => (
                    <option key={ctx.key} value={ctx.key}>{ctx.label}</option>
                  ))}
                </select>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs">
                  Add
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-muted">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {activeActions.length === 0 && !showAdd ? (
            <p className="text-sm text-muted italic">No active next actions. Add one to get this project moving.</p>
          ) : (
            <div className="space-y-1">
              {activeActions.map(action => (
                <div key={action.id} className="flex items-start gap-3 p-2 rounded-lg group hover:bg-background transition-colors">
                  <button
                    onClick={() => completeAction(action.id)}
                    className="mt-0.5 w-4 h-4 rounded border-2 border-muted/40 hover:border-success hover:bg-success/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{action.content}</p>
                    <span className="text-xs text-muted">{CONTEXTS.find(c => c.key === action.context)?.label}</span>
                  </div>
                  <button
                    onClick={() => deleteAction(action.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completed Actions */}
          {completedActions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted mb-2">Completed ({completedActions.length})</p>
              <div className="space-y-1">
                {completedActions.map(action => (
                  <div key={action.id} className="flex items-start gap-3 p-2 opacity-50">
                    <Check size={16} className="text-success mt-0.5 shrink-0" />
                    <p className="text-sm line-through">{action.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-semibold mb-2">Notes</h2>
          <textarea
            value={project.notes || ''}
            onChange={e => setProject({ ...project, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={4}
          />
        </section>
      </div>
    </div>
  );
}
