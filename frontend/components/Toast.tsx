'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2.5rem)] pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleManualDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  };

  const styles = {
    success: 'border-emerald-200/80 bg-white text-gray-900 shadow-lg shadow-emerald-950/5',
    error: 'border-red-200/80 bg-white text-gray-900 shadow-lg shadow-red-950/5',
    info: 'border-blue-200/80 bg-white text-gray-900 shadow-lg shadow-blue-950/5',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-medium backdrop-blur-xl transition-all duration-300 ${styles[toast.type]} ${
        exiting ? 'opacity-0 translate-y-[-10px] scale-95' : 'animate-in fade-in slide-in-from-top-4 duration-300 opacity-100 translate-y-0 scale-100'
      }`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        {icons[toast.type]}
        <span className="leading-snug">{toast.message}</span>
      </div>
      <button
        onClick={handleManualDismiss}
        className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
        aria-label="Tutup notifikasi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
