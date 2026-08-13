'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, CheckCircle, ArrowLeft, Send } from 'lucide-react';

interface PhotoItem {
  id: string;
  fileName: string;
  url: string;
}

const SAMPLE_PHOTOS: PhotoItem[] = [
  { id: 'f1', fileName: 'WEDDING_AKAD_001.JPG', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop' },
  { id: 'f2', fileName: 'WEDDING_AKAD_008.JPG', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop' },
  { id: 'f3', fileName: 'WEDDING_RESEPSI_014.JPG', url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=800&auto=format&fit=crop' },
  { id: 'f4', fileName: 'WEDDING_RESEPSI_025.JPG', url: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=800&auto=format&fit=crop' },
  { id: 'f5', fileName: 'PREWED_COUPLE_003.JPG', url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=800&auto=format&fit=crop' },
  { id: 'f6', fileName: 'PREWED_OUTDOOR_012.JPG', url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=800&auto=format&fit=crop' },
  { id: 'f7', fileName: 'PORTRAIT_STUDIO_005.JPG', url: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop' },
  { id: 'f8', fileName: 'EVENT_MOMENT_033.JPG', url: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=800&auto=format&fit=crop' },
  { id: 'f9', fileName: 'WEDDING_RING_002.JPG', url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=800&auto=format&fit=crop' },
  { id: 'f10', fileName: 'WEDDING_FAMILY_040.JPG', url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?q=80&w=800&auto=format&fit=crop' },
];

export default function GalleryClientPage({ params }: { params: { slug: string } | Promise<{ slug: string }> }) {
  // Safe unwrap for params in Next.js 14/15
  const resolvedParams = typeof (params as any)?.then === 'function' ? (params as any).slug : (params as { slug: string }).slug;
  const [selectedIds, setSelectedIds] = useState<string[]>(['f1', 'f3', 'f9']);
  const [filter, setFilter] = useState<'all' | 'selected'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [clientName, setClientName] = useState('Anisa Putri');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const displayedPhotos = SAMPLE_PHOTOS.filter(p => {
    if (filter === 'selected') return selectedIds.includes(p.id);
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      {/* GALLERY TOP HEADER */}
      <header className="sticky top-0 z-40 bg-glass border-b border-[var(--line)] py-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">
              Galeri Seleksi Klien
            </div>
            <h1 className="font-serif text-2xl font-semibold">Album Pernikahan: Budi & Anisa</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="bg-[var(--surface2)] border border-[var(--line)] px-4 py-2 rounded-full text-xs font-semibold text-[var(--gold)]">
              Dipilih: {selectedIds.length} / 10 Foto
            </span>
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={selectedIds.length === 0}
              className="bg-[var(--gold)] text-[var(--on-gold)] font-bold text-xs px-5 py-2.5 rounded-full inline-flex items-center gap-2 hover:brightness-105 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Kirim Pilihan ({selectedIds.length})
            </button>
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      <main className="max-w-6xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-[var(--surface2)] text-[var(--gold)] border border-[var(--gold)]'
                  : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]'
              }`}
            >
              Semua Foto ({SAMPLE_PHOTOS.length})
            </button>
            <button
              onClick={() => setFilter('selected')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                filter === 'selected'
                  ? 'bg-[var(--surface2)] text-[var(--gold)] border border-[var(--gold)]'
                  : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]'
              }`}
            >
              Foto Dipilih ({selectedIds.length})
            </button>
          </div>

          <p className="text-xs text-[var(--muted)]">Tap ikon hati untuk memilih foto favorit Anda</p>
        </div>

        {/* PHOTO GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayedPhotos.map(photo => {
            const isSelected = selectedIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                onClick={() => toggleSelect(photo.id)}
                className={`relative aspect-[4/3] rounded-xl overflow-hidden bg-[var(--surface2)] cursor-pointer group border-2 transition-all ${
                  isSelected ? 'border-[var(--gold)] scale-[0.99]' : 'border-transparent hover:-translate-y-1'
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.fileName}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                  <button
                    type="button"
                    className={`self-end w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                      isSelected ? 'bg-[var(--gold)] text-black' : 'bg-black/60 text-white border border-white/40'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isSelected ? 'fill-black' : ''}`} />
                  </button>
                  <span className="text-[11px] text-white/90 truncate font-mono">{photo.fileName}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-serif text-xl font-semibold">Konfirmasi Pengiriman Seleksi</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Anda memilih <b className="text-[var(--gold)]">{selectedIds.length} foto</b> untuk diproses lebih lanjut oleh studio fotografer.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs outline-none focus:border-[var(--gold)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Catatan Tambahan (Opsional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: Edit warna foto akad lebih warm ya kak..."
                className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-xs outline-none focus:border-[var(--gold)]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-[var(--line)] hover:bg-[var(--surface2)]"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  setSubmitted(true);
                }}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--gold)] text-[var(--on-gold)] hover:brightness-105"
              >
                Kirim Hasil Seleksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
