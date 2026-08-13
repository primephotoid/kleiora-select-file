'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Heart, Loader2, Send } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface PhotoItem { id: number; drive_file_id: string; file_name: string; thumbnail_url: string; view_url: string }
interface Gallery { slug: string; title: string; client_name: string; max_selection: number; status: string; photos: PhotoItem[]; selection?: { selected_files: string; client_notes: string } }

export default function GalleryClientPage({ params }: { params: { slug: string } }) {
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'selected'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    apiRequest<Gallery>(`/galleries/${params.slug}`)
      .then(data => {
        setGallery(data);
        setNotes(data.selection?.client_notes ?? '');
        if (data.selection?.selected_files) {
          try {
            const filenames = JSON.parse(data.selection.selected_files) as string[];
            setSelectedIds(data.photos.filter(photo => filenames.includes(photo.file_name)).map(photo => photo.drive_file_id));
          } catch { /* Ignore malformed legacy selection. */ }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => document.documentElement.setAttribute('data-theme', previousTheme ?? 'light');
  }, [params.slug]);

  const displayedPhotos = useMemo(() => (gallery?.photos ?? []).filter(photo => filter === 'all' || selectedIds.includes(photo.drive_file_id)), [gallery, filter, selectedIds]);

  function toggleSelect(id: string) {
    setError('');
    setSelectedIds(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (gallery?.max_selection && current.length >= gallery.max_selection) {
        setError(`Maksimal pilihan untuk paket ini adalah ${gallery.max_selection} foto.`);
        return current;
      }
      return [...current, id];
    });
  }

  async function submitSelection() {
    if (!gallery) return;
    setSending(true);
    setError('');
    try {
      await apiRequest(`/galleries/${gallery.slug}/select`, { method: 'POST', body: JSON.stringify({ selected_files: selectedIds, client_notes: notes }) });
      setSubmitted(true);
      setShowSubmitModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pilihan gagal dikirim.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]"><Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" /></div>;
  if (!gallery) return <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--bg)] px-6 text-center"><h1 className="font-serif text-4xl">Galeri tidak ditemukan</h1><p className="text-sm text-[var(--muted)]">{error || 'Periksa kembali link yang diberikan studio.'}</p><Link href="/" className="btn-secondary px-5 py-3">Kembali</Link></div>;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-glass py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6"><div><div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Galeri seleksi · {gallery.client_name}</div><h1 className="font-serif text-2xl font-semibold">{gallery.title}</h1></div><div className="flex items-center gap-3"><span className="rounded-full border border-[var(--line)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold text-[var(--gold)]">{selectedIds.length} / {gallery.max_selection || '∞'} foto</span><button onClick={() => setShowSubmitModal(true)} disabled={!selectedIds.length} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-40"><Send className="mr-2 inline h-3.5 w-3.5" />Kirim Pilihan</button></div></div></header>
      <main className="mx-auto max-w-6xl px-6 pt-8">
        {submitted && <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5" />Pilihanmu sudah tersimpan dan dapat dilihat oleh studio.</div>}
        {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex gap-2"><button onClick={() => setFilter('all')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'all' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Semua ({gallery.photos.length})</button><button onClick={() => setFilter('selected')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'selected' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Dipilih ({selectedIds.length})</button></div><p className="text-xs text-[var(--muted)]">Ketuk foto untuk memilih atau membatalkan</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{displayedPhotos.map(photo => { const selected = selectedIds.includes(photo.drive_file_id); return <button type="button" key={photo.id} onClick={() => toggleSelect(photo.drive_file_id)} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-[var(--surface2)] text-left transition ${selected ? 'border-[var(--gold)]' : 'border-transparent hover:-translate-y-1'}`}><img src={photo.thumbnail_url} alt={photo.file_name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-9 text-[10px] text-white">{photo.file_name}</span><span className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-[var(--gold)] text-black' : 'bg-black/60 text-white'}`}><Heart className={`h-4 w-4 ${selected ? 'fill-black' : ''}`} /></span></button>; })}</div>
      </main>
      {showSubmitModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="font-serif text-2xl">Konfirmasi pilihan</h2><p className="mt-2 text-sm text-[var(--muted)]">Kamu memilih {selectedIds.length} foto. Pilihan masih dapat diperbarui dengan mengirim ulang sebelum galeri diarsipkan.</p><label className="mt-5 block text-xs font-bold">Catatan untuk editor</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--gold)]" placeholder="Contoh: tone hangat, hapus objek di belakang..."/><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowSubmitModal(false)} className="btn-secondary px-4 py-2.5 text-xs">Batal</button><button onClick={submitSelection} disabled={sending} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-50">{sending ? 'Mengirim...' : 'Kirim ke Studio'}</button></div></div></div>}
    </div>
  );
}
