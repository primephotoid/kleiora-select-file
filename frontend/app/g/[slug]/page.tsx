'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, ChevronRight, Heart, Info, Lock, Loader2, RotateCcw, Send, X, ZoomIn, ZoomOut } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface PhotoItem { id: number; drive_file_id: string; file_name: string; thumbnail_url: string; view_url: string }
interface Gallery { slug: string; title: string; client_name: string; max_selection: number; status: string; photos: PhotoItem[]; selection?: { selected_files: string; client_notes: string }; expires_at?: string }

const photoNameCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });
const PAGE_SIZE = 24;

function driveThumbnail(fileID: string, width = 400) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileID)}=w${width}`;
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
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewImageLoading, setPreviewImageLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number; expired: boolean } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Touch Swipe State for Lightbox
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Infinite Scroll Observer Ref
  const observerTarget = useRef<HTMLDivElement | null>(null);

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
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [gallery?.expires_at]);

  useEffect(() => {
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

  useEffect(() => {
    if (!previewPhoto) return;
    setPreviewZoom(1);
    setPreviewImageLoading(true);
    setSwipeOffset(0);

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewPhoto(null);
      if (event.key === 'ArrowRight') showAdjacentPhoto(1);
      if (event.key === 'ArrowLeft') showAdjacentPhoto(-1);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [previewPhoto]);

  const displayedPhotos = useMemo(() => [...(gallery?.photos ?? [])]
    .filter(photo => filter === 'all' || selectedIds.includes(photo.drive_file_id))
    .sort((left, right) => photoNameCollator.compare(left.file_name, right.file_name) || left.id - right.id), [gallery, filter, selectedIds]);

  const visiblePhotos = useMemo(() => displayedPhotos.slice(0, visibleCount), [displayedPhotos, visibleCount]);

  // Reset pagination when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, displayedPhotos.length));
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [displayedPhotos.length]);

  // Fast Swipe: Preload adjacent images in lightbox
  useEffect(() => {
    if (!previewPhoto || !displayedPhotos.length) return;
    const currentIndex = displayedPhotos.findIndex(photo => photo.id === previewPhoto.id);
    if (currentIndex === -1) return;

    const indicesToPreload = [
      (currentIndex + 1) % displayedPhotos.length,
      (currentIndex + 2) % displayedPhotos.length,
      (currentIndex - 1 + displayedPhotos.length) % displayedPhotos.length,
      (currentIndex - 2 + displayedPhotos.length) % displayedPhotos.length,
    ];

    indicesToPreload.forEach(idx => {
      const p = displayedPhotos[idx];
      if (p) {
        const img = new Image();
        img.src = driveThumbnail(p.drive_file_id, 1600);
      }
    });
  }, [previewPhoto, displayedPhotos]);

  const showAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (!previewPhoto || !displayedPhotos.length) return;
    const currentIndex = displayedPhotos.findIndex(photo => photo.id === previewPhoto.id);
    const nextIndex = (currentIndex + direction + displayedPhotos.length) % displayedPhotos.length;
    setPreviewPhoto(displayedPhotos[nextIndex]);
  }, [previewPhoto, displayedPhotos]);

  // Touch Swipe Handlers for Mobile Lightbox
  const handleTouchStart = (e: React.TouchEvent) => {
    if (previewZoom > 1) return; // Allow zoom pan instead of swipe when zoomed in
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (previewZoom > 1 || touchStartX.current === null) return;
    touchEndX.current = e.touches[0].clientX;
    const deltaX = touchEndX.current - touchStartX.current;
    setSwipeOffset(deltaX);
  };

  const handleTouchEnd = () => {
    if (previewZoom > 1 || touchStartX.current === null || touchEndX.current === null) {
      setSwipeOffset(0);
      return;
    }
    const diff = touchStartX.current - touchEndX.current;
    const swipeThreshold = 50;
    if (diff > swipeThreshold) {
      showAdjacentPhoto(1);
    } else if (diff < -swipeThreshold) {
      showAdjacentPhoto(-1);
    }
    touchStartX.current = null;
    touchEndX.current = null;
    setSwipeOffset(0);
  };

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
      setSubmitted(true);
      setShowSubmitModal(false);
      setGallery(prev => prev ? { ...prev, status: 'submitted' } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pilihan gagal dikirim.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]"><Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" /></div>;
  if (!gallery) return <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--bg)] px-6 text-center"><h1 className="font-serif text-4xl">Galeri tidak ditemukan</h1><p className="text-sm text-[var(--muted)]">{error || 'Periksa kembali link yang diberikan studio.'}</p><Link href="/" className="btn-secondary px-5 py-3">Kembali</Link></div>;

  const isSubmittedState = submitted || (gallery.status === 'submitted');

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-glass py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6"><div><div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Galeri seleksi · {gallery.client_name}</div><h1 className="font-serif text-2xl font-semibold">{gallery.title}</h1></div><div className="flex flex-wrap items-center gap-3">{timeLeft && !isSubmittedState && <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${timeLeft.expired ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>{timeLeft.expired ? 'Waktu Habis' : `${timeLeft.days}h ${timeLeft.hours}j ${timeLeft.mins}m tersisa`}</span>}<span className="rounded-full border border-[var(--line)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold text-[var(--gold)]">{selectedIds.length} / {gallery.max_selection || '∞'} foto</span>{!isSubmittedState && <button onClick={() => setShowSubmitModal(true)} disabled={!selectedIds.length || (timeLeft?.expired ?? false)} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-40"><Send className="mr-2 inline h-3.5 w-3.5" />Kirim Pilihan</button>}</div></div></header>
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
        ) : gallery.status === 'submitted' ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10">
            <Lock className="mx-auto h-14 w-14 text-[var(--gold-dark)]" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Akses Terkunci</p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Pilihan Foto Sudah Dikirim</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">
              Link galeri ini sudah tidak aktif karena pilihan foto telah berhasil dikirim ke studio sebelumnya.
            </p>
            <div className="my-7 rounded-2xl bg-amber-50 p-6 border border-amber-200 text-left">
              <p className="font-bold text-amber-900 flex items-center gap-2"><Info className="h-4 w-4 text-amber-700" /> Butuh Mengubah Pilihan Foto?</p>
              <p className="mt-2 text-sm text-amber-800">
                Jika Anda perlu mengubah pilihan foto, silakan hubungi admin <strong>Kleiora.grads</strong> via WhatsApp agar akses galeri dapat dikirim ulang / dibuka kembali.
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
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex gap-2"><button onClick={() => setFilter('all')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'all' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Semua ({gallery.photos.length})</button><button onClick={() => setFilter('selected')} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === 'selected' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Dipilih ({selectedIds.length})</button></div><p className="text-xs text-[var(--muted)]">Ketuk foto untuk memilih · usap/geser foto pada preview untuk pindah</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visiblePhotos.map(photo => {
                const selected = selectedIds.includes(photo.drive_file_id);
                return (
                  <div key={photo.id} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-[var(--surface2)] text-left transition ${selected ? 'border-[var(--gold)]' : 'border-transparent hover:-translate-y-1'}`}>
                    <button type="button" onClick={() => toggleSelect(photo.drive_file_id)} className="absolute inset-0 h-full w-full text-left" aria-label={`${selected ? 'Batalkan pilihan' : 'Pilih'} ${photo.file_name}`}>
                      <img src={driveThumbnail(photo.drive_file_id, 400)} alt={photo.file_name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-9 text-[10px] text-white">{photo.file_name}</span>
                      <span className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-[var(--gold)] text-black' : 'bg-black/60 text-white'}`}><Heart className={`h-4 w-4 ${selected ? 'fill-black' : ''}`} /></span>
                    </button>
                    <button type="button" onClick={() => setPreviewPhoto(photo)} className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80" aria-label={`Perbesar ${photo.file_name}`} title="Perbesar foto"><ZoomIn className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Sentinel Target */}
            <div ref={observerTarget} className="mt-8 flex justify-center py-6">
              {visibleCount < displayedPhotos.length && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-xs font-semibold text-[var(--muted)] shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--gold-dark)]" />
                  <span>Memuat foto lainnya ({visiblePhotos.length} / {displayedPhotos.length})...</span>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Lightbox Preview Modal with Fast Preloaded Swiping */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Preview ${previewPhoto.file_name}`} onMouseDown={event => event.target === event.currentTarget && setPreviewPhoto(null)}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{previewPhoto.file_name}</p>
              <p className="text-[11px] text-white/60">Usap layar/geser tombol untuk berpindah foto cepat</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setPreviewZoom(value => Math.max(1, value - .25))} disabled={previewZoom <= 1} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30" aria-label="Perkecil"><ZoomOut className="h-4 w-4" /></button>
              <span className="hidden w-14 text-center text-xs sm:block">{Math.round(previewZoom * 100)}%</span>
              <button type="button" onClick={() => setPreviewZoom(value => Math.min(4, value + .25))} disabled={previewZoom >= 4} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30" aria-label="Perbesar"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={() => setPreviewZoom(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
              <button type="button" onClick={() => setPreviewPhoto(null)} className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:bg-white/80" aria-label="Tutup preview"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={event => { event.preventDefault(); setPreviewZoom(value => Math.min(4, Math.max(1, value + (event.deltaY < 0 ? .25 : -.25)))); }}
          >
            <button type="button" onClick={() => showAdjacentPhoto(-1)} className="fixed left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 hover:bg-black/80 sm:left-6" aria-label="Foto sebelumnya"><ChevronLeft className="h-6 w-6" /></button>

            {previewImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" />
              </div>
            )}

            <img
              key={previewPhoto.id}
              src={driveThumbnail(previewPhoto.drive_file_id, 1600)}
              alt={previewPhoto.file_name}
              draggable={false}
              referrerPolicy="no-referrer"
              onLoad={() => setPreviewImageLoading(false)}
              onDoubleClick={() => setPreviewZoom(value => value === 1 ? 2 : 1)}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out z-10"
              style={{ transform: `scale(${previewZoom}) translateX(${swipeOffset}px)` }}
            />

            <button type="button" onClick={() => showAdjacentPhoto(1)} className="fixed right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 hover:bg-black/80 sm:right-6" aria-label="Foto berikutnya"><ChevronRight className="h-6 w-6" /></button>
          </div>
          <div className="flex items-center justify-center border-t border-white/10 px-4 py-3">
            <button type="button" onClick={() => toggleSelect(previewPhoto.drive_file_id)} disabled={timeLeft?.expired ?? false} className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition disabled:opacity-40 ${selectedIds.includes(previewPhoto.drive_file_id) ? 'bg-[var(--gold)] text-black' : 'bg-white text-black hover:bg-white/90'}`}>
              <Heart className={`h-4 w-4 ${selectedIds.includes(previewPhoto.drive_file_id) ? 'fill-black' : ''}`} />
              {selectedIds.includes(previewPhoto.drive_file_id) ? 'Batalkan pilihan' : 'Pilih foto ini'}
            </button>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <h2 className="font-serif text-2xl">Konfirmasi pilihan</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Kamu memilih {selectedIds.length} foto. Setelah dikirim, link galeri akan terkunci.</p>
            <label className="mt-5 block text-xs font-bold">Catatan untuk editor</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--gold)]" placeholder="Contoh: tone hangat, hapus objek di belakang..." />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="btn-secondary px-4 py-2.5 text-xs">Batal</button>
              <button onClick={submitSelection} disabled={sending} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold text-[var(--on-gold)] disabled:opacity-50">{sending ? 'Mengirim...' : 'Kirim ke Studio'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

