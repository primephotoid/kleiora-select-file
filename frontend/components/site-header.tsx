'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--surface-glass)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="shrink-0" aria-label="Kleiora Grads — Beranda">
          <span className="flex items-center gap-2"><Image src="/brand/kleiora-mark-hd.png" alt="" width={1324} height={845} priority className="h-10 w-auto" /><span className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Kleiora<span className="text-[#a54f3b]">.grads</span></span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--muted)] md:flex">
          <Link href="/" className="hover:text-[var(--text)]">Home</Link>
          <Link href="/#process" className="hover:text-[var(--text)]">Cara Booking</Link>
          <Link href="/#portfolio" className="hover:text-[var(--text)]">Portfolio</Link>
          <Link href="/booking" className="hover:text-[var(--text)]">Booking</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <a href="https://wa.me/6285752528300" className="hidden items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--gold-dark)] md:inline-flex">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Tanya Admin
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
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
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
          <div className="flex items-center gap-2"><Image src="/brand/kleiora-mark-hd.png" alt="" width={1324} height={845} className="h-10 w-auto" /><span className="font-serif text-2xl font-semibold">Kleiora<span className="text-[#a54f3b]">.grads</span></span></div>
          <p className="mt-2 text-sm text-[var(--muted)]">Let&apos;s make your graduation moment unforgettable.</p>
        </div>
        <div className="text-sm text-[var(--muted)] sm:text-right">
          <p>Berbasis di Makassar · Melayani berbagai kota di Indonesia</p>
          <p className="mt-2">© 2026 Kleiora.grads x <Link href="/studio/login" className="hover:text-[var(--text)]">Primephoto.id</Link></p>
        </div>
      </div>
    </footer>
  );
}
