'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Inbox, CheckSquare, FolderKanban, Clock, AlertTriangle,
  Users, ArrowRight, CheckCircle, BookOpen,
  Mic, MicOff, Check, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DailyCalendar from '@/components/DailyCalendar';
import { formatTime, timeToMinutes } from '@/lib/time-utils';

interface DashboardData {
  date: string;
  day_name: string;
  pattern_name: string | null;
  current_time: string;
  current_block: { id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number } | null;
  next_block: { id: string; start_time: string; end_time: string; label: string; description: string } | null;
  blocks: Array<{ id: string; start_time: string; end_time: string; label: string; description: string; is_non_negotiable: number }>;
  inbox_count: number;
  action_counts: Record<string, number>;
  total_actions: number;
  active_project_count: number;
  stalled_projects: Array<{ id: string; title: string; category: string }>;
  daily_note: { top3_first: string | null; top3_second: string | null; top3_third: string | null } | null;
  stale_waiting: Array<{ content: string; waiting_on_person: string | null; waiting_since: string }>;
  inbox_threshold: number;
  waiting_days: number;
  days_since_weekly_review: number | null;
  do_differently_today: string | null;
  disciplines_done: number;
  disciplines_total: number;
  discipline_items: Array<{ id: string; name: string; completed: boolean }>;
}

const DASHBOARD_CACHE_KEY = 'mainline_dashboard_cache';

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
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const [staleCache, setStaleCache] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'listening' | 'saved'>('idle');
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [displayDate] = useState(() => format(new Date(), 'EEEE, MMMM d, yyyy'));
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  });

  const toggleVoiceCapture = useCallback(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    setVoiceError(null);
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceError('Voice capture is not supported in this browser. Try Safari or Chrome.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      transcriptRef.current = finalTranscript || interim;
      setInterimText(finalTranscript || interim);
    };

    recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        clearTimeout(timeout);
        return;
      }
      if (event.error === 'not-allowed') {
        setVoiceError('Microphone permission denied. Check System Settings → Privacy & Security → Speech Recognition.');
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

  const refreshDashboard = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    fetch('/api/dashboard')
      .then(r => { if (r.ok) return r.json(); throw new Error(); })
      .then((d: DashboardData) => { setData(d); cacheDashboard(d); })
      .catch(() => {})
      .finally(() => { setRefreshing(false); refreshingRef.current = false; });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      switch (e.key.toLowerCase()) {
        case 'v': e.preventDefault(); toggleVoiceCapture(); break;
        case 'i': e.preventDefault(); router.push('/inbox'); break;
        case 'a': e.preventDefault(); router.push('/actions'); break;
        case 'p': e.preventDefault(); router.push('/projects'); break;
        case 'w': e.preventDefault(); router.push('/actions?context=waiting_for'); break;
        case 'r': e.preventDefault(); refreshDashboard(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVoiceCapture, router, refreshDashboard]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error('API error'); return r.json(); })
      .then((d: DashboardData) => {
        setData(d);
        setStaleCache(null);
        cacheDashboard(d);
      })
      .catch(() => {
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
    <div className="max-w-6xl mx-auto p-6 text-center">
      <p className="text-danger font-medium">Failed to load dashboard.</p>
      <button onClick={() => { setError(false); fetch('/api/dashboard').then(r => r.json()).then((d: DashboardData) => { setData(d); cacheDashboard(d); }).catch(() => setError(true)); }} className="mt-3 px-4 py-2 rounded-lg bg-primary text-white text-sm">Retry</button>
    </div>
  );

  if (!data) return <div className="max-w-6xl mx-auto p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{greeting ? `Good ${greeting}` : 'Dashboard'}</h1>
            <button
              onClick={refreshDashboard}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-primary/5 transition-colors disabled:opacity-50"
              title="Refresh dashboard (R)"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <p className="text-muted mt-1">{displayDate}</p>
          {data.pattern_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mt-2">
              {data.pattern_name}
            </span>
          )}
        </div>

        {/* Quick Voice Capture */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={toggleVoiceCapture}
            className={`p-3 rounded-xl border transition-colors ${
              captureStatus === 'saved'
                ? 'bg-green-500 text-white border-green-500'
                : isRecording
                  ? 'bg-red-500 text-white border-red-500 motion-safe:animate-pulse'
                  : 'border-border bg-card hover:bg-primary/5'
            }`}
            title={isRecording ? 'Tap to stop & save (V)' : 'Quick capture to inbox (V)'}
            aria-label={isRecording ? 'Stop recording and save' : 'Voice capture to inbox'}
          >
            {captureStatus === 'saved' ? <Check size={20} /> : isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            {captureStatus === 'idle' && !isRecording && <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono">V</kbd>}
          </button>
          {captureStatus === 'saved' ? (
            <span className="text-xs text-green-600 font-medium">Saved to inbox</span>
          ) : isRecording ? (
            <span className="text-xs text-red-500 font-medium max-w-[300px] sm:max-w-[400px] line-clamp-2">
              {interimText || 'Listening...'}
            </span>
          ) : voiceError ? (
            <span className="text-xs text-red-500 font-medium max-w-[260px] text-right">{voiceError}</span>
          ) : null}
        </div>
      </div>

      {/* Alerts */}
      {(() => {
        const inboxThreshold = data.inbox_threshold || 10;
        const waitingDays = data.waiting_days || 7;
        const reviewOverdue = data.days_since_weekly_review === null || data.days_since_weekly_review > 7;
        const hasAlerts = data.inbox_count > inboxThreshold || data.stalled_projects.length > 0 || data.stale_waiting.length > 0 || reviewOverdue;
        return (
          <div className="space-y-2">
            {hasAlerts ? (
              <>
                {data.inbox_count > inboxThreshold && (
                  <Link href="/inbox" className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">Inbox has {data.inbox_count} items — time to process.</p>
                  </Link>
                )}
                {data.stalled_projects.length > 0 && (
                  <Link href="/projects" className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">
                      {data.stalled_projects.length} stalled project{data.stalled_projects.length > 1 ? 's' : ''}:{' '}
                      {data.stalled_projects.map(p => p.title).join(', ')}
                    </p>
                  </Link>
                )}
                {data.stale_waiting.length > 0 && (
                  <Link href="/actions?context=waiting_for" className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                    <Clock size={18} className="text-yellow-600 shrink-0" />
                    <p className="text-sm text-yellow-700">
                      {data.stale_waiting.length} @waiting-for item{data.stale_waiting.length > 1 ? 's' : ''} older than {waitingDays} days — follow up needed.
                    </p>
                  </Link>
                )}
                {reviewOverdue && (
                  <Link href="/review" className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                    <BookOpen size={18} className="text-indigo-600 shrink-0" />
                    <p className="text-sm text-indigo-700">
                      {data.days_since_weekly_review === null
                        ? 'Weekly review not yet completed — start one to keep your system current.'
                        : `Weekly review is overdue — last completed ${data.days_since_weekly_review} days ago.`}
                    </p>
                  </Link>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle size={18} className="text-green-600 shrink-0" />
                <p className="text-sm text-green-700">All clear — your system is clean.</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/inbox" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data.inbox_count > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Inbox size={20} className={data.inbox_count > 0 ? 'text-amber-600' : 'text-green-600'} />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.inbox_count}</p>
              <p className="text-xs text-muted">Inbox <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono ml-0.5">I</kbd></p>
            </div>
          </div>
        </Link>

        <Link href="/actions" className="bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <CheckSquare size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.total_actions}</p>
              <p className="text-xs text-muted">Actions <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono ml-0.5">A</kbd></p>
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
              <p className="text-xs text-muted">Projects <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono ml-0.5">P</kbd></p>
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
              <p className="text-xs text-muted">Waiting <kbd className="text-[10px] px-1 py-0.5 rounded bg-background/50 text-muted font-mono ml-0.5">W</kbd></p>
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
                {formatTime(data.current_block.start_time)} – {formatTime(data.current_block.end_time)}
                {' · '}
                {(() => {
                  const remaining = timeToMinutes(data.current_block.end_time) - timeToMinutes(data.current_time);
                  if (remaining <= 0) return 'ending';
                  if (remaining < 60) return `${remaining}m left`;
                  const h = Math.floor(remaining / 60);
                  const m = remaining % 60;
                  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
                })()}
              </p>
              {data.current_block.description && (
                <p className="text-sm mt-2 text-foreground/70">{data.current_block.description}</p>
              )}
            </>
          ) : (
            <p className="text-xl font-bold">Free time</p>
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
                {formatTime(data.next_block.start_time)} – ends {formatTime(data.next_block.end_time)}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-muted">Nothing scheduled</p>
          )}
        </div>
      </div>

      {/* Today's Top 3 */}
      {data.daily_note && (data.daily_note.top3_first || data.daily_note.top3_second || data.daily_note.top3_third) ? (
        <div className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-semibold mb-3">Today&apos;s Top 3</h2>
          <div className="space-y-1">
            {data.daily_note.top3_first && (
              <p className="text-sm"><span className="text-primary font-medium">1.</span> {data.daily_note.top3_first}</p>
            )}
            {data.daily_note.top3_second && (
              <p className="text-sm"><span className="font-medium">2.</span> {data.daily_note.top3_second}</p>
            )}
            {data.daily_note.top3_third && (
              <p className="text-sm"><span className="font-medium">3.</span> {data.daily_note.top3_third}</p>
            )}
          </div>
        </div>
      ) : (
        <Link href="/process" className="bg-card rounded-xl p-5 border border-border hover:border-primary transition-colors block">
          <div className="flex items-center gap-2 text-sm text-primary">
            <ArrowRight size={14} />
            Set today&apos;s Top 3 in Morning Process
          </div>
        </Link>
      )}

      {/* Do Differently Today (from yesterday's shutdown) */}
      {data.do_differently_today && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 truncate">
          <span className="font-medium">Do differently today:</span> {data.do_differently_today}
        </div>
      )}

      {/* Disciplines Checkmarks */}
      {data.discipline_items && data.discipline_items.length > 0 && (
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Disciplines</h2>
            <span className="text-sm font-medium text-primary">
              {data.disciplines_done}/{data.disciplines_total}
            </span>
          </div>
          <div className="space-y-1.5">
            {data.discipline_items.map(d => (
              <button
                key={d.id}
                onClick={async () => {
                  const newCompleted = !d.completed;
                  // Optimistic update
                  setData(prev => {
                    if (!prev) return prev;
                    const items = prev.discipline_items.map(item =>
                      item.id === d.id ? { ...item, completed: newCompleted } : item
                    );
                    return {
                      ...prev,
                      discipline_items: items,
                      disciplines_done: items.filter(i => i.completed).length,
                    };
                  });
                  // Persist
                  const today = new Date().toISOString().slice(0, 10);
                  await fetch('/api/disciplines/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discipline_id: d.id, date: today, completed: newCompleted ? 1 : 0 }),
                  });
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  d.completed ? 'bg-green-50 border border-green-200' : 'bg-background border border-border hover:border-primary/30'
                }`}
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                  d.completed ? 'bg-green-500' : 'border-2 border-border'
                }`}>
                  {d.completed && <Check size={12} className="text-white" />}
                </span>
                <span className={`text-sm ${d.completed ? 'line-through text-muted' : 'text-foreground'}`}>
                  {d.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h2 className="font-semibold mb-4">Next Actions ({data.total_actions} total)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.action_counts).map(([key, count]) => (
            <Link
              key={key}
              href={`/actions?context=${key}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-background hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm">@{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              <span className="text-sm font-bold text-muted">{count}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Daily Calendar */}
      <DailyCalendar date={data.date} />
    </div>
  );
}
