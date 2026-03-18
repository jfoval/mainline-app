'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Inbox, CheckSquare, FolderKanban, Clock, AlertTriangle,
  DollarSign, Users, ArrowRight,
  Mic, MicOff, Check
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  is_girls_week: boolean;
  day_name: string;
  routine_type: string;
  current_time: string;
  current_block: { id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number } | null;
  next_block: { id: string; start_time: string; end_time: string; label: string; description: string } | null;
  blocks: Array<{ id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number }>;
  today_theme: string | null;
  inbox_count: number;
  action_counts: Record<string, number>;
  total_actions: number;
  active_project_count: number;
  stalled_projects: Array<{ id: string; title: string; category: string }>;
  revenue: {
    focus: string;
    priority_level: number;
    active_deals: Array<{ company: string; stage: string; next_action: string | null; value: string | null }>;
    warm_leads: Array<{ name: string; company: string | null }>;
    building_now: Array<{ name: string; build_status: string | null }>;
    ready_to_sell: Array<{ name: string }>;
  };
  daily_note: { top3_revenue: string | null; top3_second: string | null; top3_third: string | null } | null;
  stale_waiting: Array<{ content: string; waiting_on_person: string | null; waiting_since: string }>;
  client_actions: Array<{ content: string; title: string }>;
}

const DASHBOARD_CACHE_KEY = 'gtd_dashboard_cache';

function cacheDashboard(data: DashboardData) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch { /* localStorage full or unavailable */ }
}

function getCachedDashboard(): { data: DashboardData; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const [staleCache, setStaleCache] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'listening' | 'saved'>('idle');
  const [interimText, setInterimText] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const [displayDate, setDisplayDate] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const now = new Date();
    setDisplayDate(format(now, 'EEEE, MMMM d, yyyy'));
    const hour = now.getHours();
    if (hour < 12) setGreeting('morning');
    else if (hour < 17) setGreeting('afternoon');
    else setGreeting('evening');
  }, []);

  const toggleVoiceCapture = useCallback(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert('Voice capture is not supported in this browser. Try Safari or Chrome.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // iOS Safari doesn't support continuous mode well — speech ends after a pause
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    transcriptRef.current = '';
    setInterimText('');

    const timeout = setTimeout(() => {
      try { recognition.stop(); } catch { /* already stopped */ }
    }, 15000);

    setIsRecording(true);
    setCaptureStatus('listening');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Save both final and interim — iOS may never mark results as final
      transcriptRef.current = finalTranscript || interim;
      setInterimText(finalTranscript || interim);
    };

    recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error:', event.error);
      // "no-speech" just means silence — not fatal
      if (event.error === 'no-speech') return;
      // "not-allowed" means permission denied
      if (event.error === 'not-allowed') {
        alert('Microphone or Speech Recognition permission denied. Check System Settings > Privacy & Security > Speech Recognition, and make sure Safari has access.');
      }
      clearTimeout(timeout);
      setIsRecording(false);
      setCaptureStatus('idle');
      setInterimText('');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      clearTimeout(timeout);
      setIsRecording(false);
      recognitionRef.current = null;
      const text = transcriptRef.current.trim();
      if (text) {
        fetch('/api/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text, source: 'voice' }),
        }).then(() => {
          setCaptureStatus('saved');
          setInterimText('');
          setTimeout(() => setCaptureStatus('idle'), 2000);
          // Re-fetch dashboard to get accurate inbox count
          fetch('/api/dashboard')
            .then(r => r.ok ? r.json() : null)
            .then((d: DashboardData | null) => { if (d) { setData(d); cacheDashboard(d); } });
        }).catch(() => {
          setCaptureStatus('idle');
          setInterimText('');
        });
      } else {
        setCaptureStatus('idle');
        setInterimText('');
      }
    };

    recognition.start();
  }, [isRecording]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error('API error'); return r.json(); })
      .then((d: DashboardData) => {
        setData(d);
        setStaleCache(null);
        cacheDashboard(d);
      })
      .catch(() => {
        // Try to show cached data
        const cached = getCachedDashboard();
        if (cached) {
          setData(cached.data);
          setStaleCache(cached.cachedAt);
        } else {
          setError(true);
        }
      });
  }, []);

  if (error) return (
    <div className="max-w-5xl mx-auto p-6 text-center">
      <p className="text-danger font-medium">Failed to load dashboard.</p>
      <button onClick={() => { setError(false); fetch('/api/dashboard').then(r => r.json()).then((d: DashboardData) => { setData(d); cacheDashboard(d); }).catch(() => setError(true)); }} className="mt-3 px-4 py-2 rounded-lg bg-primary text-white text-sm">Retry</button>
    </div>
  );

  if (!data) return <div className="max-w-5xl mx-auto p-6">Loading...</div>;

  const currentBlockIndex = data.blocks.findIndex(b => b.id === data.current_block?.id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Stale cache banner */}
      {staleCache && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-amber-700">
            Showing cached data from {Math.round((Date.now() - staleCache) / 60000)} min ago. You appear to be offline.
          </p>
          <button
            onClick={() => {
              fetch('/api/dashboard')
                .then(r => r.json())
                .then((d: DashboardData) => { setData(d); setStaleCache(null); cacheDashboard(d); })
                .catch(() => {});
            }}
            className="text-sm text-amber-600 hover:text-amber-800 font-medium underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting ? `Good ${greeting}, John` : 'Foval GTD'}</h1>
          <p className="text-muted mt-1">{displayDate}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              data.is_girls_week ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {data.is_girls_week ? 'Girls Week' : 'Non-Girls Week'}
            </span>
          </div>
        </div>

        {/* Quick Voice Capture */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={toggleVoiceCapture}
            className={`p-3 rounded-full transition-all ${
              captureStatus === 'saved'
                ? 'bg-green-500 text-white'
                : isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-primary text-white hover:bg-primary/90'
            }`}
            title={isRecording ? 'Tap to stop & save' : 'Quick capture to inbox'}
          >
            {captureStatus === 'saved' ? <Check size={22} /> : isRecording ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {captureStatus === 'saved' && (
            <span className="text-xs text-green-600 font-medium">Saved to inbox</span>
          )}
          {isRecording && (
            <span className="text-xs text-red-500 font-medium max-w-[160px] truncate">
              {interimText || 'Listening...'}
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(data.inbox_count > 10 || data.stalled_projects.length > 0 || data.stale_waiting.length > 0) && (
        <div className="space-y-2">
          {data.inbox_count > 10 && (
            <Link href="/inbox" className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={18} className="text-amber-600" />
              <p className="text-sm text-amber-700">Inbox has {data.inbox_count} items — time to process.</p>
            </Link>
          )}
          {data.stalled_projects.length > 0 && (
            <Link href="/projects" className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={18} className="text-red-600" />
              <p className="text-sm text-red-700">
                {data.stalled_projects.length} stalled project{data.stalled_projects.length > 1 ? 's' : ''}:{' '}
                {data.stalled_projects.map(p => p.title).join(', ')}
              </p>
            </Link>
          )}
          {data.stale_waiting.length > 0 && (
            <Link href="/actions?context=waiting_for" className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <Clock size={18} className="text-yellow-600" />
              <p className="text-sm text-yellow-700">
                {data.stale_waiting.length} @waiting-for item{data.stale_waiting.length > 1 ? 's' : ''} older than 7 days — follow up needed.
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/inbox" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data.inbox_count > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Inbox size={20} className={data.inbox_count > 0 ? 'text-amber-600' : 'text-green-600'} />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.inbox_count}</p>
              <p className="text-xs text-muted">Inbox</p>
            </div>
          </div>
        </Link>

        <Link href="/actions" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <CheckSquare size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.action_counts.work || 0}</p>
              <p className="text-xs text-muted">@Work</p>
            </div>
          </div>
        </Link>

        <Link href="/projects" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <FolderKanban size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.active_project_count}</p>
              <p className="text-xs text-muted">Projects</p>
            </div>
          </div>
        </Link>

        <Link href="/actions?context=waiting_for" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Users size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.action_counts.waiting_for || 0}</p>
              <p className="text-xs text-muted">Waiting</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Now / Up Next */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-5 border-2 border-primary">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-primary" />
            <h2 className="font-semibold text-primary">Now</h2>
          </div>
          {data.current_block ? (
            <>
              <p className="text-xl font-bold">{data.current_block.label}</p>
              <p className="text-sm text-muted mt-1">
                {data.current_block.start_time} - {data.current_block.end_time}
              </p>
              {data.current_block.description && (
                <p className="text-sm mt-2 text-foreground/70">{data.current_block.description}</p>
              )}
              {data.current_block.is_non_negotiable === 1 && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium">Non-negotiable</span>
              )}
            </>
          ) : (
            <p className="text-xl font-bold">Sleep</p>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight size={18} className="text-muted" />
            <h2 className="font-semibold text-muted">Up Next</h2>
          </div>
          {data.next_block ? (
            <>
              <p className="text-lg font-bold">{data.next_block.label}</p>
              <p className="text-sm text-muted mt-1">
                {data.next_block.start_time} - {data.next_block.end_time}
              </p>
              {data.next_block.description && (
                <p className="text-sm mt-2 text-foreground/70">{data.next_block.description}</p>
              )}
            </>
          ) : (
            <p className="text-lg font-bold text-muted">{data.current_block ? 'Nothing scheduled' : 'Sleep'}</p>
          )}
        </div>
      </div>

      {/* Revenue Focus */}
      <Link href="/pipeline" className="bg-card rounded-xl p-5 border border-border hover:border-primary transition-colors block">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={18} className="text-primary" />
          <h2 className="font-semibold">Revenue Focus</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.revenue.active_deals.length}</p>
            <p className="text-xs text-muted">Active Deals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.revenue.warm_leads.length}</p>
            <p className="text-xs text-muted">Warm Leads</p>
          </div>
        </div>

        {/* Today's Top 3 */}
        {data.daily_note && (data.daily_note.top3_revenue || data.daily_note.top3_second || data.daily_note.top3_third) && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted mb-2">Today&apos;s Top 3</p>
            <div className="space-y-1">
              {data.daily_note.top3_revenue && (
                <p className="text-sm"><span className="text-primary font-medium">1. Revenue:</span> {data.daily_note.top3_revenue}</p>
              )}
              {data.daily_note.top3_second && (
                <p className="text-sm"><span className="font-medium">2.</span> {data.daily_note.top3_second}</p>
              )}
              {data.daily_note.top3_third && (
                <p className="text-sm"><span className="font-medium">3.</span> {data.daily_note.top3_third}</p>
              )}
            </div>
          </div>
        )}

        {!data.daily_note?.top3_revenue && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border text-sm text-primary">
            <ArrowRight size={14} />
            Set today&apos;s Top 3 in Morning Process
          </div>
        )}
      </Link>

      {/* Context List Summary */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h2 className="font-semibold mb-4">Context Lists ({data.total_actions} total)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'work', label: '@Work' },
            { key: 'errands', label: '@Errands' },
            { key: 'home', label: '@Home' },
            { key: 'waiting_for', label: '@Waiting For' },
            { key: 'agendas', label: '@Agendas' },
            { key: 'haley', label: '@Haley' },
            { key: 'prayers', label: '@Prayers' },
          ].map(ctx => (
            <Link
              key={ctx.key}
              href={`/actions?context=${ctx.key}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-background hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm">{ctx.label}</span>
              <span className="text-sm font-bold text-muted">{data.action_counts[ctx.key] || 0}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h2 className="font-semibold mb-4">Full Schedule</h2>
        <div className="space-y-1">
          {data.blocks.map((block, i) => {
            const isCurrent = i === currentBlockIndex;
            const isPast = i < currentBlockIndex;

            return (
              <div
                key={block.id}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-primary/10 border border-primary/30'
                    : isPast
                      ? 'opacity-40'
                      : ''
                }`}
              >
                <span className="text-xs text-muted w-24 shrink-0 pt-0.5">
                  {block.start_time} - {block.end_time}
                </span>
                <div>
                  <p className={`text-sm font-medium ${block.is_non_negotiable ? 'text-primary' : ''}`}>
                    {block.label}
                    {block.is_non_negotiable ? ' *' : ''}
                  </p>
                  {block.description && (
                    <p className="text-xs text-muted mt-0.5">{block.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

