'use client';

import { useState } from 'react';
import { Bot, Sun, Target, MessageSquare, Loader2, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';

type Tab = 'briefing' | 'prioritize' | 'chat';

export default function AIPage() {
  const [tab, setTab] = useState<Tab>('briefing');
  const [error, setError] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [prioritizeLoading, setPrioritizeLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Briefing state
  const [briefing, setBriefing] = useState<string | null>(null);

  // Prioritize state
  const [priorities, setPriorities] = useState<{ top3?: Array<{ task: string; why: string }>; revenue_focus?: string; suggestion?: string } | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Derived loading state for current tab
  const loading = tab === 'briefing' ? briefingLoading : tab === 'prioritize' ? prioritizeLoading : chatLoading;

  async function callAI(action: string, setLoading: (v: boolean) => void, data?: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        return null;
      }
      return result;
    } catch {
      setError('Failed to connect to AI.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function getMorningBriefing() {
    const result = await callAI('morning_briefing', setBriefingLoading);
    if (result) setBriefing(result.briefing);
  }

  async function getPriorities() {
    const result = await callAI('prioritize', setPrioritizeLoading);
    if (result) setPriorities(result);
  }

  async function sendChatMessage(question: string) {
    if (!question.trim()) return;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: question.trim() }]);
    const result = await callAI('ask', setChatLoading, { question: question.trim() });
    if (result) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    await sendChatMessage(chatInput);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles size={24} className="text-primary" /> AI Assistant
          </h1>
          <p className="text-sm text-muted mt-1">Powered by Claude. Your productivity copilot.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card rounded-xl p-1 border border-border">
        {([
          ['briefing', 'Morning Briefing', Sun],
          ['prioritize', 'Prioritize Day', Target],
          ['chat', 'Ask Claude', MessageSquare],
        ] as [Tab, string, typeof Sun][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          {error.includes('API key') && (
            <Link href="/settings" className="ml-2 text-primary hover:underline">Go to Settings</Link>
          )}
        </div>
      )}

      {/* Morning Briefing */}
      {tab === 'briefing' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sun size={24} className="text-amber-500" />
            <div>
              <h2 className="text-lg font-semibold">Morning Briefing</h2>
              <p className="text-sm text-muted">AI scans your system and generates a daily briefing.</p>
            </div>
          </div>
          {briefing ? (
            <div className="p-4 rounded-lg bg-background text-sm leading-relaxed whitespace-pre-wrap">
              {briefing}
            </div>
          ) : (
            <button
              onClick={getMorningBriefing}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sun size={16} />}
              Generate Briefing
            </button>
          )}
          {briefing && (
            <button onClick={() => setBriefing(null)} className="mt-3 text-xs text-muted hover:text-foreground">
              Regenerate
            </button>
          )}
        </div>
      )}

      {/* Prioritize Day */}
      {tab === 'prioritize' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target size={24} className="text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Prioritize Today</h2>
              <p className="text-sm text-muted">AI applies your Revenue Priority Stack to recommend Top 3.</p>
            </div>
          </div>
          {priorities ? (
            <div className="space-y-4">
              {priorities.revenue_focus && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 uppercase mb-1">Revenue Focus</p>
                  <p className="text-sm">{priorities.revenue_focus}</p>
                </div>
              )}
              {priorities.top3 && (
                <div className="space-y-2">
                  {priorities.top3.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-background">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.task}</p>
                        <p className="text-xs text-muted mt-0.5">{item.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {priorities.suggestion && (
                <p className="text-sm">{priorities.suggestion}</p>
              )}
            </div>
          ) : (
            <button
              onClick={getPriorities}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              Get Today's Priorities
            </button>
          )}
          {priorities && (
            <button onClick={() => setPriorities(null)} className="mt-3 text-xs text-muted hover:text-foreground">
              Regenerate
            </button>
          )}
        </div>
      )}

      {/* Chat */}
      {tab === 'chat' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col" style={{ height: '500px' }}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bot size={20} /> Ask Claude
            </h2>
            <p className="text-xs text-muted">Your productivity assistant. Knows your projects, actions, and system.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center text-muted text-sm py-8">
                <Bot size={32} className="mx-auto mb-3 opacity-30" />
                <p>Ask me anything about your productivity system.</p>
                <div className="mt-4 space-y-2">
                  {[
                    'What should I focus on today?',
                    'Which projects are stalled?',
                    'Help me think through my priorities',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { sendChatMessage(q); }}
                      className="block mx-auto text-xs text-primary hover:underline"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-background border border-border rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-xl bg-background border border-border rounded-bl-sm">
                  <Loader2 size={16} className="animate-spin text-muted" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={sendChat} className="p-4 border-t border-border flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask your productivity assistant..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !chatInput.trim()}
              className="px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
