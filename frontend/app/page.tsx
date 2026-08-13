import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, Images, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { formatRupiah } from '@/lib/api';

const packages = [
  { code: 'personal', name: 'Personal Package', price: 400000, image: '/images/package-basic.jpg', popular: false, features: ['1 jam sesi foto', '1 lokasi', '20 foto edited', 'Semua soft file'] },
  { code: 'family', name: 'Family Package', price: 500000, image: '/images/package-standard.jpg', popular: true, features: ['2 jam sesi foto', '2 lokasi', '40 foto edited', 'Semua soft file', '1 cetak foto 10R'] },
  { code: 'premium', name: 'Premium Package', price: 1250000, image: '/images/package-premium.jpg', popular: false, features: ['3 jam sesi foto', '3 lokasi', '60 foto edited', 'Semua soft file', '2 cetak foto 10R', 'Video teaser 30 detik'] },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main>
        <section className="pb-7 pt-28 sm:pt-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[var(--gold-dark)]">Kleiora Grads · Makassar</p>
                <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-6xl">Satu tempat untuk booking dan memilih foto wisudamu.</h1>
              </div>
              <p className="max-w-md text-sm leading-7 text-[var(--muted)]">Dari menentukan jadwal sampai memilih hasil terbaik, prosesnya lebih mudah dan tetap terasa personal.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.45fr_.75fr]">
              <div className="group relative min-h-[510px] overflow-hidden rounded-3xl bg-black text-white sm:min-h-[600px] lg:min-h-[650px]">
                <Image
                  src="/images/hero-home.jpg"
                  alt="Potret wisudawati Kleiora Grads"
                  fill
                  priority
                  className="object-cover object-[62%_32%] transition duration-700 group-hover:scale-[1.015]"
                  sizes="(max-width: 1024px) 100vw, 68vw"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                <div className="relative z-10 flex min-h-[510px] max-w-2xl flex-col justify-end p-6 sm:min-h-[600px] sm:p-10 lg:min-h-[650px] lg:p-12">
                  <div className="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.18em] backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Booking 2026 dibuka
                  </div>
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[.22em] text-[#e2c99b]">Foto wisuda · personal · keluarga</p>
                  <h2 className="max-w-xl font-serif text-4xl font-semibold leading-[.98] sm:text-6xl">Rayakan pencapaianmu. Kami abadikan ceritanya.</h2>
                  <p className="mt-5 max-w-lg text-sm leading-7 text-white/70 sm:text-base">Pilih paket, tentukan jadwal, lalu nikmati sesi foto yang hangat dan terarah bersama tim Kleiora.</p>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link href="/booking" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-black transition hover:bg-[#e2c99b]">Booking Sekarang <ArrowRight className="h-4 w-4" /></Link>
                    <a href="#packages" className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20">Lihat Paket</a>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-white/65">
                    <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[#e2c99b]" /> Jadwal tersimpan online</span>
                    <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#e2c99b]" /> Pembayaran diverifikasi admin</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <a href="#packages" className="group relative min-h-[250px] overflow-hidden rounded-3xl bg-black text-white lg:min-h-0">
                  <Image src="/images/port-1.jpg" alt="Sesi foto wisuda Kleiora" fill className="object-cover object-[center_38%] transition duration-700 group-hover:scale-[1.035]" sizes="(max-width: 1024px) 50vw, 32vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-6">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#e2c99b]">Paket foto wisuda</p>
                    <h3 className="mt-2 max-w-sm font-serif text-3xl font-semibold leading-tight">Pilih paket yang paling pas untukmu.</h3>
                    <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition group-hover:bg-[#e2c99b]"><ArrowRight className="h-4 w-4" /></span>
                  </div>
                </a>
                <a href="#process" className="group relative min-h-[250px] overflow-hidden rounded-3xl bg-black text-white lg:min-h-0">
                  <Image src="/images/port-2.jpg" alt="Galeri pemilihan foto Kleiora" fill className="object-cover object-center transition duration-700 group-hover:scale-[1.035]" sizes="(max-width: 1024px) 50vw, 32vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-6">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#e2c99b]">Galeri pribadi</p>
                    <h3 className="mt-2 max-w-sm font-serif text-3xl font-semibold leading-tight">Pilih foto favoritmu setelah sesi.</h3>
                    <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition group-hover:bg-[#e2c99b]"><ArrowRight className="h-4 w-4" /></span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="process" className="border-y border-[var(--line)] bg-[var(--surface)] py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Cara booking</p><h2 className="mt-3 font-serif text-4xl font-medium">Empat langkah, satu momen istimewa</h2></div>
            <div className="grid gap-5 md:grid-cols-4">
              {[
                ['01', 'Pilih paket', 'Tentukan paket yang sesuai dengan kebutuhanmu.'],
                ['02', 'Isi data', 'Pilih tanggal, jam WITA, dan lokasi sesi foto.'],
                ['03', 'Konfirmasi', 'Kirim bukti pembayaran untuk diverifikasi admin.'],
                ['04', 'Pilih hasil', 'Setelah sesi, pilih foto favorit dari galeri pribadimu.'],
              ].map(([number, title, copy]) => <div key={number} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-6"><span className="font-serif text-3xl text-[var(--gold)]">{number}</span><h3 className="mt-5 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section id="packages" className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Paket & harga</p><h2 className="mt-3 font-serif text-4xl font-medium">Pilih cerita wisudamu</h2></div>
            <div className="grid gap-7 lg:grid-cols-3">
              {packages.map(pkg => (
                <article key={pkg.code} className={`relative overflow-hidden rounded-3xl border bg-[var(--surface)] shadow-sm ${pkg.popular ? 'border-[var(--gold)]' : 'border-[var(--line)]'}`}>
                  {pkg.popular && <span className="absolute right-4 top-4 z-10 rounded-full bg-[var(--gold)] px-3 py-1 text-[10px] font-extrabold tracking-wider text-white">MOST POPULAR</span>}
                  <div className="relative aspect-[4/3]"><Image src={pkg.image} alt={pkg.name} fill className="object-cover object-[center_32%]" sizes="(max-width: 1024px) 100vw, 33vw" /></div>
                  <div className="p-7"><h3 className="font-serif text-2xl font-semibold">{pkg.name}</h3><p className="mt-2 text-2xl font-extrabold text-[var(--gold-dark)]">{formatRupiah(pkg.price)}</p><ul className="my-6 space-y-3 text-sm text-[var(--muted)]">{pkg.features.map(feature => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-dark)]" />{feature}</li>)}</ul><Link href={`/booking?package=${pkg.code}`} className="btn-primary w-full px-5 py-3.5">Pilih Paket</Link></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="portfolio" className="border-y border-[var(--line)] bg-[var(--surface2)] py-24">
          <div className="mx-auto max-w-6xl px-6"><div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Portfolio</p><h2 className="mt-3 font-serif text-4xl font-medium">Momen yang kami abadikan</h2></div><p className="max-w-sm text-sm leading-6 text-[var(--muted)]">Setiap sesi dirancang agar kamu tetap nyaman dan pulang dengan foto yang terasa personal.</p></div><div className="grid gap-5 sm:grid-cols-3">{[1,2,3].map(n => <div key={n} className="relative aspect-[3/4] overflow-hidden rounded-2xl"><Image src={`/images/port-${n}.jpg`} alt={`Portfolio Kleiora ${n}`} fill className="object-cover transition duration-500 hover:scale-105" sizes="(max-width: 640px) 100vw, 33vw" /></div>)}</div></div>
        </section>

        <section className="px-6 py-24 text-center"><Images className="mx-auto h-9 w-9 text-[var(--gold-dark)]" /><h2 className="mx-auto mt-5 max-w-2xl font-serif text-4xl">Dari booking sampai memilih hasil foto, semuanya di satu tempat.</h2><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/booking" className="btn-primary px-7 py-4">Mulai Booking</Link><a href="https://wa.me/6285752528300" className="btn-secondary px-7 py-4"><MessageCircle className="h-4 w-4" /> Tanya Admin</a></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
