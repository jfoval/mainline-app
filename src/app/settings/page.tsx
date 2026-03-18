'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, LogOut, Database, Download } from 'lucide-react';

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', data: { question: 'Say "Connected!" in one word.' } }),
      });
      const data = await res.json();
      if (data.error) {
        setTestResult(`Error: ${data.error}`);
      } else {
        setTestResult('Connected! AI assistant is working.');
      }
    } catch {
      setTestResult('Error: Could not reach the AI API.');
    }
    setTesting(false);
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtd-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
    setExporting(false);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-muted mb-8">Configure your GTD system.</p>

      {/* Claude API Key Status */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Claude API Key</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          API key is configured via environment variable (ANTHROPIC_API_KEY).
        </p>

        <button
          onClick={testConnection}
          disabled={testing}
          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <p className={`text-sm mt-2 ${testResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {testResult}
          </p>
        )}
      </div>

      {/* AI Features Info */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-3">AI Features</h2>
        <p className="text-sm text-muted mb-4">With your API key connected, you get:</p>
        <div className="space-y-3">
          {[
            { title: 'Smart Inbox Processing', desc: 'AI suggests how to route each inbox item through the GTD decision tree.' },
            { title: 'Morning Briefing', desc: 'Daily summary of what needs attention, stalled projects, revenue focus.' },
            { title: 'Day Prioritization', desc: 'AI applies your Revenue Priority Stack to recommend Top 3 tasks.' },
            { title: 'Recovery Workflow', desc: 'AI-guided re-engagement when you fall off the system.' },
            { title: 'GTD Assistant', desc: 'Ask questions about your system, get advice on processing, planning.' },
          ].map(feature => (
            <div key={feature.title} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-xs text-muted">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Database</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Your data is hosted on Neon Postgres with automatic backups and point-in-time recovery.
        </p>
        <button
          onClick={exportData}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : 'Export Data as JSON'}
        </button>
      </div>

      {/* Account */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <LogOut size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
