'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Heart, Loader2, Send } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface PhotoItem { id: number; drive_file_id: string; file_name: string; thumbnail_url: string; view_url: string }
interface Gallery { slug: string; title: string; client_name: string; max_selection: number; status: string; photos: PhotoItem[]; selection?: { selected_files: string; client_notes: string }; expires_at?: string }

const photoNameCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });

function driveThumbnail(fileID: string) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileID)}=w600`;
}

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
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number; expired: boolean } | null>(null);

  useEffect(() => {
    if (!gallery?.expires_at) return;
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(gallery.expires_at!).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, expired: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        expired: false
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, [gallery?.expires_at]);

  useEffect(() => {
    const submittedTime = localStorage.getItem(`gallery_submitted_${params.slug}`);
    if (submittedTime) {
      const submittedTimeNum = parseInt(submittedTime, 10);
      if (!isNaN(submittedTimeNum)) {
        const elapsed = Date.now() - submittedTimeNum;
        if (elapsed < 30 * 60 * 1000) {
          setSubmitted(true);
        } else {
          localStorage.removeItem(`gallery_submitted_${params.slug}`);
          window.location.href = '/';
          return;
        }
      }
    }

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
  }, [params.slug]);

  const displayedPhotos = useMemo(() => [...(gallery?.photos ?? [])]
    .filter(photo => filter === 'all' || selectedIds.includes(photo.drive_file_id))
    .sort((left, right) => photoNameCollator.compare(left.file_name, right.file_name) || left.id - right.id), [gallery, filter, selectedIds]);

  function toggleSelect(id: string) {
    if (timeLeft?.expired) {
      setError('Waktu pemilihan foto sudah habis.');
      return;
    }
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
      localStorage.setItem(`gallery_submitted_${gallery.slug}`, Date.now().toString());
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
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-glass py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6"><div><div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Galeri seleksi · {gallery.client_name}</div><h1 className="font-serif text-2xl font-semibold">{gallery.title}</h1></div><div className="flex flex-wrap items-center gap-3">{timeLeft && !submitted && <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${timeLeft.expired ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>{timeLeft.expired ? 'Waktu Habis' : `${timeLeft.days}h ${timeLeft.hours}j ${timeLeft.mins}m tersisa`}</span>}<span className="rounded-full border border-[var(--line)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold text-[var(--gold)]">{selectedIds.length} / {gallery.max_selection || '∞'} foto</span>{!submitted && <button onClick={() => setShowSubmitModal(true)} disabled={!selectedIds.length || (timeLeft?.expired ?? false)} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-40"><Send className="mr-2 inline h-3.5 w-3.5" />Kirim Pilihan</button>}</div></div></header>
      <main className="mx-auto max-w-6xl px-6 pt-8">
        {submitted ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Berhasil Terkirim</p>
            <h2 className="mt-2 font-serif text-4xl">Pilihan Foto Tersimpan</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">
              Terima kasih! {selectedIds.length} foto pilihanmu sudah berhasil dikirim ke studio dan saat ini sedang dalam antrean.
            </p>
            <div className="my-7 rounded-2xl bg-orange-50 p-6 border border-orange-200">
              <p className="font-bold text-orange-800">Menunggu Proses Editing</p>
              <p className="mt-2 text-sm text-orange-700">
                Proses editing membutuhkan waktu <strong>1–7 hari kerja</strong>. Kami akan segera menghubungi Anda melalui WhatsApp jika hasil foto sudah siap untuk diunduh.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link className="btn-secondary px-5 py-3 text-sm" href="/">Kembali ke Beranda</Link>
            </div>
          </section>
        ) : (
          <>
            {!timeLeft?.expired && (
              <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <strong>Peringatan:</strong> Batas waktu pemilihan foto adalah <strong>30 hari</strong> sejak galeri pertama kali dibuka. Harap segera mengirim pilihan Anda sebelum waktu habis, karena setelahnya Anda tidak dapat memilih lagi.
              </div>
            )}
            {timeLeft?.expired && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Waktu pemilihan sudah habis (30 hari terlewati). Kamu tidak bisa lagi mengubah atau mengirim pilihan.</div>}
            {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex gap-2"><button onClick={() => setFilter('all')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'all' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Semua ({gallery.photos.length})</button><button onClick={() => setFilter('selected')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'selected' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Dipilih ({selectedIds.length})</button></div><p className="text-xs text-[var(--muted)]">Ketuk foto untuk memilih atau membatalkan</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{displayedPhotos.map(photo => { const selected = selectedIds.includes(photo.drive_file_id); return <button type="button" key={photo.id} onClick={() => toggleSelect(photo.drive_file_id)} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-[var(--surface2)] text-left transition ${selected ? 'border-[var(--gold)]' : 'border-transparent hover:-translate-y-1'}`}><img src={driveThumbnail(photo.drive_file_id)} alt={photo.file_name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-9 text-[10px] text-white">{photo.file_name}</span><span className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-[var(--gold)] text-black' : 'bg-black/60 text-white'}`}><Heart className={`h-4 w-4 ${selected ? 'fill-black' : ''}`} /></span></button>; })}</div>
          </>
        )}
      </main>
      {showSubmitModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="font-serif text-2xl">Konfirmasi pilihan</h2><p className="mt-2 text-sm text-[var(--muted)]">Kamu memilih {selectedIds.length} foto. Pilihan masih dapat diperbarui dengan mengirim ulang sebelum galeri diarsipkan.</p><label className="mt-5 block text-xs font-bold">Catatan untuk editor</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--gold)]" placeholder="Contoh: tone hangat, hapus objek di belakang..."/><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowSubmitModal(false)} className="btn-secondary px-4 py-2.5 text-xs">Batal</button><button onClick={submitSelection} disabled={sending} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-50">{sending ? 'Mengirim...' : 'Kirim ke Studio'}</button></div></div></div>}
    </div>
  );
}
