'use client';

import Link from 'next/link';
import { Menu, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--surface-glass)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-serif text-3xl font-semibold tracking-tight">
          Kleiora<span className="text-[var(--gold)]">.grads</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--muted)] md:flex">
          <Link href="/#packages" className="hover:text-[var(--text)]">Paket & Harga</Link>
          <Link href="/#process" className="hover:text-[var(--text)]">Cara Booking</Link>
          <Link href="/#portfolio" className="hover:text-[var(--text)]">Portfolio</Link>
          <Link href="/booking" className="hover:text-[var(--text)]">Booking</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <a href="https://wa.me/6285752528300" target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2.5 text-sm">
            <MessageCircle className="h-4 w-4" /> Tanya Admin
          </a>
          <Link href="/booking" className="btn-primary px-5 py-2.5 text-sm">Booking Sekarang</Link>
        </div>
        <button className="rounded-full border border-[var(--line)] p-2 md:hidden" onClick={() => setOpen(v => !v)} aria-label="Buka navigasi">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[var(--line)] bg-[var(--surface)] px-6 py-5 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm font-semibold">
            <Link href="/#packages" onClick={() => setOpen(false)}>Paket & Harga</Link>
            <Link href="/#process" onClick={() => setOpen(false)}>Cara Booking</Link>
            <Link href="/#portfolio" onClick={() => setOpen(false)}>Portfolio</Link>
            <Link href="/booking" onClick={() => setOpen(false)} className="text-[var(--gold-dark)]">Booking Sekarang</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface)] py-12">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-6 sm:flex-row">
        <div>
          <div className="font-serif text-2xl font-semibold">Kleiora<span className="text-[var(--gold)]">.grads</span></div>
          <p className="mt-2 text-sm text-[var(--muted)]">Let&apos;s make your graduation moment unforgettable.</p>
        </div>
        <div className="text-sm text-[var(--muted)] sm:text-right">
          <p>Makassar, Indonesia · WITA</p>
          <p className="mt-2">© 2026 Kleiora Grads · <Link href="/studio/login" className="hover:text-[var(--text)]">Studio</Link></p>
        </div>
      </div>
    </footer>
  );
}
