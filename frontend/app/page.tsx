import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, Images, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { ReviewSection } from '@/components/ReviewSection';
import { PortfolioGallery } from '@/components/PortfolioGallery';
import { API_BASE_URL, formatRupiah, getImageUrl, PortfolioItem, ReviewItem } from '@/lib/api';

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfessionalService',
      '@id': 'https://kleioragrads.com/#business',
      name: 'Kleiora Grads',
      url: 'https://kleioragrads.com',
      image: 'https://kleioragrads.com/images/hero-home.jpg',
      logo: 'https://kleioragrads.com/brand/kleiora-mark-hd.png',
      telephone: '+62-857-5252-8300',
      description: 'Jasa foto wisuda profesional untuk berbagai kota di Indonesia dengan booking online dan galeri pribadi.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Makassar',
        addressRegion: 'Sulawesi Selatan',
        addressCountry: 'ID',
      },
      areaServed: { '@type': 'Country', name: 'Indonesia' },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+62-857-5252-8300',
        contactType: 'customer service',
        availableLanguage: ['Indonesian'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://kleioragrads.com/#website',
      url: 'https://kleioragrads.com',
      name: 'Kleiora Grads',
      inLanguage: 'id-ID',
      publisher: { '@id': 'https://kleioragrads.com/#business' },
    },
    {
      '@type': 'Service',
      '@id': 'https://kleioragrads.com/#graduation-photography',
      name: 'Jasa Foto Wisuda Profesional',
      serviceType: 'Fotografi wisuda',
      provider: { '@id': 'https://kleioragrads.com/#business' },
      areaServed: { '@type': 'Country', name: 'Indonesia' },
      url: 'https://kleioragrads.com/booking',
    },
  ],
};

interface PortfolioPageData {
  portfolios: PortfolioItem[];
  hasMore: boolean;
}

async function getPortfolios(): Promise<PortfolioPageData> {
  try {
    const res = await fetch(`${API_BASE_URL}/portfolios?page=1&limit=15`, { next: { revalidate: 60 } });
    if (!res.ok) return { portfolios: [], hasMore: false };
    const data = await res.json();
    return {
      portfolios: data.portfolios || [],
      hasMore: data.meta?.has_more ?? false,
    };
  } catch {
    return { portfolios: [], hasMore: false };
  }
}

async function getReviews(): Promise<ReviewItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews || [];
  } catch (err) {
    return [];
  }
}

export default async function HomePage() {
  const { portfolios, hasMore } = await getPortfolios();
  const reviews = await getReviews();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <SiteHeader />
      <main>
        <section className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] pb-12 pt-32 sm:pt-40 text-center">
          <div className="absolute inset-0 z-0">
            <Image src="/bg-main-v3.jpg" alt="Sesi foto wisuda profesional bersama Kleiora Grads" fill className="object-cover" priority unoptimized />
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--bg)] to-transparent"></div>
          </div>
          <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6">
            <div className="flex flex-col items-center text-[var(--surface)]">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--surface)] bg-black/30 backdrop-blur-sm drop-shadow-md">
                <span className="h-2 w-2 rounded-full bg-[#1db954]" /> BOOKING 2026 DIBUKA
              </div>
              <p className="text-base font-medium text-white drop-shadow-md">Selamat datang di</p>
              <h1 className="mt-2 flex flex-col items-center">
                <span className="sr-only">Kleiora Grads</span>
                <span className="font-serif text-5xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-7xl">Kleiora<span className="text-[#eda98a]">.grads</span></span>
              </h1>
              <p className="mt-6 max-w-2xl text-base Gabriela Stencil text-white drop-shadow-md">
                Rayakan Momen Spesialmu Dengan Kleiora Grads.
              </p>
              <p className="mt-4 font-serif text-base italic text-white drop-shadow-md">
                Let's make your graduation moment unforgettable! ✨
              </p>
              <Link href="/booking" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[var(--bg)] transition hover:opacity-90 shadow-xl">
                Lihat Paket & Harga <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold text-white uppercase drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] tracking-wider">
                <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[var(--gold)] drop-shadow-none" /> Jadwal online</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--gold)] drop-shadow-none" /> Terverifikasi admin</span>
                <span className="flex items-center gap-2"><Images className="h-4 w-4 text-[var(--gold)] drop-shadow-none" /> Bebas pilih hasil</span>
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

        {portfolios.length > 0 && (
          <section id="portfolio" className="border-y border-[var(--line)] bg-[var(--surface2)] py-24">
            <div className="mx-auto max-w-6xl px-6">
              <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Portofolio</p>
                  <h2 className="mt-3 font-serif text-4xl font-medium">Momen yang kami abadikan</h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">Setiap sesi dirancang agar kamu tetap nyaman dan pulang dengan foto yang terasa personal.</p>
              </div>
              <PortfolioGallery initialPortfolios={portfolios} initialHasMore={hasMore} />
            </div>
          </section>
        )}

        <section className="border-y border-[var(--line)] bg-[var(--surface)] py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Fotografer wisuda untuk berbagai kota</p>
              <h2 className="mt-3 font-serif text-4xl font-medium leading-tight">Abadikan momen wisudamu dengan proses yang praktis</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                Kleiora Grads melayani sesi foto wisuda di berbagai kota di Indonesia untuk personal, pasangan, keluarga, dan sahabat. Pilih paket dan jadwal secara online, lakukan sesi foto, lalu tentukan hasil favorit melalui galeri pribadimu.
              </p>
              <Link href="/booking" className="btn-primary mt-7 px-6 py-3.5">Lihat Paket Foto Wisuda <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ['Booking online', 'Pilih paket, tanggal, jam WITA, dan lokasi sesi tanpa proses yang rumit.'],
                ['Galeri pribadi', 'Lihat seluruh hasil sesi dan pilih foto yang ingin diedit sesuai kuota paket.'],
                ['Pendampingan admin', 'Konfirmasi pembayaran dan informasi sesi ditangani langsung oleh tim Kleiora Grads.'],
              ].map(([title, copy]) => (
                <article key={title} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5">
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ReviewSection initialReviews={reviews} />

        <section className="px-6 py-24 text-center"><Images className="mx-auto h-9 w-9 text-[var(--gold-dark)]" /><h2 className="mx-auto mt-5 max-w-2xl font-serif text-4xl">Dari booking sampai memilih hasil foto, semuanya di satu tempat.</h2><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/booking" className="btn-primary px-7 py-4">Mulai Booking</Link><a href={`https://wa.me/6285752528300?text=${encodeURIComponent('Halo Minra, Saya ingin bertanya?')}`} className="btn-secondary px-7 py-4"><svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg> Tanya Admin</a></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
