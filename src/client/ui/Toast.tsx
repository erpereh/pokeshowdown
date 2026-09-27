"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: string;
  message: string;
}

const listeners = new Set<(toast: ToastItem) => void>();

export function pushToast(message: string) {
  const toast = { id: crypto.randomUUID(), message };
  for (const listener of listeners) listener(toast);
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (toast: ToastItem) => {
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="assertive">
      {toasts.map((toast) => (
        <p key={toast.id} role="status" className="glass pointer-events-auto max-w-md rounded-[var(--radius-card)] px-4 py-3 text-sm shadow-[0_12px_40px_#00000066]">
          {toast.message}
        </p>
      ))}
    </div>
  );
}
