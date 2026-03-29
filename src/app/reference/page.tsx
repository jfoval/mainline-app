'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, BookOpen, Film, Tv, Music, Plane, Gift, FileText, FolderOpen } from 'lucide-react';
import { useOfflineStore, listItemsStore } from '@/lib/offline';
import type { ListItem } from '@/lib/offline';
import { useUndoableAction, useToast } from '@/lib/toast';

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

const LISTS = [
  { type: 'wish_list', label: 'Wish List', icon: Gift, tiers: ['need_soon', 'want', 'someday'] },
  { type: 'reading', label: 'Reading List', icon: BookOpen, statuses: ['up_next', 'reading', 'read'] },
  { type: 'movies', label: 'Movies', icon: Film },
  { type: 'shows', label: 'Shows', icon: Tv },
  { type: 'albums', label: 'Albums', icon: Music },
  { type: 'travel', label: 'Travel', icon: Plane },
];

type ListConfig = typeof LISTS[0];
type ActiveList = ListConfig | null;

export default function ReferencePage() {
  const [activeList, setActiveList] = useState<ActiveList>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTier, setNewTier] = useState('want');
  const [newStatus, setNewStatus] = useState('up_next');
  const [newUrl, setNewUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Reference docs state
  const [activeRefCategory, setActiveRefCategory] = useState<string | null>(null);
  const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([]);
  const [refCategories, setRefCategories] = useState<string[]>([]);
  const [showAddRef, setShowAddRef] = useState(false);
  const [newRefTitle, setNewRefTitle] = useState('');
  const [newRefContent, setNewRefContent] = useState('');
  const [newRefCategoryInput, setNewRefCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // When a list is active, query its items from the offline store
  const listParams = activeList ? { type: activeList.type } : { type: '__none__' };
  const { data: items, create, remove } = useOfflineStore(listItemsStore, listParams);
  const { pendingDeletes } = useToast();
  const { undoableDelete, undoableFetchDelete } = useUndoableAction();

  // Load reference categories on mount
  useEffect(() => {
    fetchRefCategories();
  }, []);

  async function fetchRefCategories() {
    try {
      const res = await fetch('/api/reference?categories=true');
      const cats = await res.json();
      setRefCategories(cats);
    } catch { /* offline */ }
  }

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

  function openList(list: ListConfig) {
    setActiveList(list);
    setActiveRefCategory(null);
    setShowAdd(false);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !activeList) return;
    await create({
      title: newTitle.trim(),
      list_type: activeList.type,
      tier: activeList.tiers ? newTier : null,
      status: activeList.statuses ? newStatus : null,
      url: newUrl.trim() || null,
      notes: newNotes.trim() || null,
    });
    setNewTitle('');
    setNewUrl('');
    setNewNotes('');
    setShowAdd(false);
  }

  function deleteItem(id: string) {
    undoableDelete(id, remove, 'List item deleted');
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

  // ─── List Detail View ──────────────────────
  if (activeList) {
    const Icon = activeList.icon;
    const visibleItems = items.filter(i => !pendingDeletes.has(i.id));

    let groupedItems: Record<string, ListItem[]> | null = null;
    if (activeList.tiers) {
      groupedItems = {};
      for (const tier of activeList.tiers) {
        const tierItems = visibleItems.filter(i => i.tier === tier);
        if (tierItems.length > 0) groupedItems[tier] = tierItems;
      }
      const noTier = visibleItems.filter(i => !i.tier || !activeList.tiers!.includes(i.tier));
      if (noTier.length > 0) groupedItems['other'] = noTier;
    } else if (activeList.statuses) {
      groupedItems = {};
      for (const status of activeList.statuses) {
        const statusItems = visibleItems.filter(i => i.status === status);
        if (statusItems.length > 0) groupedItems[status] = statusItems;
      }
      const noStatus = visibleItems.filter(i => !i.status || !activeList.statuses!.includes(i.status));
      if (noStatus.length > 0) groupedItems['other'] = noStatus;
    }

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => setActiveList(null)} className="text-sm text-muted hover:text-foreground transition-colors mb-2 block">
              ← All Lists
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon size={24} /> {activeList.label}
            </h1>
            <p className="text-sm text-muted mt-1">{visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors">
            <Plus size={18} /> Add
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addItem} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" autoFocus
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex gap-3">
              {activeList.tiers && (
                <select value={newTier} onChange={e => setNewTier(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {activeList.tiers.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              )}
              {activeList.statuses && (
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {activeList.statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="URL (optional)"
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm">Add</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">Cancel</button>
            </div>
          </form>
        )}

        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p>No items yet. Add your first one.</p>
          </div>
        ) : groupedItems ? (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([group, groupItems]) => (
              <GroupSection key={group} label={group.replace(/_/g, ' ')} items={groupItems} onDelete={deleteItem} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map(item => (
              <ItemCard key={item.id} item={item} onDelete={deleteItem} />
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
        <p className="text-sm text-muted mt-1">Personal lists and reference material. Not actionable — just stuff to look up.</p>
      </div>

      {/* Reference Docs by Category */}
      {(refCategories.length > 0 || showNewCategoryInput) && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Filed Reference</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {refCategories.map(cat => (
              <button
                key={cat}
                onClick={() => openRefCategory(cat)}
                className="p-5 rounded-xl bg-card border border-border hover:border-green-400/50 transition-colors text-left"
              >
                <FolderOpen size={24} className="text-green-600 mb-3" />
                <p className="font-medium text-sm">{cat}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add new category */}
      <div className="mb-8">
        {!showNewCategoryInput ? (
          <button
            onClick={() => setShowNewCategoryInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-700 border border-green-200 hover:bg-green-50 transition-colors"
          >
            <Plus size={12} /> New reference category
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              value={newRefCategoryInput}
              onChange={e => setNewRefCategoryInput(e.target.value)}
              placeholder="Category name..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && addNewCategory()}
              className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm"
            />
            <button onClick={addNewCategory} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700">Create</button>
            <button onClick={() => { setShowNewCategoryInput(false); setNewRefCategoryInput(''); }} className="px-3 py-2 rounded-lg text-muted hover:text-foreground text-xs">Cancel</button>
          </div>
        )}
      </div>

      {/* Personal Lists */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Personal Lists</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {LISTS.map(list => {
          const Icon = list.icon;
          return (
            <button
              key={list.type}
              onClick={() => openList(list)}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors text-left"
            >
              <Icon size={24} className="text-primary mb-3" />
              <p className="font-medium text-sm">{list.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupSection({ label, items, onDelete }: { label: string; items: ListItem[]; onDelete: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted uppercase tracking-wide">
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {label} ({items.length})
      </button>
      {isOpen && (
        <div className="space-y-2">
          {items.map(item => <ItemCard key={item.id} item={item} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, onDelete }: { item: ListItem; onDelete: (id: string) => void }) {
  return (
    <div className="p-3 rounded-xl bg-card border border-border group flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium">
          {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{item.title}</a> : item.title}
        </p>
        {item.notes && <p className="text-xs text-muted mt-1">{item.notes}</p>}
      </div>
      <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted hover:text-red-600 transition-all">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
