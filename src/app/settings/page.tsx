'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Key, LogOut, Database, Download, Upload, Sun, Moon, Palette, Bell, BellOff } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem('mainline-notifications') === 'true');
  }, []);

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

      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${theme === 'light' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-primary/5'}`}
          >
            <Sun size={16} />
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-primary/5'}`}
          >
            <Moon size={16} />
            Dark
          </button>
        </div>
      </div>

      {/* Notifications */}
      {'Notification' in globalThis && (
        <div className="bg-card rounded-xl border border-border p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <p className="text-sm text-muted mb-4">
            Get reminded when your inbox is overflowing or projects are stalled. Quiet hours: 9pm-7am.
          </p>
          <button
            onClick={async () => {
              if (notificationsEnabled) {
                localStorage.setItem('mainline-notifications', 'false');
                setNotificationsEnabled(false);
              } else {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  localStorage.setItem('mainline-notifications', 'true');
                  setNotificationsEnabled(true);
                  // Persist to server
                  fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notification_enabled: 'true' }),
                  }).catch(() => {});
                }
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
              notificationsEnabled
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border hover:bg-primary/5'
            }`}
          >
            {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
          </button>
        </div>
      )}

      {/* Database */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Database</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Your data is hosted on Neon Postgres with automatic backups and point-in-time recovery.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportData}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export Data as JSON'}
          </button>
          <label className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={14} />
            {importing ? 'Importing...' : 'Import from JSON'}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportResult(null);
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  if (!data.version || !data.tables) {
                    setImportResult('Error: Invalid backup file format.');
                    return;
                  }
                  const tableCount = Object.keys(data.tables).length;
                  const confirmed = window.confirm(
                    `Import backup from ${data.exported_at?.slice(0, 10) || 'unknown date'}?\n\nThis will replace ALL current data (${tableCount} tables). This cannot be undone.\n\nContinue?`
                  );
                  if (!confirmed) return;
                  setImporting(true);
                  const res = await fetch('/api/backup/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: text,
                  });
                  const result = await res.json();
                  if (result.success) {
                    setImportResult(`Imported ${result.rows_imported} rows across ${result.tables_imported} tables.`);
                  } else {
                    setImportResult(`Error: ${result.error}`);
                  }
                } catch {
                  setImportResult('Error: Could not read file.');
                }
                setImporting(false);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {importResult && (
          <p className={`text-sm mt-3 ${importResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {importResult}
          </p>
        )}
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
