'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Check } from 'lucide-react';

interface Horizon {
  id: string;
  type: string;
  content: string;
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

export default function HorizonsPage() {
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const fetchHorizons = useCallback(async () => {
    const res = await fetch('/api/horizons');
    const data: Horizon[] = await res.json();
    setHorizons(data);
    const initial: Record<string, string> = {};
    data.forEach(h => { initial[h.id] = h.content; });
    setEdits(initial);
  }, []);

  useEffect(() => { fetchHorizons(); }, [fetchHorizons]);

  async function saveHorizon(id: string) {
    await fetch('/api/horizons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: edits[id] }),
    });
    setSaved(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Horizons of Focus</h1>
        <p className="text-sm text-muted mt-1">GTD altitude map — from your purpose down to daily ground-level actions.</p>
      </div>

      <div className="space-y-6">
        {horizons.map(horizon => {
          const meta = HORIZON_META[horizon.type] || { label: horizon.type, description: '', icon: '📌' };
          const hasChanges = edits[horizon.id] !== horizon.content;

          return (
            <div key={horizon.id} className="bg-card rounded-xl border border-border overflow-hidden">
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
                    onClick={() => saveHorizon(horizon.id)}
                    disabled={!hasChanges && !saved[horizon.id]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      saved[horizon.id]
                        ? 'bg-green-100 text-green-700'
                        : hasChanges
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-muted/10 text-muted cursor-default'
                    }`}
                  >
                    {saved[horizon.id] ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
                  </button>
                </div>
              </div>
              <textarea
                value={edits[horizon.id] || ''}
                onChange={e => setEdits(prev => ({ ...prev, [horizon.id]: e.target.value }))}
                placeholder={`Write about your ${meta.label.toLowerCase()}...`}
                className="w-full px-5 py-4 bg-card focus:outline-none min-h-[120px] text-sm leading-relaxed resize-y"
                rows={6}
              />
              {horizon.updated_at && (
                <div className="px-5 py-2 border-t border-border text-xs text-muted">
                  Last updated: {new Date(horizon.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
