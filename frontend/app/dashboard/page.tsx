'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Copy, Images, Loader2, LogOut, Plus, ReceiptText, X } from 'lucide-react';
import { apiRequest, BookingItem, formatRupiah } from '@/lib/api';

interface GalleryItem { id: number; slug: string; title: string; client_name: string; max_selection: number; status: string; booking_id?: number; photos?: object[]; selection?: { total_selected: number } }

export default function DashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'bookings'|'galleries'>('bookings');
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({ title:'', drive_url:'', client_name:'', client_email:'', booking_id:'', max_selection:0 });

  function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem('kleiora_token') ?? ''}` }; }
  async function load() {
    const token = localStorage.getItem('kleiora_token');
    if (!token) { router.replace('/studio/login'); return; }
    try {
      const [bookingData, galleryData] = await Promise.all([
        apiRequest<{bookings:BookingItem[]}>('/studio/bookings', { headers: authHeaders() }),
        apiRequest<{galleries:GalleryItem[]}>('/studio/galleries', { headers: authHeaders() }),
      ]);
      setBookings(bookingData.bookings); setGalleries(galleryData.galleries);
    } catch (err) { setError(err instanceof Error ? err.message : 'Data studio gagal dimuat.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(code:string) {
    try { await apiRequest(`/studio/bookings/${code}/verify-payment`, { method:'PATCH', headers:authHeaders() }); await load(); }
    catch(err) { setError(err instanceof Error ? err.message : 'Verifikasi gagal.'); }
  }
  async function createGallery(event:FormEvent) {
    event.preventDefault(); setError('');
    try {
      const payload = {...form, booking_id: form.booking_id ? Number(form.booking_id) : undefined};
      await apiRequest('/studio/galleries', { method:'POST', headers:authHeaders(), body:JSON.stringify(payload) });
      setShowCreate(false); setForm({title:'',drive_url:'',client_name:'',client_email:'',booking_id:'',max_selection:0}); await load(); setTab('galleries');
    } catch(err) { setError(err instanceof Error ? err.message : 'Galeri gagal dibuat.'); }
  }
  function logout(){ localStorage.removeItem('kleiora_token'); localStorage.removeItem('kleiora_user'); router.push('/studio/login'); }
  async function copyLink(slug:string){ const url=`${window.location.origin}/g/${slug}`; await navigator.clipboard.writeText(url); setCopied(slug); setTimeout(()=>setCopied(''),1800); }

  return <div className="min-h-screen bg-[var(--bg)]"><header className="border-b border-[var(--line)] bg-[var(--surface)]"><div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6"><Link href="/" className="font-serif text-2xl font-semibold">Kleiora<span className="text-[var(--gold)]">.studio</span></Link><button onClick={logout} className="btn-secondary px-4 py-2 text-xs"><LogOut className="h-4 w-4"/>Keluar</button></div></header><main className="mx-auto max-w-6xl px-6 py-12"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Dashboard studio</p><h1 className="mt-2 font-serif text-4xl">Booking & galeri klien</h1></div><button onClick={()=>setShowCreate(true)} className="btn-primary px-5 py-3 text-sm"><Plus className="h-4 w-4"/>Buat Galeri</button></div>{error&&<div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}<div className="mt-9 flex gap-2 border-b border-[var(--line)]"><button onClick={()=>setTab('bookings')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab==='bookings'?'border-[var(--gold)] text-[var(--gold-dark)]':'border-transparent text-[var(--muted)]'}`}><ReceiptText className="h-4 w-4"/>Booking ({bookings.length})</button><button onClick={()=>setTab('galleries')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab==='galleries'?'border-[var(--gold)] text-[var(--gold-dark)]':'border-transparent text-[var(--muted)]'}`}><Images className="h-4 w-4"/>Galeri ({galleries.length})</button></div>{loading?<div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin"/></div>:tab==='bookings'?<div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-[var(--surface2)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-4">Pelanggan</th><th className="p-4">Jadwal</th><th className="p-4">Paket</th><th className="p-4">Pembayaran</th><th className="p-4">Aksi</th></tr></thead><tbody>{bookings.map(item=><tr key={item.id} className="border-t border-[var(--line)]"><td className="p-4"><strong>{item.full_name}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.code}</span></td><td className="p-4"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--gold-dark)]"/>{item.session_date} · {item.session_hour}.00 WITA</span><span className="mt-1 block text-xs text-[var(--muted)]">{item.session_location}</span></td><td className="p-4">{item.package.name}<span className="block text-xs text-[var(--muted)]">{formatRupiah(item.amount_due)}</span></td><td className="p-4"><Status value={item.payment_status}/></td><td className="p-4">{item.payment_status==='submitted'&&<button onClick={()=>verify(item.code)} className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white">Verifikasi</button>}</td></tr>)}</tbody></table>{!bookings.length&&<Empty text="Belum ada booking masuk."/>}</div>:<div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{galleries.map(g=><article key={g.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex items-start justify-between gap-3"><div><Status value={g.status}/><h2 className="mt-3 font-serif text-xl font-semibold">{g.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{g.client_name||'Tanpa nama klien'}</p></div><span className="text-xs text-[var(--muted)]">{g.photos?.length||0} foto</span></div><p className="mt-5 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">Dipilih: <strong className="text-[var(--text)]">{g.selection?.total_selected||0} / {g.max_selection||'∞'}</strong></p><div className="mt-4 flex gap-2"><Link href={`/g/${g.slug}`} className="btn-secondary flex-1 px-3 py-2 text-xs">Lihat</Link><button onClick={()=>copyLink(g.slug)} className="btn-primary flex-1 px-3 py-2 text-xs">{copied===g.slug?<Check className="h-3 w-3"/>:<Copy className="h-3 w-3"/>}{copied===g.slug?'Tersalin':'Salin Link'}</button></div></article>)}{!galleries.length&&<div className="md:col-span-2 lg:col-span-3"><Empty text="Belum ada galeri. Buat galeri dari booking yang sudah dikonfirmasi."/></div>}</div>}</main>{showCreate&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={createGallery} className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Buat galeri pilihan</h2><button type="button" onClick={()=>setShowCreate(false)}><X className="h-5 w-5"/></button></div><div className="mt-6 space-y-4"><Field label="Hubungkan ke booking"><select value={form.booking_id} onChange={e=>{const booking=bookings.find(b=>b.id===Number(e.target.value));setForm({...form,booking_id:e.target.value,title:booking?`Foto Wisuda — ${booking.full_name}`:form.title,client_name:booking?.full_name||form.client_name,max_selection:0})}} className="field"><option value="">Tanpa booking</option>{bookings.filter(b=>b.status==='confirmed').map(b=><option key={b.id} value={b.id}>{b.full_name} · {b.package.name}</option>)}</select></Field><Field label="Judul galeri"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="field"/></Field><Field label="Nama klien"><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} className="field"/></Field><Field label="Link folder Google Drive publik"><input required value={form.drive_url} onChange={e=>setForm({...form,drive_url:e.target.value})} className="field" placeholder="https://drive.google.com/drive/folders/..."/></Field><Field label="Kuota pilihan (0 = mengikuti paket / tanpa batas)"><input min="0" type="number" value={form.max_selection} onChange={e=>setForm({...form,max_selection:Number(e.target.value)})} className="field"/></Field></div><button className="btn-primary mt-6 w-full px-5 py-3.5">Simpan & Muat Foto</button></form></div>}<style jsx global>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.75rem;font-size:.875rem;outline:none}.field:focus{border-color:var(--gold)}`}</style></div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>}
function Status({value}:{value:string}){const good=['verified','confirmed','submitted'].includes(value);return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${good?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{value.replaceAll('_',' ')}</span>}
function Empty({text}:{text:string}){return <div className="p-12 text-center text-sm text-[var(--muted)]">{text}</div>}
