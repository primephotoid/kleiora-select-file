'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Loader2, Upload } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { apiRequest, BookingItem, formatRupiah, PackageItem } from '@/lib/api';

interface Slot { hour: string; remaining: number; available: boolean }

function todayInMakassar() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedCode, setSelectedCode] = useState(searchParams.get('package') ?? '');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<BookingItem | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [proofSent, setProofSent] = useState(false);
  const [form, setForm] = useState({ full_name: '', campus_name: '', whatsapp: '', session_date: '', session_hour: '', session_location: '', payment_type: 'full', notes: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function updateField(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateForm() {
    const errors: Record<string, string> = {};
    if (form.full_name.trim().length < 3) errors.full_name = 'Masukkan nama lengkap minimal 3 karakter.';
    if (form.campus_name.trim().length < 2) errors.campus_name = 'Masukkan nama kampus.';
    if (!/^[0-9+][0-9 -]{7,19}$/.test(form.whatsapp.trim())) errors.whatsapp = 'Gunakan nomor WhatsApp yang valid, misalnya 081234567890.';
    if (!form.session_date) errors.session_date = 'Pilih tanggal sesi.';
    if (!form.session_hour) errors.session_hour = 'Pilih jam sesi yang tersedia.';
    if (form.session_location.trim().length < 3) errors.session_location = 'Masukkan lokasi sesi.';
    return errors;
  }

  useEffect(() => {
    apiRequest<{ packages: PackageItem[] }>('/packages')
      .then(data => {
        setPackages(data.packages);
        if (!selectedCode && data.packages[0]) setSelectedCode(data.packages[0].code);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.session_date) { setSlots([]); return; }
    setSlotsLoading(true);
    setForm(current => ({ ...current, session_hour: '' }));
    apiRequest<{ slots: Slot[] }>(`/availability?date=${form.session_date}`)
      .then(data => setSlots(data.slots))
      .catch(err => setError(err.message))
      .finally(() => setSlotsLoading(false));
  }, [form.session_date]);

  const selectedPackage = useMemo(() => packages.find(pkg => pkg.code === selectedCode), [packages, selectedCode]);

  async function createBooking(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Periksa kembali data yang ditandai di bawah ini.');
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await apiRequest<{ booking: BookingItem }>('/bookings', { method: 'POST', body: JSON.stringify({ ...form, package_code: selectedCode }) });
      setBooking(result.booking);
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking gagal dibuat.');
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProof() {
    if (!proof || !booking) return;
    setError('');
    setSubmitting(true);
    const body = new FormData();
    body.append('proof', proof);
    body.append('payment_method', 'manual_transfer');
    try {
      await apiRequest(`/bookings/${booking.code}/payment-proof`, { method: 'POST', body });
      setProofSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bukti pembayaran gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto min-h-[85vh] max-w-6xl px-6 pb-24 pt-32">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Booking sesi foto</p><h1 className="mt-2 font-serif text-4xl font-medium">Siapkan momen wisudamu</h1></div>
          <div className="hidden items-center gap-2 text-xs font-semibold sm:flex">{['Paket', 'Data sesi', 'Konfirmasi'].map((label, index) => <div key={label} className={`rounded-full px-4 py-2 ${step >= index + 1 ? 'bg-[var(--text)] text-[var(--surface)]' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>{index + 1}. {label}</div>)}</div>
        </div>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 1 && (
          <section>
            {loading ? <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[var(--gold-dark)]" /></div> : (
              <div className="grid gap-6 lg:grid-cols-3">
                {packages.map(pkg => <button key={pkg.code} onClick={() => setSelectedCode(pkg.code)} className={`overflow-hidden rounded-3xl border bg-[var(--surface)] text-left transition ${selectedCode === pkg.code ? 'border-[var(--gold)] ring-2 ring-[var(--gold-glow)]' : 'border-[var(--line)] hover:-translate-y-1'}`}><div className="relative aspect-[16/9]"><Image src={pkg.image_path} alt={pkg.name} fill className="object-cover object-[center_30%]" sizes="(max-width:1024px) 100vw, 33vw" /></div><div className="p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">{pkg.name}</h2><p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(pkg.price)}</p></div>{selectedCode === pkg.code && <span className="rounded-full bg-[var(--gold)] p-1.5 text-white"><Check className="h-4 w-4" /></span>}</div><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{pkg.description}</p><div className="mt-5 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]"><span>{pkg.duration_hours} jam</span><span>{pkg.location_count} lokasi</span><span>{pkg.edited_photos} foto edited</span><span>Semua soft file</span></div></div></button>)}
              </div>
            )}
            <div className="mt-8 flex justify-end"><button disabled={!selectedPackage} onClick={() => setStep(2)} className="btn-primary px-7 py-3.5 disabled:opacity-40">Isi Data Sesi <ArrowRight className="h-4 w-4" /></button></div>
          </section>
        )}

        {step === 2 && selectedPackage && (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="h-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 lg:sticky lg:top-28"><div className="relative aspect-[4/3] overflow-hidden rounded-xl"><Image src={selectedPackage.image_path} alt={selectedPackage.name} fill className="object-cover" sizes="300px" /></div><h2 className="mt-5 font-serif text-2xl font-semibold">{selectedPackage.name}</h2><p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(selectedPackage.price)}</p><p className="mt-4 text-xs leading-5 text-[var(--muted)]">Kuota pilihan setelah sesi: {selectedPackage.edited_photos} foto.</p><button onClick={() => setStep(1)} className="btn-secondary mt-5 w-full px-4 py-2.5 text-sm"><ArrowLeft className="h-4 w-4" /> Ubah Paket</button></aside>
            <form noValidate onSubmit={createBooking} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <h2 className="font-serif text-3xl font-medium">Lengkapi data dirimu</h2><p className="mt-2 text-sm text-[var(--muted)]">Kami menggunakan data ini untuk mengatur jadwal dan menghubungimu.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="Nama lengkap" error={fieldErrors.full_name}><input required aria-invalid={Boolean(fieldErrors.full_name)} value={form.full_name} onChange={e => updateField('full_name', e.target.value)} className="field" placeholder="Nama lengkapmu" /></Field>
                <Field label="Asal kampus" error={fieldErrors.campus_name}><input required aria-invalid={Boolean(fieldErrors.campus_name)} value={form.campus_name} onChange={e => updateField('campus_name', e.target.value)} className="field" placeholder="Universitas / kampus" /></Field>
                <Field label="Nomor WhatsApp" error={fieldErrors.whatsapp}><input required type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(fieldErrors.whatsapp)} value={form.whatsapp} onChange={e => updateField('whatsapp', e.target.value)} className="field" placeholder="Contoh: 081234567890" /></Field>
                <Field label="Tanggal sesi" error={fieldErrors.session_date}><input required type="date" min={todayInMakassar()} aria-invalid={Boolean(fieldErrors.session_date)} value={form.session_date} onChange={e => updateField('session_date', e.target.value)} className="field" /></Field>
                <Field label="Jam sesi (WITA)" error={fieldErrors.session_hour}><select required disabled={!form.session_date || slotsLoading} aria-invalid={Boolean(fieldErrors.session_hour)} value={form.session_hour} onChange={e => updateField('session_hour', e.target.value)} className="field"><option value="">{slotsLoading ? 'Memeriksa jadwal...' : 'Pilih jam'}</option>{slots.map(slot => <option key={slot.hour} value={slot.hour} disabled={!slot.available}>{slot.hour}.00 WITA {slot.available ? `— tersisa ${slot.remaining}` : '— penuh'}</option>)}</select></Field>
                <Field label="Lokasi sesi" error={fieldErrors.session_location}><input required aria-invalid={Boolean(fieldErrors.session_location)} value={form.session_location} onChange={e => updateField('session_location', e.target.value)} className="field" placeholder="Lokasi atau area pilihan" /></Field>
              </div>
              <div className="mt-5"><Field label="Catatan (opsional)"><textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} className="field resize-none" placeholder="Informasi tambahan untuk tim kami" /></Field></div>
              <div className="mt-6"><p className="mb-3 text-sm font-bold">Pilihan pembayaran</p><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${form.payment_type === 'full' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)]'}`}><input type="radio" className="mr-2" checked={form.payment_type === 'full'} onChange={() => setForm({...form,payment_type:'full'})} />Lunas · {formatRupiah(selectedPackage.price)}</label><label className={`cursor-pointer rounded-xl border p-4 ${form.payment_type === 'dp' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)]'}`}><input type="radio" className="mr-2" checked={form.payment_type === 'dp'} onChange={() => setForm({...form,payment_type:'dp'})} />DP 50% · {formatRupiah(selectedPackage.price / 2)}</label></div></div>
              <button disabled={submitting} className="btn-primary mt-8 w-full px-7 py-4 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Buat Booking</button>
            </form>
          </div>
        )}

        {step === 3 && booking && (
          <section className="mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10"><CheckCircle2 className="mx-auto h-14 w-14 text-[var(--green)]" /><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Booking tercatat</p><h2 className="mt-2 font-serif text-4xl">Menunggu verifikasi pembayaran</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Simpan kode booking berikut. Slotmu akan dikonfirmasi setelah admin memeriksa bukti pembayaran.</p><div className="my-7 rounded-2xl bg-[var(--surface2)] p-6"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Kode booking</p><p className="mt-2 break-all font-mono text-xl font-bold">{booking.code}</p><div className="mt-5 grid gap-3 text-left text-sm sm:grid-cols-2"><Detail label="Paket" value={booking.package.name}/><Detail label="Total dibayar" value={formatRupiah(booking.amount_due)}/><Detail label="Tanggal" value={booking.session_date}/><Detail label="Jam" value={`${booking.session_hour}.00 WITA`}/></div></div>
            {!proofSent ? <div className="text-left"><label className="block text-sm font-bold">Kirim bukti pembayaran</label><p className="mt-1 text-xs text-[var(--muted)]">Gunakan instruksi pembayaran resmi dari admin. File JPG/PNG, maksimal 5 MB.</p><input type="file" accept="image/jpeg,image/png" onChange={e => setProof(e.target.files?.[0] ?? null)} className="mt-4 block w-full rounded-xl border border-[var(--line)] p-3 text-sm"/><button onClick={uploadProof} disabled={!proof || submitting} className="btn-primary mt-4 w-full px-6 py-3.5 disabled:opacity-40"><Upload className="h-4 w-4" />{submitting ? 'Mengirim...' : 'Kirim Bukti'}</button></div> : <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Bukti pembayaran sudah dikirim dan menunggu pemeriksaan admin.</div>}
            <div className="mt-7 flex flex-wrap justify-center gap-3"><a className="btn-secondary px-5 py-3 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/6285752528300?text=${encodeURIComponent(`Halo Admin Kleiora.grads, saya ingin mengonfirmasi booking ${booking.code}.`)}`}>Hubungi Admin</a><Link className="btn-secondary px-5 py-3 text-sm" href="/">Kembali ke Beranda</Link></div>
          </section>
        )}
      </main>
      <SiteFooter />
      <style jsx global>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.field:focus{border-color:var(--gold)}.field[aria-invalid="true"]{border-color:#ef4444;background:#fffafa}.field:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="block text-xs text-[var(--muted)]">{label}</span><strong>{value}</strong></div>; }

export default function BookingPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Clock className="h-6 w-6 animate-pulse" /></div>}><BookingFlow /></Suspense>;
}
