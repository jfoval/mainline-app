'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, FolderOpen, Archive, Briefcase, Pencil, X, Check } from 'lucide-react';
import { useUndoableAction } from '@/lib/toast';

interface ReferenceDoc {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

const FIXED_CATEGORIES = ['Someday/Maybe (Personal)', 'Someday/Maybe (Work)'];

export default function ReferencePage() {
  // Reference docs state
  const [activeRefCategory, setActiveRefCategory] = useState<string | null>(null);
  const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([]);
  const [refCategories, setRefCategories] = useState<string[]>([]);
  const [showAddRef, setShowAddRef] = useState(false);
  const [newRefTitle, setNewRefTitle] = useState('');
  const [newRefContent, setNewRefContent] = useState('');
  const [newRefCategoryInput, setNewRefCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // Category management
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  const { undoableFetchDelete } = useUndoableAction();

  // Load reference categories on mount
  useEffect(() => {
    fetchRefCategories();
  }, []);

  async function fetchRefCategories() {
    try {
      const res = await fetch('/api/reference?categories=true');
      const cats: string[] = await res.json();
      setRefCategories(cats);
    } catch { /* offline */ }
  }

  // Separate fixed and user categories
  const userCategories = refCategories.filter(c => !FIXED_CATEGORIES.includes(c));
  const activeFixedCategories = FIXED_CATEGORIES.filter(c => refCategories.includes(c));

  async function openRefCategory(category: string) {
    setActiveRefCategory(category);
    setShowAddRef(false);
    try {
      const res = await fetch(`/api/reference?category=${encodeURIComponent(category)}`);
      const docs = await res.json();
      setRefDocs(docs);
    } catch { setRefDocs([]); }
  }

  async function addRefDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!newRefTitle.trim() || !activeRefCategory) return;
    try {
      await fetch('/api/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRefTitle.trim(),
          category: activeRefCategory,
          content: newRefContent.trim(),
        }),
      });
      setNewRefTitle('');
      setNewRefContent('');
      setShowAddRef(false);
      openRefCategory(activeRefCategory);
    } catch { /* offline */ }
  }

  function deleteRefDoc(id: string) {
    const doc = refDocs.find(d => d.id === id);
    setRefDocs(prev => prev.filter(d => d.id !== id));
    undoableFetchDelete(id, `/api/reference?id=${id}`, 'Reference deleted', {
      onUndo: () => {
        if (doc) setRefDocs(prev => [...prev, doc]);
      },
      onSettled: () => {
        fetchRefCategories();
      },
    });
  }

  async function addNewCategory() {
    if (!newRefCategoryInput.trim()) return;
    const cat = newRefCategoryInput.trim();
    if (!refCategories.includes(cat)) {
      setRefCategories([...refCategories, cat].sort());
    }
    setNewRefCategoryInput('');
    setShowNewCategoryInput(false);
    openRefCategory(cat);
  }

  async function renameCategory(oldName: string, newName: string) {
    if (!newName.trim() || newName.trim() === oldName) {
      setEditingCategory(null);
      return;
    }
    try {
      await fetch('/api/reference/rename-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldCategory: oldName, newCategory: newName.trim() }),
      });
      setEditingCategory(null);
      fetchRefCategories();
    } catch { /* offline */ }
  }

  async function deleteCategory(category: string) {
    try {
      await fetch('/api/reference/delete-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      setDeletingCategory(null);
      fetchRefCategories();
    } catch { /* offline */ }
  }

  // ─── Reference Docs Category View ──────────────────────
  if (activeRefCategory) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => { setActiveRefCategory(null); fetchRefCategories(); }} className="text-sm text-muted hover:text-foreground transition-colors mb-2 block">
              ← All Reference
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen size={24} /> {activeRefCategory}
            </h1>
            <p className="text-sm text-muted mt-1">{refDocs.length} item{refDocs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAddRef(!showAddRef)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors">
            <Plus size={18} /> Add
          </button>
        </div>

        {showAddRef && (
          <form onSubmit={addRefDoc} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
            <input value={newRefTitle} onChange={e => setNewRefTitle(e.target.value)} placeholder="Title" autoFocus
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-green-500/50" />
            <textarea value={newRefContent} onChange={e => setNewRefContent(e.target.value)} placeholder="Notes / content (optional)" rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-green-500/50" />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm">Add</button>
              <button type="button" onClick={() => setShowAddRef(false)} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">Cancel</button>
            </div>
          </form>
        )}

        {refDocs.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p>No reference items in this category yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {refDocs.map(doc => (
              <div key={doc.id} className="p-3 rounded-xl bg-card border border-border group flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{doc.title}</p>
                  {doc.content && <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{doc.content}</p>}
                  <p className="text-xs text-muted mt-1">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteRefDoc(doc.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted hover:text-red-600 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Overview ──────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reference</h1>
        <p className="text-sm text-muted mt-1">Not actionable — things to file, review later, or look up.</p>
      </div>

      {/* Someday/Maybe */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Someday / Maybe</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button
            onClick={() => openRefCategory('Someday/Maybe (Personal)')}
            className="p-5 rounded-xl bg-card border border-border hover:border-purple-400/50 transition-colors text-left"
          >
            <Archive size={24} className="text-purple-600 mb-3" />
            <p className="font-medium text-sm">Personal</p>
            <p className="text-xs text-muted mt-1">Not now, but maybe later</p>
          </button>
          <button
            onClick={() => openRefCategory('Someday/Maybe (Work)')}
            className="p-5 rounded-xl bg-card border border-border hover:border-blue-400/50 transition-colors text-left"
          >
            <Briefcase size={24} className="text-blue-600 mb-3" />
            <p className="font-medium text-sm">Work</p>
            <p className="text-xs text-muted mt-1">Business ideas for later</p>
          </button>
        </div>
      </div>

      {/* Reference Folders */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Reference Folders</h2>
        {userCategories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {userCategories.map(cat => (
              <div key={cat} className="relative group">
                {editingCategory === cat ? (
                  <div className="p-4 rounded-xl bg-card border-2 border-green-400 space-y-2">
                    <input
                      value={editCategoryName}
                      onChange={e => setEditCategoryName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameCategory(cat, editCategoryName);
                        if (e.key === 'Escape') setEditingCategory(null);
                      }}
                      autoFocus
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => renameCategory(cat, editCategoryName)} className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600"><Check size={14} /></button>
                      <button onClick={() => setEditingCategory(null)} className="p-1 rounded hover:bg-muted/20 text-muted"><X size={14} /></button>
                    </div>
                  </div>
                ) : deletingCategory === cat ? (
                  <div className="p-4 rounded-xl bg-card border-2 border-red-400 space-y-2">
                    <p className="text-xs text-red-700 dark:text-red-400 font-medium">Delete &ldquo;{cat}&rdquo; and all its items?</p>
                    <div className="flex gap-2">
                      <button onClick={() => deleteCategory(cat)} className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700">Delete</button>
                      <button onClick={() => setDeletingCategory(null)} className="px-3 py-1 rounded-lg text-muted text-xs hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openRefCategory(cat)}
                    className="w-full p-5 rounded-xl bg-card border border-border hover:border-green-400/50 transition-colors text-left"
                  >
                    <FolderOpen size={24} className="text-green-600 mb-3" />
                    <p className="font-medium text-sm">{cat}</p>
                  </button>
                )}
                {editingCategory !== cat && deletingCategory !== cat && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setEditCategoryName(cat); }}
                      className="p-1 rounded hover:bg-muted/20 text-muted hover:text-foreground"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingCategory(cat); }}
                      className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new category */}
        {!showNewCategoryInput ? (
          <button
            onClick={() => setShowNewCategoryInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-700 border border-green-200 hover:bg-green-50 transition-colors"
          >
            <Plus size={12} /> New folder
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              value={newRefCategoryInput}
              onChange={e => setNewRefCategoryInput(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') addNewCategory();
                if (e.key === 'Escape') { setShowNewCategoryInput(false); setNewRefCategoryInput(''); }
              }}
              className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm"
            />
            <button onClick={addNewCategory} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700">Create</button>
            <button onClick={() => { setShowNewCategoryInput(false); setNewRefCategoryInput(''); }} className="px-3 py-2 rounded-lg text-muted hover:text-foreground text-xs">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
