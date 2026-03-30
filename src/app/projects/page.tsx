'use client';

import { useState } from 'react';
import { Plus, AlertTriangle, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useOfflineStore, projectsStore } from '@/lib/offline';
import type { Project } from '@/lib/offline';
import { useUndoableAction } from '@/lib/toast';

const CATEGORIES = [
  'business', 'personal', 'home', 'family', 'health', 'finance', 'learning', 'other'
];

export default function ProjectsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [newPurpose, setNewPurpose] = useState('');
  const { data: projects, create, update } = useOfflineStore(
    projectsStore,
    { status: 'active' }
  );
  const { undoableStatusChange } = useUndoableAction();

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await create({
      title: newTitle.trim(),
      category: newCategory,
      purpose: newPurpose.trim(),
      status: 'active',
    });
    setNewTitle('');
    setNewPurpose('');
    setShowAdd(false);
  }

  async function archiveProject(id: string) {
    await undoableStatusChange(id, 'archived', 'active', update, 'Project archived');
  }

  // Group projects by category
  const grouped = projects.reduce<Record<string, Project[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted mt-1">{projects.length} active</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      {/* Add Project Form */}
      {showAdd && (
        <form onSubmit={addProject} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Done-state name (e.g., 'ZGC engaged as client')"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <div className="flex gap-3">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              value={newPurpose}
              onChange={e => setNewPurpose(e.target.value)}
              placeholder="Purpose / desired outcome"
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm">
              Create Project
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Projects by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg font-medium">No active projects</p>
          <p className="text-sm mt-1">Create a project or process your inbox.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryProjects]) => (
            <CategoryGroup
              key={category}
              category={category}
              projects={categoryProjects}
              onArchive={archiveProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ category, projects, onArchive }: {
  category: string;
  projects: Project[];
  onArchive: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted uppercase tracking-wide"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {category} ({projects.length})
      </button>
      {isOpen && (
        <div className="space-y-2">
          {projects.map(project => (
            <Link
              href={`/projects/${project.id}`}
              key={project.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border group hover:border-primary/30 transition-colors block"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{project.title}</p>
                  {project.active_action_count === 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">
                      <AlertTriangle size={10} />
                      No next action
                    </span>
                  )}
                </div>
                {project.purpose && (
                  <p className="text-xs text-muted mt-1">{project.purpose}</p>
                )}
                <p className="text-xs text-muted mt-1">
                  {project.active_action_count} active action{project.active_action_count !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); onArchive(project.id); }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/10 text-muted transition-all"
                title="Archive"
              >
                <Archive size={14} />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
