'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Sun, Moon, Image as ImageIcon } from 'lucide-react';

export default function HomePage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] color-[var(--text)] transition-colors duration-300">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-glass border-b border-[var(--line)] py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight flex items-center gap-1.5 text-[var(--text)]">
            Kleiora <span className="text-[var(--gold)]">Grads</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[var(--muted)]">
            <Link href="/" className="text-[var(--gold)]">Memories</Link>
            <Link href="/g/wedding-budi-anisa" className="hover:text-[var(--gold)] transition-colors">Galeri Klien</Link>
            <Link href="/dashboard" className="hover:text-[var(--gold)] transition-colors">Dashboard Studio</Link>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--surface2)] flex items-center justify-center text-[var(--text)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              href="/dashboard"
              className="bg-[var(--gold)] text-[var(--on-gold)] font-bold text-sm px-5 py-2.5 rounded-full inline-flex items-center gap-2 hover:brightness-105 hover:-translate-y-0.5 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Buat Galeri
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="pt-36 pb-24 text-center relative overflow-hidden bg-radial-gradient">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl sm:text-6xl font-medium leading-tight mb-6">
            Pilih foto <span className="italic gold-gradient-text">kamu sekarang.</span>
          </h1>

          <p className="text-[var(--muted)] text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Pilih foto tanpa ribet dan lebih praktis
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="bg-[var(--gold)] text-[var(--on-gold)] font-bold text-base px-8 py-4 rounded-full inline-flex items-center gap-2 hover:brightness-105 hover:-translate-y-0.5 transition-all shadow-md"
            >
              <Sparkles className="w-5 h-5" />
              Buat Galeri Sekarang
            </Link>

            <Link
              href="/g/wedding-budi-anisa"
              className="border-1.5 border-[var(--line)] text-[var(--text)] font-bold text-base px-7 py-3.5 rounded-full inline-flex items-center gap-2 hover:border-[var(--gold)] hover:bg-[var(--surface2)] transition-all"
            >
              Lihat Galeri Klien
            </Link>
          </div>
        </div>
      </header>

      {/* FEATURES / CARA KERJA */}
      <section className="py-24 bg-[var(--surface2)] border-y border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <div className="text-xs font-bold tracking-widest uppercase text-[var(--gold)] mb-2">Cara Kerja</div>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium">3 Langkah Mudah, Selesai</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 hover:border-[var(--gold)] transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-[var(--surface2)] border border-[var(--gold)] text-[var(--gold)] font-serif text-xl font-bold flex items-center justify-center mb-6">
                1
              </div>
              <h3 className="text-lg font-bold mb-3">Tempel Link Google Drive</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Set folder foto kamu sebagai "Siapa saja yang memiliki link", lalu tempel tautannya. Tanpa perlu upload ulang.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 hover:border-[var(--gold)] transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-[var(--surface2)] border border-[var(--gold)] text-[var(--gold)] font-serif text-xl font-bold flex items-center justify-center mb-6">
                2
              </div>
              <h3 className="text-lg font-bold mb-3">Bagikan Galeri ke Klien</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Kleiora Grads akan otomatis menyusun galeri foto interaktif yang cepat, responsif, dan terlihat sangat profesional.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 hover:border-[var(--gold)] transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-[var(--surface2)] border border-[var(--gold)] text-[var(--gold)] font-serif text-xl font-bold flex items-center justify-center mb-6">
                3
              </div>
              <h3 className="text-lg font-bold mb-3">Terima Rekap Seleksi</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Klien memilih foto favoritnya. Kamu langsung mendapatkan daftar nama file yang rapi untuk diproses di Lightroom.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-[var(--line)] text-center text-sm text-[var(--muted)]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-extrabold text-lg text-[var(--text)]">Kleiora <span className="text-[var(--gold)]">Grads</span></div>
          <div>© 2026 Kleiora Grads — Next.js + Golang Architecture</div>
        </div>
      </footer>
    </div>
  );
}
