'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'problem';
}

interface ToastApi {
  /** Confirms what just happened, in the same words as the button that did it. */
  confirm: (message: string) => void;
  problem: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({ confirm: () => {}, problem: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      confirm: (message) => push(message, 'ok'),
      problem: (message) => push(message, 'problem'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg bg-navy px-3.5 py-3 text-sm text-white shadow-pop"
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                toast.tone === 'ok' ? 'bg-grass' : 'bg-status-accident'
              }`}
            >
              {toast.tone === 'ok' ? <Check size={13} strokeWidth={3} /> : <TriangleAlert size={12} />}
            </span>
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="text-white/60 hover:text-white"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
