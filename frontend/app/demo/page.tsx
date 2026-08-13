'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Heart, Sparkles, ArrowRight } from 'lucide-react';

export default function DemoPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'photo' | 'memories'>('photo');
  const [driveUrl, setDriveUrl] = useState('https://drive.google.com/drive/folders/1demo_wedding_album_2026');
  const [loading, setLoading] = useState(false);

  const handleMulaiDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setLoading(true);
    setTimeout(() => {
      router.push('/g/wedding-budi-anisa');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] color-[var(--text)] pt-32 pb-24">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="text-xs font-bold tracking-widest uppercase text-[var(--gold)] mb-3">
            Kleiora Grads · Live Sandbox Demo
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-medium mb-4">
            Coba langsung dengan fotomu sendiri
          </h1>
          <p className="text-[var(--muted)] text-sm sm:text-base leading-relaxed">
            Tempel link folder Google Drive kamu. Semua fitur bisa dicoba secara gratis — dan tidak ada yang tersimpan secara permanen.
          </p>
        </div>

        {/* MODE SELECTOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`p-6 rounded-2xl border text-left transition-all ${
              mode === 'photo'
                ? 'border-[var(--gold)] bg-[var(--surface2)]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--gold-dim)]'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--gold)] flex items-center justify-center mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base flex items-center gap-2 mb-1">
              Mode Pilih Foto
              <span className="text-[10px] font-semibold uppercase text-[var(--gold)] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Fotografer
              </span>
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Seperti yang dilihat klienmu: pilih foto, tap zoom, dan rekap daftarnya siap dikirim.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('memories')}
            className={`p-6 rounded-2xl border text-left transition-all ${
              mode === 'memories'
                ? 'border-[var(--gold)] bg-[var(--surface2)]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--gold-dim)]'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--gold)] flex items-center justify-center mb-4">
              <Heart className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base flex items-center gap-2 mb-1">
              Mode Kenangan
              <span className="text-[10px] font-semibold uppercase text-[var(--gold)] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Memories
              </span>
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Album kenangan cantik ala majalah digital untuk disimpan & dibagikan ke keluarga.
            </p>
          </button>
        </div>

        {/* INPUT PANEL */}
        <form onSubmit={handleMulaiDemo} className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6 sm:p-8">
          <label className="block text-sm font-semibold mb-2">Link folder Google Drive kamu</label>
          <input
            type="text"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[var(--gold)] transition-colors mb-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--gold)] text-[var(--on-gold)] font-bold text-sm py-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-105 transition-all shadow-md"
          >
            {loading ? 'Mengurai Google Drive...' : 'Mulai Demo Live'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs text-[var(--muted)] mt-4 text-center">
            Folder harus di-set <b>publik</b> ("Siapa saja yang memiliki link").
          </p>
        </form>

        <div className="mt-8 text-center text-sm text-[var(--muted)]">
          Suka demonya?{' '}
          <Link href="/dashboard" className="text-[var(--gold)] font-semibold hover:underline">
            Buat Galeri Kamu Sekarang →
          </Link>
        </div>
      </div>
    </div>
  );
}
