'use client';

import { useEffect, useState, useCallback } from 'react';
import { TIME_OPTIONS, formatTime } from '@/lib/time-utils';
import {
  Plus, Trash2, Save, Calendar, ChevronDown, ChevronRight,
  RotateCcw, Edit3, X, Check, Copy,
} from 'lucide-react';
import { useUndoableAction } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────
interface Block {
  id: string;
  pattern_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string;
  description: string | null;
  is_non_negotiable: number;
  sort_order: number;
}

interface Pattern {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  blocks: Block[];
}

interface Rotation {
  id: string;
  name: string;
  pattern_ids: string;
  start_date: string;
  is_active: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// TIME_OPTIONS and formatTime imported from @/lib/time-utils

// ── Component ──────────────────────────────────────────────────
export default function IdealCalendarPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [rotation, setRotation] = useState<Rotation | null>(null);
  const [activePatternId, setActivePatternId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { undoableFetchDelete } = useUndoableAction();

  // New pattern form
  const [showNewPattern, setShowNewPattern] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');

  // New block form
  const [addingBlockDay, setAddingBlockDay] = useState<number | null>(null);
  const [newBlock, setNewBlock] = useState({ start_time: '09:00', end_time: '10:00', label: '', description: '', is_non_negotiable: 0 });

  // Editing
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlock, setEditBlock] = useState<Partial<Block>>({});

  // Rotation setup
  const [showRotation, setShowRotation] = useState(false);
  const [rotationPatternIds, setRotationPatternIds] = useState<string[]>([]);
  const [rotationStartDate, setRotationStartDate] = useState(new Date().toISOString().slice(0, 10));

  // ── Load data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/week-patterns');
      const data = await res.json();
      setPatterns(data.patterns || []);
      setRotation(data.rotation || null);
      if (data.patterns.length > 0 && !activePatternId) {
        setActivePatternId(data.patterns[0].id);
      }
      if (data.rotation) {
        try {
          setRotationPatternIds(JSON.parse(data.rotation.pattern_ids));
          setRotationStartDate(data.rotation.start_date);
        } catch { /* */ }
      }
    } catch (err) {
      console.error('Failed to load patterns:', err);
    } finally {
      setLoading(false);
    }
  }, [activePatternId]);

  useEffect(() => { loadData(); }, [loadData]);

  const activePattern = patterns.find(p => p.id === activePatternId);

  // ── Create pattern ────────────────────────────────────────
  async function createPattern() {
    if (!newPatternName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/week-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPatternName.trim() }),
      });
      const created = await res.json();
      setPatterns(prev => [...prev, { ...created, blocks: [] }]);
      setActivePatternId(created.id);
      setNewPatternName('');
      setShowNewPattern(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete pattern ────────────────────────────────────────
  function deletePattern(id: string) {
    const pattern = patterns.find(p => p.id === id);
    setPatterns(prev => prev.filter(p => p.id !== id));
    if (activePatternId === id) {
      setActivePatternId(patterns.find(p => p.id !== id)?.id || null);
    }
    undoableFetchDelete(id, `/api/week-patterns?id=${id}`, 'Pattern deleted', {
      onUndo: () => {
        if (pattern) {
          setPatterns(prev => [...prev, pattern]);
          setActivePatternId(id);
        }
      },
    });
  }

  // ── Duplicate pattern ─────────────────────────────────────
  async function duplicatePattern(sourceId: string) {
    const source = patterns.find(p => p.id === sourceId);
    if (!source) return;
    setSaving(true);
    try {
      const res = await fetch('/api/week-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${source.name} (Copy)` }),
      });
      const created = await res.json();

      // Copy all blocks
      for (const block of source.blocks) {
        await fetch('/api/week-patterns/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id: created.id,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            label: block.label,
            description: block.description,
            is_non_negotiable: block.is_non_negotiable,
            sort_order: block.sort_order,
          }),
        });
      }

      await loadData();
      setActivePatternId(created.id);
    } finally {
      setSaving(false);
    }
  }

  // ── Add block ─────────────────────────────────────────────
  async function addBlock(dayOfWeek: number) {
    if (!activePatternId || !newBlock.label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/week-patterns/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_id: activePatternId,
          day_of_week: dayOfWeek,
          ...newBlock,
        }),
      });
      const created = await res.json();
      setPatterns(prev => prev.map(p =>
        p.id === activePatternId
          ? { ...p, blocks: [...p.blocks, created].sort((a, b) => a.start_time.localeCompare(b.start_time)) }
          : p
      ));
      setNewBlock({ start_time: '09:00', end_time: '10:00', label: '', description: '', is_non_negotiable: 0 });
      setAddingBlockDay(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Update block ──────────────────────────────────────────
  async function updateBlock(blockId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/week-patterns/blocks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: blockId, ...editBlock }),
      });
      const updated = await res.json();
      setPatterns(prev => prev.map(p => ({
        ...p,
        blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updated } : b)
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
      })));
      setEditingBlockId(null);
      setEditBlock({});
    } finally {
      setSaving(false);
    }
  }

  // ── Delete block ──────────────────────────────────────────
  function deleteBlock(blockId: string) {
    const block = patterns.flatMap(p => p.blocks).find(b => b.id === blockId);
    setPatterns(prev => prev.map(p => ({
      ...p,
      blocks: p.blocks.filter(b => b.id !== blockId),
    })));
    undoableFetchDelete(blockId, `/api/week-patterns/blocks?id=${blockId}`, 'Block deleted', {
      onUndo: () => {
        if (block) {
          setPatterns(prev => prev.map(p =>
            p.id === block.pattern_id
              ? { ...p, blocks: [...p.blocks, block].sort((a, b) => a.start_time.localeCompare(b.start_time)) }
              : p
          ));
        }
      },
    });
  }

  // ── Save rotation ─────────────────────────────────────────
  async function saveRotation() {
    if (rotationPatternIds.length === 0) {
      // Clear rotation
      await fetch('/api/week-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_rotation' }),
      });
      setRotation(null);
    } else {
      const res = await fetch('/api/week-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_rotation',
          pattern_ids: rotationPatternIds,
          start_date: rotationStartDate,
          name: rotationPatternIds.length > 1 ? 'A/B Rotation' : 'Single Pattern',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    }
    setShowRotation(false);
  }

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar size={24} className="text-primary" />
            Ideal Calendar
          </h1>
          <p className="text-muted text-sm mt-1">
            Design your ideal week patterns. Set up rotations for alternating schedules.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowRotation(!showRotation)}
            className="px-3 py-2 rounded-lg border border-border text-sm flex items-center gap-2 hover:bg-card transition-colors"
          >
            <RotateCcw size={16} />
            Rotation
          </button>
          <button
            onClick={() => setShowNewPattern(true)}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            New Pattern
          </button>
        </div>
      </div>

      {/* Rotation Setup */}
      {showRotation && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <RotateCcw size={18} />
            Week Pattern Rotation
          </h3>
          <p className="text-sm text-muted">
            Select which patterns to rotate through. They will alternate weekly starting from the date you choose.
          </p>

          <div className="space-y-2">
            {patterns.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer">
                <input
                  type="checkbox"
                  checked={rotationPatternIds.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRotationPatternIds(prev => [...prev, p.id]);
                    } else {
                      setRotationPatternIds(prev => prev.filter(id => id !== p.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">({p.blocks.length} blocks)</span>
              </label>
            ))}
          </div>

          {rotationPatternIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Rotation starts on:</label>
              <input
                type="date"
                value={rotationStartDate}
                onChange={(e) => setRotationStartDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          {rotationPatternIds.length > 1 && (
            <p className="text-xs text-muted">
              Order: {rotationPatternIds.map(id => patterns.find(p => p.id === id)?.name || '?').join(' → ')} → repeat
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={saveRotation} className="px-4 py-2 rounded-lg bg-primary text-white text-sm flex items-center gap-2">
              <Save size={14} /> Save Rotation
            </button>
            <button onClick={() => setShowRotation(false)} className="px-4 py-2 rounded-lg border border-border text-sm">
              Cancel
            </button>
          </div>

          {rotation && (
            <p className="text-xs text-green-600">
              Active rotation: {(() => {
                try {
                  const ids = JSON.parse(rotation.pattern_ids);
                  return ids.map((id: string) => patterns.find(p => p.id === id)?.name || '?').join(' → ');
                } catch { return 'Unknown'; }
              })()} (started {rotation.start_date})
            </p>
          )}
        </div>
      )}

      {/* New Pattern Form */}
      {showNewPattern && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h3 className="font-semibold">Create New Week Pattern</h3>
          <input
            type="text"
            value={newPatternName}
            onChange={(e) => setNewPatternName(e.target.value)}
            placeholder="e.g., Standard Week, Travel Week, Kids Week"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && createPattern()}
          />
          <div className="flex gap-2">
            <button onClick={createPattern} disabled={saving || !newPatternName.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50">
              Create
            </button>
            <button onClick={() => { setShowNewPattern(false); setNewPatternName(''); }} className="px-4 py-2 rounded-lg border border-border text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pattern Tabs */}
      {patterns.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {patterns.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePatternId(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activePatternId === p.id
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* No Patterns State */}
      {patterns.length === 0 && !showNewPattern && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Calendar size={48} className="mx-auto text-muted mb-3 opacity-30" />
          <p className="font-semibold text-foreground">No week patterns yet</p>
          <p className="text-sm text-muted mt-1">Create your first week pattern to design your ideal schedule.</p>
          <button
            onClick={() => setShowNewPattern(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm"
          >
            Create First Pattern
          </button>
        </div>
      )}

      {/* Active Pattern Editor */}
      {activePattern && (
        <div className="space-y-4">
          {/* Pattern header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{activePattern.name}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => duplicatePattern(activePattern.id)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs flex items-center gap-1 hover:bg-card"
                title="Duplicate pattern"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={() => deletePattern(activePattern.id)}
                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs flex items-center gap-1 hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {/* Day-by-day schedule */}
          {DAYS.map((dayName, dayIndex) => {
            const dayBlocks = activePattern.blocks.filter(b => b.day_of_week === dayIndex);

            return (
              <div key={dayIndex} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-background/50 flex items-center justify-between">
                  <h3 className="font-medium text-sm">{dayName}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => setAddingBlockDay(addingBlockDay === dayIndex ? null : dayIndex)}
                      aria-label={addingBlockDay === dayIndex ? 'Cancel add block' : 'Add block'}
                      className="p-1 rounded hover:bg-primary/10 text-primary"
                    >
                      {addingBlockDay === dayIndex ? <X size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>

                {/* Existing blocks */}
                <div className="divide-y divide-border">
                  {dayBlocks.length === 0 && addingBlockDay !== dayIndex && (
                    <p className="px-4 py-3 text-sm text-muted italic">No blocks — open time</p>
                  )}
                  {dayBlocks.map(block => (
                    <div key={block.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                      {editingBlockId === block.id ? (
                        /* Editing mode */
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <select value={editBlock.start_time || block.start_time} onChange={e => setEditBlock(prev => ({ ...prev, start_time: e.target.value }))} className="rounded border border-border bg-background px-2 py-1 text-xs">
                              {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                            </select>
                            <span className="text-xs text-muted self-center">to</span>
                            <select value={editBlock.end_time || block.end_time} onChange={e => setEditBlock(prev => ({ ...prev, end_time: e.target.value }))} className="rounded border border-border bg-background px-2 py-1 text-xs">
                              {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                            </select>
                          </div>
                          <input type="text" value={editBlock.label ?? block.label} onChange={e => setEditBlock(prev => ({ ...prev, label: e.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Block name" />
                          <input type="text" value={editBlock.description ?? (block.description || '')} onChange={e => setEditBlock(prev => ({ ...prev, description: e.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Description (optional)" />
                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={(editBlock.is_non_negotiable ?? block.is_non_negotiable) === 1} onChange={e => setEditBlock(prev => ({ ...prev, is_non_negotiable: e.target.checked ? 1 : 0 }))} />
                            Non-negotiable
                          </label>
                          <div className="flex gap-2">
                            <button onClick={() => updateBlock(block.id)} disabled={saving} className="px-2 py-1 rounded bg-primary text-white text-xs flex items-center gap-1">
                              <Check size={12} /> Save
                            </button>
                            <button onClick={() => { setEditingBlockId(null); setEditBlock({}); }} className="px-2 py-1 rounded border border-border text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted w-28 shrink-0">{formatTime(block.start_time)} - {formatTime(block.end_time)}</span>
                              <span className={`text-sm font-medium ${block.is_non_negotiable ? 'text-primary' : ''}`}>
                                {block.label}{block.is_non_negotiable ? ' *' : ''}
                              </span>
                            </div>
                            {block.description && (
                              <p className="text-xs text-muted mt-0.5 ml-[7.5rem]">{block.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditingBlockId(block.id); setEditBlock({}); }} aria-label="Edit block" className="p-1 rounded hover:bg-background text-muted hover:text-foreground">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => deleteBlock(block.id)} aria-label="Delete block" className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add block form */}
                {addingBlockDay === dayIndex && (
                  <div className="px-4 py-3 border-t border-border bg-primary/5 space-y-2">
                    <div className="flex gap-2">
                      <select value={newBlock.start_time} onChange={e => setNewBlock(prev => ({ ...prev, start_time: e.target.value }))} className="rounded border border-border bg-background px-2 py-1 text-xs">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                      <span className="text-xs text-muted self-center">to</span>
                      <select value={newBlock.end_time} onChange={e => setNewBlock(prev => ({ ...prev, end_time: e.target.value }))} className="rounded border border-border bg-background px-2 py-1 text-xs">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                    </div>
                    <input type="text" value={newBlock.label} onChange={e => setNewBlock(prev => ({ ...prev, label: e.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Block name (e.g., Deep Work, Lunch, Workout)" autoFocus />
                    <input type="text" value={newBlock.description} onChange={e => setNewBlock(prev => ({ ...prev, description: e.target.value }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Description (optional)" />
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={newBlock.is_non_negotiable === 1} onChange={e => setNewBlock(prev => ({ ...prev, is_non_negotiable: e.target.checked ? 1 : 0 }))} />
                      Non-negotiable
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => addBlock(dayIndex)} disabled={saving || !newBlock.label.trim()} className="px-3 py-1.5 rounded bg-primary text-white text-xs disabled:opacity-50 flex items-center gap-1">
                        <Plus size={12} /> Add Block
                      </button>
                      <button onClick={() => setAddingBlockDay(null)} className="px-3 py-1.5 rounded border border-border text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
