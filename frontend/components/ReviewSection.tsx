'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Star, X, Check, Loader2 } from 'lucide-react';
import { API_BASE_URL, ReviewItem } from '@/lib/api';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export function ReviewSection({ initialReviews }: { initialReviews: ReviewItem[] }) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client_name: '', rating: 5, comment: '' });

  useBodyScrollLock(showForm);

  useEffect(() => {
    let active = true;
    const refreshReviews = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/reviews`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { reviews?: ReviewItem[] };
        if (active) setReviews(data.reviews || []);
      } catch { /* Pertahankan data awal saat koneksi sementara bermasalah. */ }
    };
    const handleFocus = () => refreshReviews();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshReviews();
    };
    refreshReviews();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mengirim ulasan');
      }
    } catch {
      setError('Terjadi kesalahan koneksi. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  }

  function closeReviewForm() {
    if (submitting) return;
    setShowForm(false);
    setSuccess(false);
    setError('');
    setForm({ client_name: '', rating: 5, comment: '' });
  }

  return (
    <section id="reviews" className="bg-[var(--surface)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Testimoni</p>
            <h2 className="mt-3 font-serif text-4xl font-medium">Apa kata mereka?</h2>
          </div>
          <button onClick={() => { setSuccess(false); setError(''); setShowForm(true); }} className="btn-secondary px-6 py-3 text-sm">Tulis Ulasan</button>
        </div>

        {reviews.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map(r => (
              <div key={r.id} className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="mb-4 flex text-[var(--gold)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-current' : 'text-gray-300'}`} />
                  ))}
                </div>
                <p className="mb-6 text-sm leading-relaxed text-gray-700">"{r.comment}"</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface2)] font-serif font-bold text-[var(--gold-dark)]">
                    {r.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{r.client_name}</h4>
                    <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface2)] p-12 text-center text-[var(--muted)]">
            <MessageCircle className="mx-auto h-12 w-12 text-[var(--gold)]" />
            <p className="mt-4 text-sm">Belum ada ulasan yang ditampilkan.</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && closeReviewForm()}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-serif text-2xl">{success ? 'Ulasan Terkirim' : 'Bagikan Pengalamanmu'}</h3>
              <button onClick={closeReviewForm} disabled={submitting} className="rounded-full bg-gray-100 p-2 hover:bg-gray-200 disabled:opacity-50" aria-label="Tutup"><X className="h-4 w-4" /></button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4"><Check className="h-8 w-8" /></div>
                <h4 className="text-xl font-bold">Terima kasih!</h4>
                <p className="mt-2 text-sm text-gray-600">Ulasan Anda telah berhasil dikirim.</p>
                <button type="button" onClick={closeReviewForm} className="btn-primary mt-7 w-full py-3.5 text-sm">Selesai</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Tutup pesan"><X className="h-4 w-4" /></button></div>}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">Nama Lengkap</label>
                  <input required value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface2)] px-4 py-3 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-glow)]" placeholder="Tulis namamu..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">Penilaian</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => setForm({ ...form, rating: star })} className={`p-1 ${star <= form.rating ? 'text-[var(--gold)]' : 'text-gray-300'}`}>
                        <Star className="h-8 w-8 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">Komentar</label>
                  <textarea required value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface2)] px-4 py-3 text-sm min-h-[100px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-glow)]" placeholder="Bagaimana pengalaman serumu bersama kami?" />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 mt-2">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Kirim Ulasan'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
