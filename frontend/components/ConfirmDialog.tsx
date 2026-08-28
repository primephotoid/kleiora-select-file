'use client';

import { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Hapus', cancelLabel = 'Batal', danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-t-[2rem] border border-white/60 bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,.25)] sm:rounded-[2rem] sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
            {danger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]" aria-label="Tutup dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="confirm-dialog-title" className="mt-5 font-serif text-3xl font-semibold leading-tight">{title}</h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} autoFocus className="btn-secondary px-6 py-3 text-sm">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--text)] hover:opacity-90'}`}>
            {danger && <Trash2 className="h-4 w-4" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
