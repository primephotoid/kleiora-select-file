import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, Images, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { formatRupiah } from '@/lib/api';

const packages = [
  { code: 'personal', name: 'Personal Package', price: 400000, image: '/images/package-basic.jpg', popular: false, features: ['1 jam sesi foto', '1 lokasi', '20 foto edited', 'Semua soft file'] },
  { code: 'family', name: 'Family Package', price: 500000, image: '/images/package-standard.jpg', popular: true, features: ['2 jam sesi foto', '2 lokasi', '40 foto edited', 'Semua soft file', '1 cetak foto 10R'] },
  { code: 'premium', name: 'Premium Package', price: 1250000, image: '/images/package-premium.jpg', popular: false, features: ['3 jam sesi foto', '3 lokasi', '60 foto edited', 'Semua soft file', '2 cetak foto 10R', 'Video teaser 30 detik'] },
  { code: 'cinematic', name: 'Cinematic Package', price: 1000000, image: '/images/package-premium.jpg', popular: false, features: ['1 jam take', 'Include edit', '1x free revisi edit', 'Hasil durasi menyesuaikan'] },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main>
        <section className="flex min-h-screen items-center justify-center bg-[var(--bg)] pb-12 pt-32 sm:pt-40">
          <div className="mx-auto flex w-full max-w-6xl flex-col-reverse items-center justify-between gap-12 px-6 md:flex-row md:gap-20">
            <div className="flex flex-1 flex-col items-start text-[var(--text)]">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--text)]">
                <span className="h-2 w-2 rounded-full bg-[#1db954]" /> BOOKING 2026 DIBUKA
              </div>
              <p className="text-base font-medium text-[var(--muted)]">Selamat datang di</p>
              <h1 className="mt-1 font-serif text-6xl font-normal tracking-tight sm:text-7xl">
                Kleiora.<span className="text-[var(--gold-dark)]">grads</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--muted)]">
                Terima kasih sudah mempercayakan momen berharga ini kepada kami. Kami siap mengabadikan pencapaian terbaikmu dengan hasil foto wisuda yang elegan, berkesan, dan tak terlupakan.
              </p>
              <p className="mt-4 font-serif text-base italic text-[var(--text)]">
                Let's make your graduation moment unforgettable! ♡
              </p>
              <Link href="/booking" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-7 py-3.5 text-sm font-bold text-[var(--surface)] transition hover:opacity-80">
                Lihat Paket & Harga <ArrowRight className="h-4 w-4" />
              </Link>
              
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-bold text-gray-600 uppercase">
                <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[var(--gold-dark)]" /> Jadwal tersimpan online</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--gold-dark)]" /> Pembayaran diverifikasi admin</span>
                <span className="flex items-center gap-2"><Images className="h-4 w-4 text-[var(--gold-dark)]" /> Memilih hasil foto tanpa ribet</span>
              </div>
            </div>

            <div className="relative w-full max-w-sm md:w-[420px]">
              <div className="relative w-full overflow-hidden rounded-t-[250px] shadow-xl" style={{ aspectRatio: '3/4' }}>
                <Image src="/images/hero-home.jpg" alt="Graduation" fill className="object-cover object-center" priority sizes="(max-width: 768px) 100vw, 420px" />
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


        <section id="portfolio" className="border-y border-[var(--line)] bg-[var(--surface2)] py-24">
          <div className="mx-auto max-w-6xl px-6"><div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Portfolio</p><h2 className="mt-3 font-serif text-4xl font-medium">Momen yang kami abadikan</h2></div><p className="max-w-sm text-sm leading-6 text-[var(--muted)]">Setiap sesi dirancang agar kamu tetap nyaman dan pulang dengan foto yang terasa personal.</p></div><div className="grid gap-5 sm:grid-cols-3">{[1,2,3].map(n => <div key={n} className="relative aspect-[3/4] overflow-hidden rounded-2xl"><Image src={`/images/port-${n}.jpg`} alt={`Portfolio Kleiora ${n}`} fill className="object-cover transition duration-500 hover:scale-105" sizes="(max-width: 640px) 100vw, 33vw" /></div>)}</div></div>
        </section>

        <section className="px-6 py-24 text-center"><Images className="mx-auto h-9 w-9 text-[var(--gold-dark)]" /><h2 className="mx-auto mt-5 max-w-2xl font-serif text-4xl">Dari booking sampai memilih hasil foto, semuanya di satu tempat.</h2><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/booking" className="btn-primary px-7 py-4">Mulai Booking</Link><a href="https://wa.me/6285752528300" className="btn-secondary px-7 py-4"><svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Tanya Admin</a></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
