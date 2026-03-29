'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, Trash2, Pencil, X, Loader2 } from 'lucide-react';

interface HorizonItem {
  id: string;
  horizon_type: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const HORIZON_META: Record<string, { label: string; description: string; icon: string }> = {
  purpose: {
    label: 'Purpose',
    description: 'Why you exist. Your deepest calling and what drives everything.',
    icon: '⭐',
  },
  vision: {
    label: 'Vision (3-5 years)',
    description: 'What does life and business look like when things are going right?',
    icon: '🔭',
  },
  goals: {
    label: 'Goals (1-2 years)',
    description: 'Specific outcomes you are working toward.',
    icon: '🎯',
  },
  areas_of_focus: {
    label: 'Areas of Focus',
    description: 'Roles and responsibilities you maintain: business owner, father, husband, musician, faith.',
    icon: '⚖️',
  },
  growth_intentions: {
    label: 'Growth Intentions',
    description: 'Skills, knowledge, and character traits you are developing.',
    icon: '🌱',
  },
};

const HORIZON_ORDER = ['purpose', 'vision', 'goals', 'areas_of_focus', 'growth_intentions'];

export default function HorizonsPage() {
  const [items, setItems] = useState<HorizonItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [addingToType, setAddingToType] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/horizon-items');
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch (err) {
      console.error('Failed to fetch horizon items', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function addItem(horizonType: string) {
    if (!newName.trim()) return;
    setAddSaving(true);
    try {
      const typeItems = items.filter(i => i.horizon_type === horizonType);
      await fetch('/api/horizon-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horizon_type: horizonType,
          name: newName.trim(),
          description: newDescription.trim() || null,
          sort_order: typeItems.length,
        }),
      });
      setNewName('');
      setNewDescription('');
      setAddingToType(null);
      fetchItems();
    } finally {
      setAddSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setEditSaving(true);
    try {
      await fetch('/api/horizon-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      setEditingId(null);
      fetchItems();
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/horizon-items?id=${id}`, { method: 'DELETE' });
    fetchItems();
  }

  function startEdit(item: HorizonItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setAddingToType(null);
  }

  function startAdd(type: string) {
    setAddingToType(type);
    setNewName('');
    setNewDescription('');
    setEditingId(null);
  }

  // Group items by horizon type
  const grouped: Record<string, HorizonItem[]> = {};
  for (const item of items) {
    if (!grouped[item.horizon_type]) grouped[item.horizon_type] = [];
    grouped[item.horizon_type].push(item);
  }
  // Sort each group by sort_order
  for (const type of Object.keys(grouped)) {
    grouped[type].sort((a, b) => a.sort_order - b.sort_order);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Horizons of Focus</h1>
        <p className="text-sm text-muted mt-1">Your altitude map — from purpose down to daily ground-level actions.</p>
      </div>

      <div className="space-y-6">
        {HORIZON_ORDER.map(type => {
          const meta = HORIZON_META[type];
          const typeItems = grouped[type] || [];

          return (
            <div key={type} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border bg-background/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2">
                      <span>{meta.icon}</span>
                      {meta.label}
                    </h2>
                    <p className="text-xs text-muted mt-0.5">{meta.description}</p>
                  </div>
                  <button
                    onClick={() => addingToType === type ? setAddingToType(null) : startAdd(type)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                {typeItems.map(item => (
                  <div key={item.id} className="px-5 py-3 group">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <textarea
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          placeholder="Description (optional)..."
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={editSaving || !editName.trim()}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                          >
                            {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted mt-0.5">{item.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => startEdit(item)} className="p-1 text-muted hover:text-foreground rounded" aria-label="Edit item">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-1 text-muted hover:text-red-600 rounded" aria-label="Delete item">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {typeItems.length === 0 && addingToType !== type && (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-muted">No items yet.</p>
                    <button
                      onClick={() => startAdd(type)}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Add your first {meta.label.toLowerCase()} item
                    </button>
                  </div>
                )}
              </div>

              {/* Add form */}
              {addingToType === type && (
                <div className="px-5 py-4 border-t border-border bg-background/30 space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={`Name (e.g., "Becoming Debt Free")...`}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem(type); } if (e.key === 'Escape') setAddingToType(null); }}
                  />
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Description (optional)..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addItem(type)}
                      disabled={addSaving || !newName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {addSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Add Item
                    </button>
                    <button onClick={() => setAddingToType(null)} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground flex items-center gap-1">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
