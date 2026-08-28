'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Check, CheckCircle2, Clock3, Copy, ExternalLink, ImageIcon,
  Images, Loader2, LogOut, MapPin, MessageCircle, Plus, ReceiptText, Search,
  ShieldCheck, Trash, UserRound, WalletCards, X, PackageIcon, Edit2, UploadCloud
} from 'lucide-react';
import { API_BASE_URL, apiRequest, BookingItem, formatRupiah, getImageUrl, PackageItem, PortfolioItem, ReviewItem, uploadPackageImage, uploadPortfolioImage } from '@/lib/api';

interface GalleryItem {
  id: number; slug: string; title: string; client_name: string; max_selection: number;
  status: string; booking_id?: number; photos?: { drive_file_id: string }[]; selection?: { total_selected: number };
}

type DashboardTab = 'bookings' | 'galleries' | 'packages' | 'portfolios' | 'reviews';
type BookingFilter = 'all' | 'needs_action' | 'confirmed' | 'completed';
type BookingSort = 'created_at' | 'session_date' | 'full_name' | 'code' | 'amount_due';
interface BookingMeta { page: number; per_page: number; total: number; total_pages: number }
interface BookingSummary { total: number; needs_action: number; confirmed: number; completed: number }

const emptyGalleryForm = { title: '', drive_url: '', client_name: '', client_email: '', booking_id: '', max_selection: 0 };
const emptyPackageForm = { id: 0, code: '', name: '', description: '', price: 0, duration_hours: 1, duration_label: '', location_count: 1, edited_photos: 20, includes_print: '', includes_teaser: false, image_path: '', is_active: true };
const emptyPortfolioForm = { id: 0, title: '', image_path: '', is_active: true, sort_order: 0 };

export default function DashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState('');
  const [proofVersions, setProofVersions] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DashboardTab>('bookings');
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPerPage, setBookingPerPage] = useState(10);
  const [bookingSort, setBookingSort] = useState<BookingSort>('created_at');
  const [bookingSortDirection, setBookingSortDirection] = useState<'asc' | 'desc'>('desc');
  const [bookingMeta, setBookingMeta] = useState<BookingMeta>({ page: 1, per_page: 10, total: 0, total_pages: 0 });
  const [bookingSummary, setBookingSummary] = useState<BookingSummary>({ total: 0, needs_action: 0, confirmed: 0, completed: 0 });
  const bookingQueryReady = useRef(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [copied, setCopied] = useState('');
  const [adminName, setAdminName] = useState('Admin');
  const [form, setForm] = useState(emptyGalleryForm);
  const [pkgForm, setPkgForm] = useState<PackageItem>(emptyPackageForm as PackageItem);
  const [portfolioForm, setPortfolioForm] = useState<PortfolioItem>(emptyPortfolioForm as PortfolioItem);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);

  function authHeaders() {
    const token = localStorage.getItem('kleiora_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function bookingQuery() {
    const params = new URLSearchParams({
      page: String(bookingPage), per_page: String(bookingPerPage), filter,
      sort_by: bookingSort, sort_dir: bookingSortDirection,
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }

  function applyBookingData(data: { bookings: BookingItem[]; meta: BookingMeta; summary: BookingSummary }) {
    setBookings(data.bookings);
    setBookingMeta(data.meta);
    setBookingSummary(data.summary);
    if (data.meta.total_pages > 0 && bookingPage > data.meta.total_pages) setBookingPage(data.meta.total_pages);
  }

  async function loadBookings(background = true) {
    if (background) setRefreshing(true);
    setError('');
    try {
      const data = await apiRequest<{ bookings: BookingItem[]; meta: BookingMeta; summary: BookingSummary }>(`/studio/bookings?${bookingQuery()}`, { headers: authHeaders() });
      applyBookingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data booking gagal dimuat.');
    } finally {
      setRefreshing(false);
    }
  }

  async function load(background = false) {
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [bookingData, galleryData, packageData, portfolioData, reviewData] = await Promise.all([
        apiRequest<{ bookings: BookingItem[]; meta: BookingMeta; summary: BookingSummary }>(`/studio/bookings?${bookingQuery()}`, { headers: authHeaders() }),
        apiRequest<{ galleries: GalleryItem[] }>('/studio/galleries', { headers: authHeaders() }),
        apiRequest<{ packages: PackageItem[] }>('/studio/packages', { headers: authHeaders() }),
        apiRequest<{ portfolios: PortfolioItem[] }>('/studio/portfolios', { headers: authHeaders() }),
        apiRequest<{ reviews: ReviewItem[] }>('/studio/reviews', { headers: authHeaders() }),
      ]);
      applyBookingData(bookingData);
      setGalleries(galleryData.galleries);
      setPackages(packageData.packages);
      setPortfolios(portfolioData.portfolios);
      setReviews(reviewData.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data studio gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('kleiora_user');
    if (savedUser) {
      try { setAdminName(JSON.parse(savedUser).full_name || 'Admin'); } catch { /* abaikan data lama */ }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBookingPage(1);
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!bookingQueryReady.current) {
      bookingQueryReady.current = true;
      return;
    }
    loadBookings(true);
  }, [bookingPage, bookingPerPage, debouncedSearch, filter, bookingSort, bookingSortDirection]); // eslint-disable-line react-hooks/exhaustive-deps

  const isGalleryActive = (g: GalleryItem) => g.status === 'active' && (!g.selection || !g.selection.total_selected);

  const stats = useMemo(() => {
    return {
      total: bookingSummary.total,
      needsAction: bookingSummary.needs_action,
      confirmed: bookingSummary.confirmed,
      completed: bookingSummary.completed,
      activeGalleries: galleries.filter(isGalleryActive).length,
    };
  }, [bookingSummary, galleries]);

  async function verify(code: string) {
    setProcessing(code); setError('');
    try {
      const proofVersion = proofVersions[code];
      if (!proofVersion) throw new Error('Buka bukti pembayaran terbaru sebelum melakukan verifikasi.');
      await apiRequest(`/studio/bookings/${code}/verify-payment`, { method: 'PATCH', headers: { ...authHeaders(), 'X-Payment-Proof-Version': proofVersion } });
      setProofVersions(current => { const next = { ...current }; delete next[code]; return next; });
      await loadBookings(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Verifikasi gagal.'); }
    finally { setProcessing(''); }
  }

  async function viewProof(code: string) {
    setProcessing(`proof-${code}`); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/studio/bookings/${code}/payment-proof`, { credentials: 'include', headers: authHeaders() });
      if (!response.ok) throw new Error('Bukti pembayaran tidak dapat dibuka.');
      const proofVersion = response.headers.get('X-Payment-Proof-Version');
      if (!proofVersion) throw new Error('Versi bukti pembayaran tidak tersedia. Muat ulang data dan coba lagi.');
      setProofVersions(current => ({ ...current, [code]: proofVersion }));
      const url = URL.createObjectURL(await response.blob());
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Bukti pembayaran tidak dapat dibuka.'); }
    finally { setProcessing(''); }
  }

  async function createGallery(event: FormEvent) {
    event.preventDefault(); setError(''); setCreating(true);
    try {
      const payload = { ...form, booking_id: form.booking_id ? Number(form.booking_id) : undefined };
      await apiRequest('/studio/galleries', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      setShowCreate(false); setForm(emptyGalleryForm); await load(true); setTab('galleries');
    } catch (err) { setError(err instanceof Error ? err.message : 'Galeri gagal dibuat.'); }
    finally { setCreating(false); }
  }

  async function deleteGallery(id: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus galeri ini? Semua data pilihan akan ikut terhapus.')) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/galleries/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Galeri gagal dihapus.'); setRefreshing(false); }
  }

  async function savePackage(event: FormEvent) {
    event.preventDefault(); setError(''); setCreating(true);
    try {
      if (pkgForm.id) {
        await apiRequest(`/studio/packages/${pkgForm.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(pkgForm) });
      } else {
        await apiRequest('/studio/packages', { method: 'POST', headers: authHeaders(), body: JSON.stringify(pkgForm) });
      }
      setShowCreatePackage(false); setPkgForm(emptyPackageForm); await load(true); setTab('packages');
    } catch (err) { setError(err instanceof Error ? err.message : 'Paket gagal disimpan.'); }
    finally { setCreating(false); }
  }

  async function deletePackage(id: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus paket ini?')) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/packages/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Paket gagal dihapus.'); setRefreshing(false); }
  }

  async function savePortfolio(event: FormEvent) {
    event.preventDefault();
    setCreating(true); setError('');
    try {
      if (portfolioForm.id) {
        await apiRequest(`/studio/portfolios/${portfolioForm.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(portfolioForm) });
      } else {
        const paths = portfolioForm.image_path.split(',');
        for (const p of paths) {
          if (!p.trim()) continue;
          await apiRequest('/studio/portfolios', { method: 'POST', headers: authHeaders(), body: JSON.stringify({...portfolioForm, image_path: p.trim()}) });
        }
      }
      setShowCreatePortfolio(false); setPortfolioForm(emptyPortfolioForm); await load(true); setTab('portfolios');
    } catch (err) { setError(err instanceof Error ? err.message : 'Portfolio gagal disimpan.'); }
    finally { setCreating(false); }
  }

  async function deletePortfolio(id: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus foto portfolio ini?')) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/portfolios/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Portfolio gagal dihapus.'); setRefreshing(false); }
  }

  async function toggleReviewApproval(id: number) {
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/reviews/${id}/approve`, { method: 'PATCH', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal memperbarui ulasan.'); setRefreshing(false); }
  }

  async function deleteReview(id: number) {
    if (!confirm('Hapus ulasan ini permanen?')) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/reviews/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menghapus ulasan.'); setRefreshing(false); }
  }

  async function deleteBooking(code: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus booking ${code}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/bookings/${code}`, { method: 'DELETE', headers: authHeaders() });
      await loadBookings(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Booking gagal dihapus.'); setRefreshing(false); }
  }

  async function markComplete(code: string) {
    setProcessing(code); setError('');
    try {
      await apiRequest(`/studio/bookings/${code}/complete`, { method: 'PATCH', headers: authHeaders() });
      await loadBookings(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal memperbarui status booking.'); }
    finally { setProcessing(''); }
  }

  async function logout() {
    try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* tetap bersihkan sesi lokal */ }
    localStorage.removeItem('kleiora_token'); localStorage.removeItem('kleiora_user'); router.replace('/studio/login'); router.refresh();
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(''), 1800);
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-serif text-2xl font-semibold">Kleiora<span className="text-[var(--gold)]">.grads</span></Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-xs font-bold">Admin Kleiora.grads</p><p className="text-[10px] text-[var(--muted)]">Administrator studio</p></div>
            <button onClick={logout} className="btn-secondary px-4 py-2.5 text-xs"><LogOut className="h-4 w-4" />Keluar</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Dashboard studio</p><h1 className="mt-2 font-serif text-4xl font-medium sm:text-5xl">Selamat bekerja, Admin Kleiora.grads</h1><p className="mt-3 max-w-xl text-sm text-[var(--muted)]">Pantau booking, periksa pembayaran, lalu bagikan galeri foto kepada klien.</p></div>
          <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
            <button onClick={() => { setPortfolioForm(emptyPortfolioForm); setShowCreatePortfolio(true); }} className="btn-secondary w-full px-6 py-3.5 text-sm sm:w-auto"><Plus className="h-4 w-4" />Buat Portofolio</button>
            <button onClick={() => { setPkgForm(emptyPackageForm); setShowCreatePackage(true); }} className="btn-secondary w-full px-6 py-3.5 text-sm sm:w-auto"><Plus className="h-4 w-4" />Buat Paket</button>
            <button onClick={() => setShowCreate(true)} className="btn-primary w-full px-6 py-3.5 text-sm sm:w-auto"><Plus className="h-4 w-4" />Buat Galeri</button>
          </div>
        </section>

        {error && <div role="alert" className="mt-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan"><X className="h-4 w-4" /></button></div>}

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={<ReceiptText />} label="Total booking" value={stats.total} />
          <Stat icon={<Clock3 />} label="Perlu diperiksa" value={stats.needsAction} emphasis={stats.needsAction > 0} />
          <Stat icon={<ShieldCheck />} label="Terverifikasi" value={stats.confirmed} />
          <Stat icon={<CheckCircle2 />} label="Selesai" value={stats.completed} />
          <Stat icon={<Images />} label="Galeri aktif" value={stats.activeGalleries} />
        </section>

        <div className="mt-8 flex gap-1 rounded-2xl border border-[var(--line)] bg-white p-1.5 sm:w-fit flex-wrap">
          <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')} icon={<ReceiptText />} label={`Booking (${bookingSummary.total})`} />
          <TabButton active={tab === 'galleries'} onClick={() => setTab('galleries')} icon={<Images />} label={`Galeri (${galleries.filter(isGalleryActive).length})`} />
          <TabButton active={tab === 'packages'} onClick={() => setTab('packages')} icon={<PackageIcon />} label={`Paket (${packages.length})`} />
          <TabButton active={tab === 'portfolios'} onClick={() => setTab('portfolios')} icon={<Images />} label={`Portofolio (${portfolios.length})`} />
          <TabButton active={tab === 'reviews'} onClick={() => setTab('reviews')} icon={<MessageCircle />} label={`Ulasan (${reviews.length})`} />
        </div>

        {loading ? <DashboardSkeleton /> : tab === 'bookings' ? (
          <section className="mt-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl bg-[var(--surface2)] py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-[var(--gold)]" placeholder="Cari nama, kode, WhatsApp..." /></div>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0"><FilterButton active={filter === 'all'} onClick={() => { setBookingPage(1); setFilter('all'); }}>Semua</FilterButton><FilterButton active={filter === 'needs_action'} onClick={() => { setBookingPage(1); setFilter('needs_action'); }}>Perlu diperiksa</FilterButton><FilterButton active={filter === 'confirmed'} onClick={() => { setBookingPage(1); setFilter('confirmed'); }}>Terverifikasi</FilterButton><FilterButton active={filter === 'completed'} onClick={() => { setBookingPage(1); setFilter('completed'); }}>Selesai</FilterButton><button onClick={() => loadBookings(true)} disabled={refreshing} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:opacity-50">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Muat ulang'}</button></div>
            </div>
            <BookingTable
              bookings={bookings} meta={bookingMeta} processing={processing} sort={bookingSort} sortDirection={bookingSortDirection}
              onSort={column => { if (bookingSort === column) setBookingSortDirection(value => value === 'asc' ? 'desc' : 'asc'); else { setBookingSort(column); setBookingSortDirection('asc'); } setBookingPage(1); }}
              onVerify={verify} onViewProof={viewProof} onDelete={deleteBooking} onComplete={markComplete}
              onCreateGallery={item => { setForm({ ...emptyGalleryForm, booking_id: String(item.id), title: `Foto Wisuda — ${item.full_name}`, client_name: item.full_name }); setShowCreate(true); }}
              onPageChange={setBookingPage} perPage={bookingPerPage} onPerPageChange={value => { setBookingPage(1); setBookingPerPage(value); }}
            />
          </section>
        ) : tab === 'galleries' ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{galleries.filter(isGalleryActive).map(gallery => <GalleryCard key={gallery.id} gallery={gallery} copied={copied === gallery.slug} onCopy={() => copyLink(gallery.slug)} onDelete={() => deleteGallery(gallery.id)} />)}{!galleries.filter(isGalleryActive).length && <div className="sm:col-span-2 lg:col-span-3"><Empty icon={<ImageIcon />} title="Belum ada galeri" text="Buat galeri dari booking yang sudah dikonfirmasi." /></div>}</section>
        ) : tab === 'packages' ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} onEdit={() => { setPkgForm(pkg); setShowCreatePackage(true); }} onDelete={() => deletePackage(pkg.id)} />
            ))}
            {!packages.length && <div className="sm:col-span-2 lg:col-span-3"><Empty icon={<PackageIcon />} title="Belum ada paket" text="Buat paket baru untuk ditampilkan di halaman pemesanan." /></div>}
          </section>
        ) : tab === 'portfolios' ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {portfolios.map(p => (
              <PortfolioCard key={p.id} portfolio={p} onEdit={() => { setPortfolioForm(p); setShowCreatePortfolio(true); }} onDelete={() => deletePortfolio(p.id)} />
            ))}
            {!portfolios.length && <div className="sm:col-span-3 lg:grid-cols-4"><Empty icon={<Images />} title="Belum ada portofolio" text="Tambahkan portofolio untuk ditampilkan di halaman utama." /></div>}
          </section>
        ) : tab === 'reviews' ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map(r => (
              <div key={r.id} className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">{r.client_name}</h3>
                    <div className="mt-1 flex text-[var(--gold)]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-current' : 'text-gray-300'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleReviewApproval(r.id)} className={`flex h-8 items-center rounded-full px-3 text-xs font-bold transition ${r.is_approved ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {r.is_approved ? 'Disetujui' : 'Sembunyikan'}
                    </button>
                    <button onClick={() => deleteReview(r.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"><Trash className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-600">"{r.comment}"</p>
                <p className="mt-4 text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            ))}
            {!reviews.length && <div className="sm:col-span-2 lg:col-span-3"><Empty icon={<MessageCircle />} title="Belum ada ulasan" text="Ulasan dari klien akan muncul di sini." /></div>}
          </section>
        ) : null}
      </main>

      {showCreate && <CreateGalleryModal form={form} setForm={setForm} bookings={bookings} creating={creating} onClose={() => !creating && setShowCreate(false)} onSubmit={createGallery} />}
      {showCreatePackage && <CreatePackageModal form={pkgForm} setForm={setPkgForm} creating={creating} onClose={() => !creating && setShowCreatePackage(false)} onSubmit={savePackage} />}
      {showCreatePortfolio && <CreatePortfolioModal form={portfolioForm} setForm={setPortfolioForm} creating={creating} onClose={() => !creating && setShowCreatePortfolio(false)} onSubmit={savePortfolio} />}
      <style jsx global>{`.admin-field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.admin-field:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-glow)}`}</style>
    </div>
  );
}

interface BookingTableProps {
  bookings: BookingItem[]; meta: BookingMeta; processing: string; sort: BookingSort; sortDirection: 'asc' | 'desc'; perPage: number;
  onSort: (column: BookingSort) => void; onVerify: (code: string) => void; onViewProof: (code: string) => void;
  onCreateGallery: (item: BookingItem) => void; onDelete: (code: string) => void; onComplete: (code: string) => void;
  onPageChange: (page: number) => void; onPerPageChange: (perPage: number) => void;
}

function BookingTable(props: BookingTableProps) {
  const { bookings, meta, sort, sortDirection, onSort, onPageChange, perPage, onPerPageChange } = props;
  const start = meta.total ? (meta.page - 1) * meta.per_page + 1 : 0;
  const end = Math.min(meta.page * meta.per_page, meta.total);

  if (!bookings.length) return <div className="mt-4"><Empty icon={<Search />} title="Booking tidak ditemukan" text="Coba ubah kata pencarian atau filter status." /></div>;

  return <>
    <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-white lg:block">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[var(--surface2)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <SortableHeader label="Klien" column="full_name" active={sort} direction={sortDirection} onSort={onSort} />
            <SortableHeader label="Jadwal" column="session_date" active={sort} direction={sortDirection} onSort={onSort} />
            <th className="px-4 py-3 font-bold">Paket</th>
            <SortableHeader label="Pembayaran" column="amount_due" active={sort} direction={sortDirection} onSort={onSort} />
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 text-right font-bold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {bookings.map(item => <BookingTableRow key={item.id} item={item} {...props} />)}
        </tbody>
      </table>
    </div>
    <div className="mt-4 space-y-3 lg:hidden">
      {bookings.map(item => <BookingCard key={item.id} item={item} processing={props.processing} onVerify={props.onVerify} onViewProof={props.onViewProof} onDelete={props.onDelete} onComplete={props.onComplete} onCreateGallery={() => props.onCreateGallery(item)} />)}
    </div>
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span>Menampilkan <strong className="text-[var(--text)]">{start}–{end}</strong> dari <strong className="text-[var(--text)]">{meta.total}</strong></span>
        <label className="flex items-center gap-2">Baris
          <select value={perPage} onChange={event => onPerPageChange(Number(event.target.value))} className="rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-xs text-[var(--text)]">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <button onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
        <span className="whitespace-nowrap text-xs text-[var(--muted)]">Halaman <strong className="text-[var(--text)]">{meta.page}</strong> dari <strong className="text-[var(--text)]">{Math.max(meta.total_pages, 1)}</strong></span>
        <button onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.total_pages} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
      </div>
    </div>
  </>;
}

function SortableHeader({ label, column, active, direction, onSort }: { label: string; column: BookingSort; active: BookingSort; direction: 'asc' | 'desc'; onSort: (column: BookingSort) => void }) {
  return <th className="px-4 py-3 font-bold"><button onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-[var(--text)]">{label}<span aria-hidden="true" className={active === column ? 'text-[var(--gold-dark)]' : 'text-transparent'}>{direction === 'asc' ? '▲' : '▼'}</span></button></th>;
}

function BookingTableRow({ item, processing, onVerify, onViewProof, onCreateGallery, onDelete, onComplete }: BookingTableProps & { item: BookingItem }) {
  const whatsapp = item.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const isCompleted = item.status === 'completed';
  const hasGallery = !!item.gallery;
  const sendReceipt = () => {
    const dateStr = new Date(`${item.session_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const message = `Halo kak *${item.full_name}*, terima kasih ya!\n\nPembayaran untuk sesi foto wisuda dengan Kleiora.grads (*Kode: ${item.code}*) sudah kami terima dan verifikasi.\n\n*Detail Sesi:*\n● Tanggal: ${dateStr}\n● Waktu: ${item.session_hour}.00 WITA\n● Lokasi: ${item.session_location}\n● Paket: ${item.package.name}\n\nKami tunggu kehadirannya ya kak!`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };
  const sendGallery = () => {
    if (!item.gallery?.slug) return;
    const message = `Halo kak *${item.full_name}*, galeri foto kakak sudah siap. Silakan lihat dan pilih foto melalui link berikut:\n\n● ${window.location.origin}/g/${item.gallery.slug}`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };
  const smallButton = 'inline-flex items-center justify-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40';

  return <tr className="align-top hover:bg-[var(--surface2)]/50">
    <td className="px-4 py-4"><div className="font-bold">{item.full_name}</div><div className="mt-1 text-xs text-[var(--muted)]">{item.campus_name}</div><div className="mt-1 font-mono text-[11px] text-[var(--muted)]">{item.code}</div><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><MessageCircle className="h-3 w-3" />{item.whatsapp}</a></td>
    <td className="px-4 py-4"><div className="font-semibold">{formatDate(item.session_date)} · {item.session_hour}.00</div><div className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]"><MapPin className="h-3 w-3" />{item.session_location}</div></td>
    <td className="px-4 py-4"><div className="font-semibold">{item.package.name}</div></td>
    <td className="px-4 py-4"><div className="font-semibold">{formatRupiah(item.amount_due)}</div><div className="mt-1 text-xs text-[var(--muted)]">{item.payment_type === 'dp' ? 'DP 50%' : item.payment_type === 'dp_custom' ? 'DP Custom' : 'Lunas'}</div></td>
    <td className="px-4 py-4"><Status value={isCompleted ? 'completed' : item.payment_status} /></td>
    <td className="px-4 py-4"><div className="ml-auto flex max-w-[270px] flex-wrap justify-end gap-1.5">
      {item.payment_status === 'submitted' && !isCompleted && <><button onClick={() => onViewProof(item.code)} disabled={processing !== ''} className={smallButton}><ExternalLink className="h-3 w-3" />Lihat bukti</button><button onClick={() => onVerify(item.code)} disabled={processing !== ''} className={`${smallButton} border-emerald-700 bg-emerald-700 text-white`}><CheckCircle2 className="h-3 w-3" />Verifikasi</button></>}
      {isCompleted ? hasGallery && <button onClick={sendGallery} className={`${smallButton} text-blue-700`}><Images className="h-3 w-3" />Kirim galeri</button> : hasGallery ? <><button onClick={sendGallery} className={`${smallButton} text-blue-700`}><Images className="h-3 w-3" />Kirim galeri</button><button onClick={() => onComplete(item.code)} disabled={processing !== ''} className={`${smallButton} text-emerald-700`}><CheckCircle2 className="h-3 w-3" />Selesai</button></> : item.status === 'confirmed' ? <><button onClick={sendReceipt} className={`${smallButton} text-emerald-700`}><MessageCircle className="h-3 w-3" />Kirim resi</button><button onClick={() => onCreateGallery(item)} className={smallButton}><Plus className="h-3 w-3" />Buat galeri</button></> : null}
      <button onClick={() => onDelete(item.code)} disabled={processing !== ''} className={`${smallButton} border-red-200 bg-red-50 text-red-700`}><Trash className="h-3 w-3" />Hapus</button>
    </div></td>
  </tr>;
}

function BookingCard({ item, processing, onVerify, onViewProof, onCreateGallery, onDelete, onComplete }: { item: BookingItem; processing: string; onVerify: (code: string) => void; onViewProof: (code: string) => void; onCreateGallery: () => void; onDelete: (code: string) => void; onComplete: (code: string) => void }) {
  const whatsapp = item.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const hasGallery = !!item.gallery;
  const isCompleted = item.status === 'completed';

  const handleSendReceipt = () => {
    const dateStr = new Date(`${item.session_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const message = `Halo kak *${item.full_name}*, terima kasih ya!\n\nPembayaran untuk sesi foto wisuda dengan Kleiora.grads (*Kode: ${item.code}*) sudah kami terima dan verifikasi.\n\n*Detail Sesi:*\n● Tanggal: ${dateStr}\n● Waktu: ${item.session_hour}.00 WITA\n● Lokasi: ${item.session_location}\n● Paket: ${item.package.name}\n\nKami tunggu kehadirannya ya kak! Jika ada pertanyaan lebih lanjut, silakan balas pesan ini.`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendGallery = () => {
    if (!item.gallery?.slug) return;
    const driveLink = item.gallery.drive_folder_id ? `\n\n● *Akses Foto Mentah & Hasil Edit:*\nKakak juga bisa melihat dan mendownload semua foto mentah dan foto yang sudah diedit nanti melalui folder Google Drive ini:\n● https://drive.google.com/drive/folders/${item.gallery.drive_folder_id}\n\n● *Penting:* File di link Google Drive dapat diakses selama 6 bulan. Apabila lebih dari 6 bulan file sudah tidak ada, maka hal tersebut sudah diluar tanggung jawab Kleiora.grads.` : '';
    const message = `Halo kak *${item.full_name}*, terima kasih atas sesinya bersama Kleiora.grads!\n\nGaleri foto kakak sudah siap nih. Silakan klik link di bawah ini untuk melihat dan memilih foto mana saja yang ingin diedit sesuai kuota paket:\n\n● ${window.location.origin}/g/${item.gallery.slug}${driveLink}\n\nJika ada kesulitan saat memilih, jangan ragu untuk bertanya ya kak!`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return <article className="rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[#d4c4ac] hover:shadow-sm"><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.full_name}</h2><Status value={isCompleted ? 'completed' : item.payment_status} /></div><p className="mt-1 text-xs text-[var(--muted)]">{item.campus_name} · <span className="font-mono">{item.code}</span></p><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />{item.whatsapp}</a></div><div className="space-y-2 text-sm"><p className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-[var(--gold-dark)]" />{formatDate(item.session_date)} · {item.session_hour}.00</p><p className="flex items-center gap-2 text-xs text-[var(--muted)]"><MapPin className="h-3.5 w-3.5" />{item.session_location}</p></div><div><p className="text-sm font-semibold">{item.package.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.payment_type === 'dp' ? 'DP 50%' : item.payment_type === 'dp_custom' ? 'DP Custom' : 'Lunas'} · {formatRupiah(item.amount_due)}</p></div><div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">{item.payment_status === 'submitted' && !isCompleted && <><button onClick={() => onViewProof(item.code)} disabled={processing !== ''} className="btn-secondary flex-1 px-3 py-2 text-xs">{processing === `proof-${item.code}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}Lihat bukti</button><button onClick={() => onVerify(item.code)} disabled={processing !== ''} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{processing === item.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Verifikasi</button></>}{isCompleted ? <><span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Selesai</span>{hasGallery && <button onClick={handleSendGallery} className="btn-secondary flex-1 px-3 py-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"><Images className="h-3.5 w-3.5" />Kirim Galeri WA</button>}</> : hasGallery ? <><button onClick={handleSendGallery} className="btn-secondary flex-1 px-3 py-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"><Images className="h-3.5 w-3.5" />Kirim Galeri WA</button><button onClick={() => onComplete(item.code)} disabled={processing !== ''} className="btn-secondary flex-1 px-3 py-2 text-xs text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Tandai selesai</button></> : item.status === 'confirmed' ? <><button onClick={handleSendReceipt} className="btn-secondary flex-1 px-3 py-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"><MessageCircle className="h-3.5 w-3.5" />Kirim Resi WA</button><button onClick={onCreateGallery} className="btn-secondary flex-1 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Buat galeri</button></> : item.payment_status === 'pending' ? <span className="text-xs text-[var(--muted)]">Menunggu bukti pembayaran</span> : null}<button onClick={() => onDelete(item.code)} disabled={processing !== ''} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash className="h-3.5 w-3.5" />Hapus</button></div></div></article>;
}

function GalleryCard({ gallery, copied, onCopy, onDelete }: { gallery: GalleryItem; copied: boolean; onCopy: () => void; onDelete: () => void }) {
  const count = gallery.photos?.length || 0; const selected = gallery.selection?.total_selected || 0;
  const photo = gallery.photos && gallery.photos.length > 0 ? gallery.photos[0] : null;
  return <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white relative"><button onClick={onDelete} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-red-600 shadow-sm backdrop-blur transition hover:bg-red-50 hover:text-red-700" title="Hapus Galeri"><Trash className="h-4 w-4" /></button><div className="flex h-28 items-center justify-center bg-[var(--surface2)] overflow-hidden">{photo ? <img src={`https://lh3.googleusercontent.com/d/${encodeURIComponent(photo.drive_file_id)}=w600`} alt="Thumbnail" className="h-full w-full object-cover" /> : <Images className="h-8 w-8 text-[var(--gold-dark)]" />}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><Status value={gallery.status} /><h2 className="mt-3 font-serif text-2xl font-semibold leading-tight">{gallery.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{gallery.client_name || 'Tanpa nama klien'}</p></div><span className="shrink-0 rounded-full bg-[var(--surface2)] px-3 py-1 text-xs font-bold">{count} foto</span></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-[var(--muted)]">Pilihan klien</span><strong>{selected} / {gallery.max_selection || '∞'}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${gallery.max_selection ? Math.min(100, selected / gallery.max_selection * 100) : 0}%` }} /></div></div><div className="mt-5 flex gap-2"><Link href={`/g/${gallery.slug}`} target="_blank" className="btn-secondary flex-1 px-3 py-2.5 text-xs"><ExternalLink className="h-3.5 w-3.5" />Lihat</Link><button onClick={onCopy} className="btn-primary flex-1 px-3 py-2.5 text-xs">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Tersalin' : 'Salin link'}</button></div></div></article>;
}

function CreateGalleryModal({ form, setForm, bookings, creating, onClose, onSubmit }: { form: typeof emptyGalleryForm; setForm: React.Dispatch<React.SetStateAction<typeof emptyGalleryForm>>; bookings: BookingItem[]; creating: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => event.target === event.currentTarget && onClose()}><form onSubmit={onSubmit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Galeri klien</p><h2 className="mt-1 font-serif text-3xl">Buat galeri pilihan</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Folder Drive harus dapat dilihat oleh siapa saja yang memiliki link.</p></div><button type="button" onClick={onClose} disabled={creating} className="rounded-full border border-[var(--line)] p-2"><X className="h-4 w-4" /></button></div><div className="mt-7 space-y-4"><Field label="Hubungkan ke booking"><select value={form.booking_id} onChange={event => { const booking = bookings.find(item => item.id === Number(event.target.value)); setForm({ ...form, booking_id: event.target.value, title: booking ? `Foto Wisuda — ${booking.full_name}` : form.title, client_name: booking?.full_name || form.client_name, max_selection: 0 }); }} className="admin-field"><option value="">Tanpa booking</option>{bookings.filter(item => item.status === 'confirmed').map(item => <option key={item.id} value={item.id}>{item.full_name} · {item.package.name}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Judul galeri"><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="admin-field" placeholder="Foto Wisuda — Nama" /></Field><Field label="Nama klien"><input value={form.client_name} onChange={event => setForm({ ...form, client_name: event.target.value })} className="admin-field" /></Field></div><Field label="Link folder Google Drive publik"><input required type="url" value={form.drive_url} onChange={event => setForm({ ...form, drive_url: event.target.value })} className="admin-field" placeholder="https://drive.google.com/drive/folders/..." /></Field><Field label="Kuota pilihan"><input min="0" type="number" value={form.max_selection} onChange={event => setForm({ ...form, max_selection: Number(event.target.value) })} className="admin-field" /><span className="mt-1 block text-[11px] text-[var(--muted)]">Isi 0 agar mengikuti kuota paket atau tanpa batas.</span></Field></div><div className="mt-7 flex gap-3"><button type="button" onClick={onClose} disabled={creating} className="btn-secondary flex-1 px-5 py-3.5 text-sm">Batal</button><button disabled={creating} className="btn-primary flex-[1.5] px-5 py-3.5 text-sm disabled:opacity-50">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{creating ? 'Memuat foto...' : 'Simpan & Muat Foto'}</button></div></form></div>;
}

function Stat({ icon, label, value, emphasis = false }: { icon: React.ReactNode; label: string; value: number; emphasis?: boolean }) { return <div className={`rounded-2xl border p-4 sm:p-5 ${emphasis ? 'border-amber-300 bg-amber-50' : 'border-[var(--line)] bg-white'}`}><div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4 ${emphasis ? 'bg-amber-200 text-amber-900' : 'bg-[var(--surface2)] text-[var(--gold-dark)]'}`}>{icon}</span><strong className="font-serif text-3xl">{value}</strong></div><p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p></div>; }
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold sm:flex-none ${active ? 'bg-[var(--text)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface2)]'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}{label}</button>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${active ? 'bg-[var(--gold-glow)] text-[var(--gold-dark)]' : 'text-[var(--muted)] hover:bg-[var(--surface2)]'}`}>{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>; }
function Status({ value }: { value: string }) { const styles: Record<string, string> = { verified: 'bg-emerald-100 text-emerald-800', confirmed: 'bg-emerald-100 text-emerald-800', completed: 'bg-emerald-100 text-emerald-800', submitted: 'bg-blue-100 text-blue-800', active: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800', pending_payment: 'bg-amber-100 text-amber-800', archived: 'bg-slate-100 text-slate-700' }; const labels: Record<string, string> = { verified: 'Terverifikasi', confirmed: 'Terkonfirmasi', completed: 'Selesai', submitted: 'Perlu diperiksa', active: 'Aktif', pending: 'Menunggu bukti', pending_payment: 'Menunggu pembayaran', archived: 'Diarsipkan' }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${styles[value] || 'bg-slate-100 text-slate-700'}`}>{labels[value] || value.replaceAll('_', ' ')}</span>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface2)] text-[var(--gold-dark)] [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 text-xs text-[var(--muted)]">{text}</p></div>; }
function DashboardSkeleton() { return <div className="mt-5 space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl border border-[var(--line)] bg-white" />)}</div>; }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date); }

function PackageCard({ pkg, onEdit, onDelete }: { pkg: PackageItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white relative flex flex-col">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[var(--gold-dark)] shadow-sm backdrop-blur transition hover:bg-white" title="Edit Paket"><Edit2 className="h-4 w-4" /></button>
        <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm backdrop-blur transition hover:bg-red-50 hover:text-red-700" title="Hapus Paket"><Trash className="h-4 w-4" /></button>
      </div>
      <div className="flex h-32 items-center justify-center bg-[var(--surface2)] overflow-hidden">
        {pkg.image_path ? <img src={getImageUrl(pkg.image_path)} alt={pkg.name} className="h-full w-full object-cover" /> : <PackageIcon className="h-8 w-8 text-[var(--gold-dark)]" />}
      </div>
      <div className="flex flex-col p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${pkg.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{pkg.is_active ? 'Aktif' : 'Tidak Aktif'}</span>
            <h2 className="mt-2 font-serif text-xl font-semibold leading-tight">{pkg.name}</h2>
            <p className="font-mono text-[10px] text-[var(--muted)]">{pkg.code}</p>
          </div>
          <strong className="text-sm text-[var(--gold-dark)] whitespace-nowrap">{formatRupiah(pkg.price)}</strong>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)] line-clamp-2">{pkg.description}</p>
      </div>
    </article>
  );
}

function CreatePackageModal({ form, setForm, creating, onClose, onSubmit }: { form: PackageItem; setForm: React.Dispatch<React.SetStateAction<any>>; creating: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => {
    return () => {
      if (localPreview.startsWith('blob:')) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    try {
      const token = localStorage.getItem('kleiora_token') || '';
      const res = await uploadPackageImage(file, token);
      setForm((current: PackageItem) => ({ ...current, image_path: res.path }));
    } catch (err) {
      setLocalPreview('');
      alert(err instanceof Error ? err.message : 'Gagal upload gambar');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Manajemen Paket</p>
            <h2 className="mt-1 font-serif text-3xl">{form.id ? 'Edit Paket' : 'Buat Paket Baru'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={creating || uploading} className="rounded-full border border-[var(--line)] p-2"><X className="h-4 w-4" /></button>
        </div>
        
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Field label="Nama Paket"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="admin-field" placeholder="Contoh: Personal Package" /></Field>
          <Field label="Kode Paket"><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="admin-field" placeholder="Contoh: personal-1" /></Field>
          
          <div className="sm:col-span-2">
            <Field label="Harga (Rp)"><input required type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="admin-field" /></Field>
          </div>
          
          <div className="sm:col-span-2">
            <Field label="Deskripsi Singkat"><textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="admin-field min-h-[80px]" placeholder="Penjelasan paket..." /></Field>
          </div>

          <Field label="Durasi (Jam)"><input required type="number" min="1" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: Number(e.target.value) })} className="admin-field" /></Field>
          <Field label="Label Durasi (Opsional)"><input value={form.duration_label || ''} onChange={e => setForm({ ...form, duration_label: e.target.value })} className="admin-field" placeholder="Contoh: 1 jam 30 menit" /></Field>
          
          <Field label="Jumlah Lokasi"><input required type="number" min="1" value={form.location_count} onChange={e => setForm({ ...form, location_count: Number(e.target.value) })} className="admin-field" /></Field>
          <Field label="Jumlah Foto Edit"><input required type="number" min="0" value={form.edited_photos} onChange={e => setForm({ ...form, edited_photos: Number(e.target.value) })} className="admin-field" /></Field>
          
          <div className="sm:col-span-2 p-4 border border-[var(--line)] rounded-xl bg-[var(--surface2)]">
            <Field label="Foto Paket">
              <div className="flex items-center gap-4 mt-2">
                {form.image_path ? (
                  <img src={localPreview || getImageUrl(form.image_path)} alt="Preview" className="h-16 w-24 object-cover rounded-lg border border-[var(--line)]" />
                ) : localPreview ? (
                  <img src={localPreview} alt="Preview" className="h-16 w-24 object-cover rounded-lg border border-[var(--line)]" />
                ) : (
                  <div className="h-16 w-24 flex items-center justify-center bg-white rounded-lg border border-dashed border-[var(--line)]"><ImageIcon className="h-6 w-6 text-slate-300"/></div>
                )}
                <div className="flex-1">
                  <label className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs cursor-pointer">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploading ? 'Mengupload...' : 'Pilih Gambar'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} disabled={uploading} />
                  </label>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">Format JPG, PNG, atau WEBP.</p>
                </div>
              </div>
            </Field>
          </div>
          
          <div className="sm:col-span-2 flex items-center gap-2 mt-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-[var(--gold)] focus:ring-[var(--gold)]" />
            <label htmlFor="is_active" className="text-sm font-bold text-gray-700">Aktifkan paket ini (Tampil di publik)</label>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button type="button" onClick={onClose} disabled={creating || uploading} className="btn-secondary flex-1 px-5 py-3.5 text-sm">Batal</button>
          <button disabled={creating || uploading} className="btn-primary flex-[1.5] px-5 py-3.5 text-sm disabled:opacity-50">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {creating ? 'Menyimpan...' : 'Simpan Paket'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PortfolioCard({ portfolio, onEdit, onDelete }: { portfolio: PortfolioItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[var(--gold-dark)] shadow-sm backdrop-blur transition hover:bg-white" title="Edit Portofolio"><Edit2 className="h-4 w-4" /></button>
        <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm backdrop-blur transition hover:bg-red-50 hover:text-red-700" title="Hapus Portofolio"><Trash className="h-4 w-4" /></button>
      </div>
      <div className="aspect-[3/4] w-full bg-[var(--surface2)]">
        {portfolio.image_path ? (
          <img src={getImageUrl(portfolio.image_path)} alt={portfolio.title || 'Portfolio'} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-slate-300" /></div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white line-clamp-1">{portfolio.title || 'Tanpa Judul'}</h3>
          <span className={`flex h-2 w-2 rounded-full ${portfolio.is_active ? 'bg-emerald-400' : 'bg-slate-400'}`} title={portfolio.is_active ? 'Aktif' : 'Disembunyikan'} />
        </div>
      </div>
    </div>
  );
}

function CreatePortfolioModal({ form, setForm, creating, onClose, onSubmit }: { form: PortfolioItem; setForm: React.Dispatch<React.SetStateAction<any>>; creating: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('kleiora_token') || '';
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const res = await uploadPortfolioImage(files[i], token);
        paths.push(res.path);
      }
      setForm({ ...form, image_path: paths.join(',') });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  };

  const imagePaths = form.image_path ? form.image_path.split(',') : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Manajemen Portofolio</p>
            <h2 className="mt-1 font-serif text-3xl">{form.id ? 'Edit Foto' : 'Upload Foto Baru'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={creating || uploading} className="rounded-full border border-[var(--line)] p-2"><X className="h-4 w-4" /></button>
        </div>
        
        <div className="mt-7 space-y-4">
          <div className="p-4 border border-[var(--line)] rounded-xl bg-[var(--surface2)]">
            <Field label="Foto Portofolio (Rekomendasi rasio 3:4)">
              <div className="mt-2 flex flex-col items-center gap-4">
                {imagePaths.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {imagePaths.map((p, i) => (
                      <img key={i} src={getImageUrl(p)} alt="Preview" className="h-40 w-32 object-cover rounded-lg border border-[var(--line)] shadow-sm" />
                    ))}
                  </div>
                ) : (
                  <div className="h-40 w-32 flex items-center justify-center bg-white rounded-lg border border-dashed border-[var(--line)]"><ImageIcon className="h-8 w-8 text-slate-300"/></div>
                )}
                <div className="w-full">
                  <label className="btn-secondary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs cursor-pointer">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploading ? 'Mengupload...' : (form.id ? 'Pilih Gambar' : 'Pilih Gambar (Bisa Banyak sekaligus)')}
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple={!form.id} className="hidden" onChange={handleImageChange} disabled={uploading} />
                  </label>
                  <p className="mt-2 text-center text-[10px] text-[var(--muted)]">Format JPG, PNG, atau WEBP. Maks 5MB per gambar.</p>
                </div>
              </div>
            </Field>
          </div>
          
          <Field label="Judul/Keterangan (Opsional)"><input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="admin-field" placeholder="Contoh: Graduation Session" /></Field>
          
          <div className="grid grid-cols-2 gap-4">
            <Field label="Urutan Tampil (Sort)"><input type="number" min="0" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="admin-field" /></Field>
            <div className="flex flex-col justify-end pb-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="port_is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-[var(--gold)] focus:ring-[var(--gold)]" />
                <label htmlFor="port_is_active" className="text-sm font-bold text-gray-700">Tampilkan foto</label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button type="button" onClick={onClose} disabled={creating || uploading} className="btn-secondary flex-1 px-5 py-3.5 text-sm">Batal</button>
          <button disabled={creating || uploading || !form.image_path} className="btn-primary flex-1 px-5 py-3.5 text-sm disabled:opacity-50">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {creating ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </form>
    </div>
  );
}
