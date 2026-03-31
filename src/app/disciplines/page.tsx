'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Target,
  Compass,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Loader2,
  Flame,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useUndoableAction } from '@/lib/toast';
import { todayStr } from '@/lib/date-utils';

interface Discipline {
  id: string;
  name: string;
  type: 'discipline' | 'value';
  description: string | null;
  frequency: string;
  time_of_day: string;
  is_active: number;
  sort_order: number;
}

interface DisciplineStats {
  discipline_id: string;
  name: string;
  type: string;
  streak: number;
  week_completed: number;
  week_rate: number;
  month_completed: number;
  month_rate: number;
}

interface DisciplineLog {
  id: string;
  discipline_id: string;
  date: string;
  completed: number;
  notes: string | null;
}

export default function DisciplinesPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [stats, setStats] = useState<DisciplineStats[]>([]);
  const [todayLogs, setTodayLogs] = useState<DisciplineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'manage'>('overview');

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'discipline' | 'value'>('discipline');
  const [formDescription, setFormDescription] = useState('');
  const [formFrequency, setFormFrequency] = useState('daily');
  const [saving, setSaving] = useState(false);
  const { undoableFetchDelete } = useUndoableAction();

  const load = useCallback(async () => {
    try {
      const [discRes, statsRes, logsRes] = await Promise.all([
        fetch('/api/disciplines?include_inactive=1'),
        fetch('/api/disciplines/stats'),
        fetch(`/api/disciplines/logs?date=${todayStr()}`),
      ]);

      const discData = await discRes.json();
      setDisciplines(Array.isArray(discData) ? discData : []);

      const statsData = await statsRes.json();
      setStats(Array.isArray(statsData) ? statsData : []);

      const logsData = await logsRes.json();
      setTodayLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      console.error('Failed to load disciplines', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName('');
    setFormType('discipline');
    setFormDescription('');
    setFormFrequency('daily');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (d: Discipline) => {
    setFormName(d.name);
    setFormType(d.type);
    setFormDescription(d.description || '');
    setFormFrequency(d.frequency);
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let res: Response;
      if (editingId) {
        res = await fetch('/api/disciplines', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            name: formName.trim(),
            type: formType,
            description: formDescription.trim() || null,
            frequency: formFrequency,
            time_of_day: 'shutdown',
          }),
        });
      } else {
        res = await fetch('/api/disciplines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            type: formType,
            description: formDescription.trim() || null,
            frequency: formFrequency,
            time_of_day: 'shutdown',
          }),
        });
      }
      if (!res.ok) { console.error('Failed to save discipline'); return; }
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const discipline = disciplines.find(d => d.id === id);
    setDisciplines(prev => prev.filter(d => d.id !== id));
    undoableFetchDelete(id, `/api/disciplines?id=${id}`, 'Discipline deleted', {
      onUndo: () => {
        if (discipline) setDisciplines(prev => [...prev, discipline]);
      },
      onSettled: () => load(),
    });
  };

  const handleToggleActive = async (d: Discipline) => {
    await fetch('/api/disciplines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, is_active: d.is_active === 1 ? 0 : 1 }),
    });
    await load();
  };

  const toggleTodayLog = async (disciplineId: string) => {
    const existing = todayLogs.find(l => l.discipline_id === disciplineId);
    const newCompleted = existing?.completed === 1 ? 0 : 1;
    const previousLogs = [...todayLogs];

    // Update local state optimistically
    if (existing) {
      setTodayLogs(todayLogs.map(l =>
        l.discipline_id === disciplineId ? { ...l, completed: newCompleted } : l
      ));
    } else {
      setTodayLogs([...todayLogs, {
        id: 'temp',
        discipline_id: disciplineId,
        date: todayStr(),
        completed: newCompleted,
        notes: null,
      }]);
    }

    fetch('/api/disciplines/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discipline_id: disciplineId,
        date: todayStr(),
        completed: newCompleted,
      }),
    }).catch(() => {
      setTodayLogs(previousLogs);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  const activeDisciplines = disciplines.filter(d => d.is_active === 1 && d.type === 'discipline');
  const activeValues = disciplines.filter(d => d.is_active === 1 && d.type === 'value');
  const inactiveItems = disciplines.filter(d => d.is_active === 0);

  const todayCompleted = todayLogs.filter(l => l.completed === 1).length;
  const todayTotal = activeDisciplines.length + activeValues.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disciplines &amp; Values</h1>
          <p className="text-muted mt-1">Track your daily habits and aspirational values.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'overview' ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:bg-background'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'manage' ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:bg-background'
            }`}
          >
            Manage
          </button>
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          {/* Today's Progress */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Today&apos;s Progress</h2>
              <span className="text-sm font-medium text-primary">
                {todayCompleted}/{todayTotal} done
              </span>
            </div>

            {todayTotal === 0 ? (
              <p className="text-muted text-sm">No active disciplines or values. Add some in the Manage tab.</p>
            ) : (
              <div className="w-full h-2 rounded-full bg-border overflow-hidden mb-4">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: todayTotal > 0 ? `${(todayCompleted / todayTotal) * 100}%` : '0%' }}
                />
              </div>
            )}

            {/* Disciplines checklist */}
            {activeDisciplines.length > 0 && (
              <div className="space-y-2 mb-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                  <Target size={12} /> Disciplines
                </h3>
                {activeDisciplines.map(d => {
                  const log = todayLogs.find(l => l.discipline_id === d.id);
                  const done = log?.completed === 1;
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleTodayLog(d.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        done ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' : 'bg-background border border-border hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-green-500' : 'border-2 border-border'
                      }`}>
                        {done && <Check size={12} className="text-white" />}
                      </span>
                      <span className={`text-sm ${done ? 'line-through text-muted' : 'text-foreground'}`}>
                        {d.name}
                      </span>
                      {d.description && (
                        <span className="text-xs text-muted ml-auto hidden sm:block">{d.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Values checklist */}
            {activeValues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                  <Compass size={12} /> Values
                </h3>
                {activeValues.map(d => {
                  const log = todayLogs.find(l => l.discipline_id === d.id);
                  const done = log?.completed === 1;
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleTodayLog(d.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        done ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' : 'bg-background border border-border hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-green-500' : 'border-2 border-border'
                      }`}>
                        {done && <Check size={12} className="text-white" />}
                      </span>
                      <span className={`text-sm ${done ? 'line-through text-muted' : 'text-foreground'}`}>
                        {d.name}
                      </span>
                      {d.description && (
                        <span className="text-xs text-muted ml-auto hidden sm:block">{d.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div className="bg-card rounded-xl p-5 border border-border">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 size={18} /> Streaks &amp; Progress
              </h2>
              <div className="space-y-3">
                {stats.map(s => (
                  <div key={s.discipline_id} className="flex items-center gap-4 px-3 py-2 rounded-lg bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.type === 'value' ? 'Value' : 'Discipline'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5" title="Current streak">
                        <Flame size={14} className={s.streak > 0 ? 'text-orange-500' : 'text-muted'} />
                        <span className="font-medium">{s.streak}d</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="7-day rate">
                        <TrendingUp size={14} className="text-blue-500" />
                        <span className="font-medium">{s.week_rate}%</span>
                      </div>
                      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden" title={`${s.month_rate}% this month`}>
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${s.month_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manage Tab */}
          <div className="flex justify-end">
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors"
            >
              <Plus size={16} /> Add Discipline or Value
            </button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-foreground">
                {editingId ? 'Edit' : 'New'} {formType === 'value' ? 'Value' : 'Discipline'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="e.g. Workout 45 min"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as 'discipline' | 'value')}
                    className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="discipline">Discipline (concrete habit)</option>
                    <option value="value">Value (aspirational)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-muted mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Brief description or reminder..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={e => setFormFrequency(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-background flex items-center gap-2 font-medium transition-colors"
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active Disciplines */}
          {activeDisciplines.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target size={16} /> Disciplines ({activeDisciplines.length})
              </h3>
              <div className="space-y-2">
                {activeDisciplines.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      {d.description && <p className="text-xs text-muted">{d.description}</p>}
                      <p className="text-xs text-muted mt-0.5">
                        {d.frequency}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(d)} className="p-1.5 rounded hover:bg-card transition-colors" title="Edit" aria-label="Edit discipline">
                        <Edit3 size={14} className="text-muted" />
                      </button>
                      <button onClick={() => handleToggleActive(d)} className="p-1.5 rounded hover:bg-card transition-colors" title="Deactivate" aria-label="Deactivate discipline">
                        <X size={14} className="text-muted" />
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-card transition-colors" title="Delete" aria-label="Delete discipline">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Values */}
          {activeValues.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Compass size={16} /> Values ({activeValues.length})
              </h3>
              <div className="space-y-2">
                {activeValues.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      {d.description && <p className="text-xs text-muted">{d.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(d)} className="p-1.5 rounded hover:bg-card transition-colors" title="Edit" aria-label="Edit discipline">
                        <Edit3 size={14} className="text-muted" />
                      </button>
                      <button onClick={() => handleToggleActive(d)} className="p-1.5 rounded hover:bg-card transition-colors" title="Deactivate" aria-label="Deactivate discipline">
                        <X size={14} className="text-muted" />
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-card transition-colors" title="Delete" aria-label="Delete discipline">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inactive items */}
          {inactiveItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 opacity-60">
              <h3 className="font-semibold text-foreground mb-3">Inactive ({inactiveItems.length})</h3>
              <div className="space-y-2">
                {inactiveItems.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted">{d.name}</p>
                    </div>
                    <button
                      onClick={() => handleToggleActive(d)}
                      className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Reactivate
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-card transition-colors" title="Delete">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {disciplines.length === 0 && !showForm && (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <Target size={48} className="mx-auto text-muted mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No disciplines yet</h3>
              <p className="text-muted text-sm mb-4">
                Add disciplines (concrete habits) and values (aspirational statements) to track daily.
              </p>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors mx-auto"
              >
                <Plus size={16} /> Add Your First Discipline
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
