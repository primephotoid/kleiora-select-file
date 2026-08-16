'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Check, CheckCircle2, Clock3, Copy, ExternalLink, ImageIcon,
  Images, Loader2, LogOut, MapPin, MessageCircle, Plus, ReceiptText, Search,
  ShieldCheck, Trash, UserRound, WalletCards, X,
} from 'lucide-react';
import { API_BASE_URL, apiRequest, BookingItem, formatRupiah } from '@/lib/api';

interface GalleryItem {
  id: number; slug: string; title: string; client_name: string; max_selection: number;
  status: string; booking_id?: number; photos?: { drive_file_id: string }[]; selection?: { total_selected: number };
}

type DashboardTab = 'bookings' | 'galleries';
type BookingFilter = 'all' | 'needs_action' | 'confirmed' | 'completed';

const emptyGalleryForm = { title: '', drive_url: '', client_name: '', client_email: '', booking_id: '', max_selection: 0 };

export default function DashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DashboardTab>('bookings');
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState('');
  const [adminName, setAdminName] = useState('Admin');
  const [form, setForm] = useState(emptyGalleryForm);

  function authHeaders() {
    const token = localStorage.getItem('kleiora_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load(background = false) {
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [bookingData, galleryData] = await Promise.all([
        apiRequest<{ bookings: BookingItem[] }>('/studio/bookings', { headers: authHeaders() }),
        apiRequest<{ galleries: GalleryItem[] }>('/studio/galleries', { headers: authHeaders() }),
      ]);
      setBookings(bookingData.bookings);
      setGalleries(galleryData.galleries);
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

  const isGalleryActive = (g: GalleryItem) => g.status === 'active' && (!g.selection || !g.selection.total_selected);

  const stats = useMemo(() => {
    const completedCount = bookings.filter(item => item.status === 'completed' || item.gallery?.status === 'submitted' || !!item.gallery?.selection).length;
    const confirmedCount = bookings.filter(item => (item.status === 'confirmed' || item.payment_status === 'verified') && !(item.status === 'completed' || item.gallery?.status === 'submitted' || !!item.gallery?.selection)).length;
    return {
      total: bookings.length,
      needsAction: bookings.filter(item => item.payment_status === 'submitted' && item.status !== 'completed').length,
      confirmed: confirmedCount,
      completed: completedCount,
      activeGalleries: galleries.filter(isGalleryActive).length,
    };
  }, [bookings, galleries]);

  const filteredBookings = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return bookings.filter(item => {
      const isCompleted = item.status === 'completed' || item.gallery?.status === 'submitted' || !!item.gallery?.selection;
      const matchesFilter = filter === 'all' ||
        (filter === 'needs_action' && item.payment_status === 'submitted' && !isCompleted) ||
        (filter === 'confirmed' && (item.status === 'confirmed' || item.payment_status === 'verified') && !isCompleted) ||
        (filter === 'completed' && isCompleted);
      const matchesSearch = !keyword || [item.full_name, item.code, item.whatsapp, item.campus_name, item.package.name].some(value => value?.toLowerCase().includes(keyword));
      return matchesFilter && matchesSearch;
    });
  }, [bookings, filter, search]);

  async function verify(code: string) {
    setProcessing(code); setError('');
    try {
      await apiRequest(`/studio/bookings/${code}/verify-payment`, { method: 'PATCH', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Verifikasi gagal.'); }
    finally { setProcessing(''); }
  }

  async function viewProof(code: string) {
    setProcessing(`proof-${code}`); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/studio/bookings/${code}/payment-proof`, { credentials: 'include', headers: authHeaders() });
      if (!response.ok) throw new Error('Bukti pembayaran tidak dapat dibuka.');
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

  async function deleteBooking(code: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus booking ${code}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setRefreshing(true); setError('');
    try {
      await apiRequest(`/studio/bookings/${code}`, { method: 'DELETE', headers: authHeaders() });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Booking gagal dihapus.'); setRefreshing(false); }
  }

  async function markComplete(code: string) {
    setProcessing(code); setError('');
    try {
      await apiRequest(`/studio/bookings/${code}/complete`, { method: 'PATCH', headers: authHeaders() });
      await load(true);
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
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full px-6 py-3.5 text-sm sm:w-auto"><Plus className="h-4 w-4" />Buat Galeri</button>
        </section>

        {error && <div role="alert" className="mt-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan"><X className="h-4 w-4" /></button></div>}

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={<ReceiptText />} label="Total booking" value={stats.total} />
          <Stat icon={<Clock3 />} label="Perlu diperiksa" value={stats.needsAction} emphasis={stats.needsAction > 0} />
          <Stat icon={<ShieldCheck />} label="Terverifikasi" value={stats.confirmed} />
          <Stat icon={<CheckCircle2 />} label="Selesai" value={stats.completed} />
          <Stat icon={<Images />} label="Galeri aktif" value={stats.activeGalleries} />
        </section>

        <div className="mt-8 flex gap-1 rounded-2xl border border-[var(--line)] bg-white p-1.5 sm:w-fit">
          <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')} icon={<ReceiptText />} label={`Booking (${bookings.length})`} />
          <TabButton active={tab === 'galleries'} onClick={() => setTab('galleries')} icon={<Images />} label={`Galeri (${galleries.filter(isGalleryActive).length})`} />
        </div>

        {loading ? <DashboardSkeleton /> : tab === 'bookings' ? (
          <section className="mt-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl bg-[var(--surface2)] py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-[var(--gold)]" placeholder="Cari nama, kode, WhatsApp..." /></div>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0"><FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton><FilterButton active={filter === 'needs_action'} onClick={() => setFilter('needs_action')}>Perlu diperiksa</FilterButton><FilterButton active={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>Terverifikasi</FilterButton><FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>Selesai</FilterButton><button onClick={() => load(true)} disabled={refreshing} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:opacity-50">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Muat ulang'}</button></div>
            </div>
            <div className="mt-4 space-y-3">{filteredBookings.map(item => <BookingCard key={item.id} item={item} processing={processing} onVerify={verify} onViewProof={viewProof} onDelete={deleteBooking} onComplete={markComplete} onCreateGallery={() => { setForm({ ...emptyGalleryForm, booking_id: String(item.id), title: `Foto Wisuda — ${item.full_name}`, client_name: item.full_name }); setShowCreate(true); }} />)}{!filteredBookings.length && <Empty icon={<Search />} title="Booking tidak ditemukan" text="Coba ubah kata pencarian atau filter status." />}</div>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{galleries.filter(isGalleryActive).map(gallery => <GalleryCard key={gallery.id} gallery={gallery} copied={copied === gallery.slug} onCopy={() => copyLink(gallery.slug)} onDelete={() => deleteGallery(gallery.id)} />)}{!galleries.filter(isGalleryActive).length && <div className="sm:col-span-2 lg:col-span-3"><Empty icon={<ImageIcon />} title="Belum ada galeri" text="Buat galeri dari booking yang sudah dikonfirmasi." /></div>}</section>
        )}
      </main>

      {showCreate && <CreateGalleryModal form={form} setForm={setForm} bookings={bookings} creating={creating} onClose={() => !creating && setShowCreate(false)} onSubmit={createGallery} />}
      <style jsx global>{`.admin-field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.admin-field:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-glow)}`}</style>
    </div>
  );
}

function BookingCard({ item, processing, onVerify, onViewProof, onCreateGallery, onDelete, onComplete }: { item: BookingItem; processing: string; onVerify: (code: string) => void; onViewProof: (code: string) => void; onCreateGallery: () => void; onDelete: (code: string) => void; onComplete: (code: string) => void }) {
  const whatsapp = item.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const hasGallery = !!item.gallery;
  const isCompleted = item.status === 'completed' || item.gallery?.status === 'submitted' || !!item.gallery?.selection;

  return <article className="rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[#d4c4ac] hover:shadow-sm"><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.full_name}</h2><Status value={isCompleted ? 'completed' : item.payment_status} /></div><p className="mt-1 text-xs text-[var(--muted)]">{item.campus_name} · <span className="font-mono">{item.code}</span></p><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />{item.whatsapp}</a></div><div className="space-y-2 text-sm"><p className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-[var(--gold-dark)]" />{formatDate(item.session_date)} · {item.session_hour}.00</p><p className="flex items-center gap-2 text-xs text-[var(--muted)]"><MapPin className="h-3.5 w-3.5" />{item.session_location}</p></div><div><p className="text-sm font-semibold">{item.package.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.payment_type === 'dp' ? 'DP 50%' : 'Lunas'} · {formatRupiah(item.amount_due)}</p></div><div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">{item.payment_status === 'submitted' && !isCompleted && <><button onClick={() => onViewProof(item.code)} disabled={processing !== ''} className="btn-secondary flex-1 px-3 py-2 text-xs">{processing === `proof-${item.code}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}Lihat bukti</button><button onClick={() => onVerify(item.code)} disabled={processing !== ''} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{processing === item.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Verifikasi</button></>}{isCompleted ? <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Selesai (Pilihan terkirim)</span> : hasGallery ? <><span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 border border-blue-200"><Images className="h-3.5 w-3.5" />Galeri dibuat</span><button onClick={() => onComplete(item.code)} disabled={processing !== ''} className="btn-secondary flex-1 px-3 py-2 text-xs text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Tandai selesai</button></> : item.status === 'confirmed' ? <button onClick={onCreateGallery} className="btn-secondary flex-1 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Buat galeri</button> : item.payment_status === 'pending' ? <span className="text-xs text-[var(--muted)]">Menunggu bukti pembayaran</span> : null}<button onClick={() => onDelete(item.code)} disabled={processing !== ''} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash className="h-3.5 w-3.5" />Hapus</button></div></div></article>;
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
