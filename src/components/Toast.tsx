'use client';

import { Undo2, X } from 'lucide-react';
import { useToast } from '@/lib/toast/ToastContext';

export default function ToastContainer() {
  const { toasts, dismissToast, undoToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+8rem)] z-50 flex flex-col gap-2 items-center pointer-events-none"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="alert"
          aria-live="assertive"
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl shadow-lg animate-[toast-slide-up_0.2s_ease-out]"
        >
          <span className="text-sm text-foreground">{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => undoToast(toast.id)}
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <Undo2 size={14} />
              Undo
            </button>
          )}
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="text-muted hover:text-foreground transition-colors ml-1"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
