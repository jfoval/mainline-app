'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Trash2, X, Check, Edit3, GripVertical } from 'lucide-react';
import { TIME_OPTIONS, formatTime, timeToMinutes } from '@/lib/time-utils';
import { useUndoableAction } from '@/lib/toast';
import MiniTimeline from '@/components/MiniTimeline';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DailyBlock {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  description: string | null;
  is_non_negotiable: number;
}

export default function DailyCalendar({ date }: { date: string }) {
  const [blocks, setBlocks] = useState<DailyBlock[]>([]);
  const { undoableFetchDelete } = useUndoableAction();
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBlock, setNewBlock] = useState({ start_time: '09:00', end_time: '10:00', label: '', description: '', is_non_negotiable: 0 });
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBlock, setEditBlock] = useState({ start_time: '', end_time: '', label: '', description: '', is_non_negotiable: 0 });
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const currentBlockRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Load blocks
  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/daily-blocks?date=${date}`);
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch (err) {
      console.error('Failed to load daily blocks:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // Update current time every minute
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to current block on first load
  useEffect(() => {
    if (!loading && currentBlockRef.current && !hasScrolled.current) {
      currentBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolled.current = true;
    }
  }, [loading, currentTime]);

  // Add block
  const handleAdd = async () => {
    if (!newBlock.label.trim()) return;
    if (newBlock.end_time <= newBlock.start_time) {
      setAddFormError('End time must be after start time');
      return;
    }
    setAddFormError(null);
    try {
      const res = await fetch('/api/daily-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...newBlock }),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewBlock({ start_time: '09:00', end_time: '10:00', label: '', description: '', is_non_negotiable: 0 });
        loadBlocks();
      }
    } catch (err) { console.error(err); }
  };

  // Update block
  const handleUpdate = async () => {
    if (!editingId || !editBlock.label.trim()) return;
    if (editBlock.end_time <= editBlock.start_time) {
      setEditFormError('End time must be after start time');
      return;
    }
    setEditFormError(null);
    try {
      const res = await fetch('/api/daily-blocks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editBlock }),
      });
      if (res.ok) {
        setEditingId(null);
        loadBlocks();
      }
    } catch (err) { console.error(err); }
  };

  // Delete block
  const handleDelete = (id: string) => {
    const block = blocks.find(b => b.id === id);
    setBlocks(prev => prev.filter(b => b.id !== id));
    undoableFetchDelete(id, `/api/daily-blocks?id=${id}`, 'Block deleted', {
      onUndo: () => {
        if (block) setBlocks(prev => [...prev, block].sort((a, b) => a.start_time.localeCompare(b.start_time)));
      },
    });
  };

  const startEdit = (block: DailyBlock) => {
    setEditingId(block.id);
    setEditBlock({
      start_time: block.start_time,
      end_time: block.end_time,
      label: block.label,
      description: block.description || '',
      is_non_negotiable: block.is_non_negotiable,
    });
    setShowAddForm(false);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedBlock = blocks.find(b => b.id === active.id);
    const targetBlock = blocks.find(b => b.id === over.id);
    if (!draggedBlock || !targetBlock) return;

    // Swap time slots
    try {
      await Promise.all([
        fetch('/api/daily-blocks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draggedBlock.id, start_time: targetBlock.start_time, end_time: targetBlock.end_time }),
        }),
        fetch('/api/daily-blocks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetBlock.id, start_time: draggedBlock.start_time, end_time: draggedBlock.end_time }),
        }),
      ]);
      loadBlocks();
    } catch (err) {
      console.error('Failed to swap blocks:', err);
    }
  }

  const currentMins = currentTime ? timeToMinutes(currentTime) : -1;

  if (loading) return <div className="bg-card rounded-xl border border-border p-6 text-center text-muted">Loading calendar...</div>;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Daily Calendar</h2>
        <button
          onClick={() => {
            if (showAddForm) { setShowAddForm(false); return; }
            setNewBlock({ start_time: '09:00', end_time: '10:00', label: '', description: '', is_non_negotiable: 0 });
            setShowAddForm(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Add Block
        </button>
      </div>

      {/* Mini Timeline */}
      {blocks.length > 0 && currentTime && (
        <div className="px-5 pt-4 pb-2 border-b border-border">
          <MiniTimeline blocks={blocks} currentTime={currentTime} />
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="px-5 py-4 border-b border-border bg-blue-50/50">
          <BlockForm
            values={newBlock}
            onChange={setNewBlock}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setAddFormError(null); }}
            saveLabel="Add"
            error={addFormError}
          />
        </div>
      )}

      {/* Block list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
      <div className="divide-y divide-border/50">
        {blocks.length === 0 && !showAddForm && (
          <div className="px-5 py-8 text-center text-muted text-sm">
            No blocks scheduled. Click &quot;Add Block&quot; to plan your day.
          </div>
        )}

        {blocks.map(block => (
          <SortableBlock key={block.id} id={block.id}>
          {(dragHandleProps) => {
          const startMins = timeToMinutes(block.start_time);
          const endMins = timeToMinutes(block.end_time);
          const isPast = endMins <= currentMins;
          const isCurrent = startMins <= currentMins && currentMins < endMins;
          const isEditing = editingId === block.id;
          const durationMins = endMins - startMins;

          return (
            <div
              ref={isCurrent ? currentBlockRef : undefined}
              className={`px-5 py-3 transition-colors group ${
                isCurrent
                  ? 'bg-primary/8 border-l-4 border-l-primary'
                  : isPast
                    ? 'opacity-50'
                    : 'hover:bg-primary/5 active:bg-primary/10'
              } ${block.is_non_negotiable && !isCurrent ? 'border-l-4 border-l-primary/40' : ''}`}
            >
              {isEditing ? (
                <div onClick={e => e.stopPropagation()}>
                  <BlockForm
                    values={editBlock}
                    onChange={setEditBlock}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null); setEditFormError(null); }}
                    saveLabel="Save"
                    onDelete={() => handleDelete(block.id)}
                    error={editFormError}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => startEdit(block)}>
                  {/* Drag handle */}
                  <button {...dragHandleProps} aria-label="Drag to reorder" className="mt-2 cursor-grab active:cursor-grabbing text-muted/30 hover:text-muted touch-none" onClick={e => e.stopPropagation()}>
                    <GripVertical size={14} />
                  </button>
                  {/* Time column */}
                  <div className="w-28 shrink-0 pt-0.5">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-muted'}`}>
                      {formatTime(block.start_time)}
                    </p>
                    <p className="text-xs text-muted/60">
                      {formatTime(block.end_time)} · {durationMins >= 60 ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}` : `${durationMins}m`}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                      {block.label}
                      {block.is_non_negotiable ? <span className="ml-1.5 text-[10px] text-primary/70 font-normal">non-negotiable</span> : ''}
                    </p>
                    {block.description && (
                      <p className="text-xs text-muted mt-0.5">{block.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(block); }}
                      aria-label="Edit block"
                      className="p-1.5 rounded hover:bg-primary/10 text-primary"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(block.id); }}
                      aria-label="Delete block"
                      className="p-1.5 rounded hover:bg-red-100 text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
          }}
          </SortableBlock>
        ))}
      </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Sortable Block Wrapper ──────────────────────────────
function SortableBlock({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// ── Block Form ──────────────────────────────────────────

interface BlockFormValues {
  start_time: string;
  end_time: string;
  label: string;
  description: string;
  is_non_negotiable: number;
}

function BlockForm({
  values,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  onDelete,
  error,
}: {
  values: BlockFormValues;
  onChange: (v: BlockFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  onDelete?: () => void;
  error?: string | null;
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Block label (e.g., Deep Work, Lunch)"
        value={values.label}
        onChange={e => onChange({ ...values, label: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
        autoFocus
      />
      <div className="flex gap-2">
        <select
          value={values.start_time}
          onChange={e => onChange({ ...values, start_time: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
        >
          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
        </select>
        <span className="text-xs text-muted self-center">to</span>
        <select
          value={values.end_time}
          onChange={e => onChange({ ...values, end_time: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
        >
          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
        </select>
      </div>
      <input
        type="text"
        placeholder="Description (optional)"
        value={values.description}
        onChange={e => onChange({ ...values, description: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/50 focus:outline-none"
      />
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={values.is_non_negotiable === 1}
            onChange={e => onChange({ ...values, is_non_negotiable: e.target.checked ? 1 : 0 })}
            className="rounded"
          />
          Non-negotiable
        </label>
        <div className="flex gap-2">
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-muted">
            <X size={14} />
          </button>
          <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90">
            <Check size={14} />
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
