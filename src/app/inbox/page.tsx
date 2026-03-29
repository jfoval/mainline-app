'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, ArrowRight, Mic, MicOff, Play, Search } from 'lucide-react';
import Link from 'next/link';
import { useOfflineStore, inboxStore } from '@/lib/offline';

export default function InboxPage() {
  const { data: items, create, update, remove } = useOfflineStore(inboxStore);
  const [newItem, setNewItem] = useState('');
  const [search, setSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const filteredItems = search.trim()
    ? items.filter(item => item.content.toLowerCase().includes(search.toLowerCase()))
    : items;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await create({ content: newItem.trim() });
    setNewItem('');
  }

  async function deleteItem(id: string) {
    await remove(id);
  }

  async function processItem(id: string) {
    await update({ id, status: 'processed' });
  }

  // Ref to track recognition instance so we can stop it
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');

  async function saveVoiceCapture(text: string) {
    if (!text.trim()) return;
    await create({ content: text.trim(), source: 'voice' });
  }

  function toggleVoiceCapture() {
    // If already recording, stop and save whatever we have
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
    // iOS Safari doesn't support continuous mode well — speech ends after a pause
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    transcriptRef.current = '';

    // Auto-stop after 15 seconds to prevent mic staying on forever
    const timeout = setTimeout(() => {
      try { recognition.stop(); } catch { /* already stopped */ }
    }, 15000);

    setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      transcriptRef.current = finalTranscript || interimTranscript;
      // Show what's being captured in the input field
      setNewItem(transcriptRef.current);
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
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      clearTimeout(timeout);
      setIsRecording(false);
      recognitionRef.current = null;
      // Auto-save the captured text
      if (transcriptRef.current.trim()) {
        saveVoiceCapture(transcriptRef.current);
        setNewItem('');
        transcriptRef.current = '';
      }
    };

    recognition.start();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} to process
          </p>
        </div>
        {items.length > 0 && (
          <Link
            href="/inbox/process"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <Play size={18} />
            Process Inbox
          </Link>
        )}
      </div>

      {/* Search */}
      {items.length > 5 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inbox..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      )}

      {/* Capture Input */}
      <form onSubmit={addItem} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Capture something..."
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          autoFocus
        />
        <button
          type="button"
          onClick={toggleVoiceCapture}
          className={`p-3 rounded-xl border transition-colors ${
            isRecording
              ? 'bg-red-500 text-white border-red-500 animate-pulse'
              : 'border-border bg-card hover:bg-primary/5'
          }`}
          title={isRecording ? 'Click to stop recording' : 'Voice capture'}
        >
          {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          type="submit"
          aria-label="Add to inbox"
          className="px-4 py-3 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          <Plus size={20} />
        </button>
      </form>
      {voiceError && (
        <p className="text-xs text-red-500 px-1">{voiceError}</p>
      )}

      {/* Inbox Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted">
          {search ? (
            <>
              <p className="text-lg font-medium">No matches</p>
              <p className="text-sm mt-1">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">Inbox Zero</p>
              <p className="text-sm mt-1">All clear. Capture something new or enjoy the calm.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border group hover:border-primary/30 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm">{item.content}</p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 block"
                  >
                    {item.url}
                  </a>
                )}
                <p className="text-xs text-muted mt-1">
                  {item.source !== 'manual' && `via ${item.source} · `}
                  {new Date(item.captured_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => processItem(item.id)}
                  className="p-2 rounded-lg hover:bg-success/10 text-success"
                  title="Mark processed"
                >
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 rounded-lg hover:bg-danger/10 text-danger"
                  title="Delete"
                  aria-label="Delete item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
