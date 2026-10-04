'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock, Loader2, QrCode, Download, Calendar, MapPin } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { apiRequest, BookingItem, formatRupiah, PackageItem, getImageUrl, API_BASE_URL } from '@/lib/api';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { PricelistGallery } from '@/components/PricelistGallery';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  const [bookingAccessToken, setBookingAccessToken] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [form, setForm] = useState({ full_name: '', campus_name: '', whatsapp: '', session_date: '', session_hour: '', session_location: '', payment_type: 'full', notes: '', custom_dp_amount: 0 });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestID, setRequestID] = useState('');
  const [qrAvailable, setQRAvailable] = useState(false);
  const [qrImage, setQRImage] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const bookingCode = booking?.code;

  useEffect(() => () => { if (qrImage) URL.revokeObjectURL(qrImage); }, [qrImage]);

  useEffect(() => {
    const freshID = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
    setRequestID(freshID);
    try {
      const saved = JSON.parse(localStorage.getItem('kleiora_booking_state') || 'null');
      if (saved?.booking && saved?.bookingAccessToken && saved.booking.payment_order_id) {
        setBooking(saved.booking);
        setBookingAccessToken(saved.bookingAccessToken);
        setSelectedCode(saved.booking.package.code);
        setStep(3);
        if (saved.requestID) setRequestID(saved.requestID);
      } else if (saved?.form) {
        setForm(saved.form);
        setSelectedCode(saved.selectedCode || '');
        if (saved.requestID) setRequestID(saved.requestID);
      }
    } catch { localStorage.removeItem('kleiora_booking_state'); }
    const recovery = new URLSearchParams(window.location.hash.slice(1));
    const code = recovery.get('code'), token = recovery.get('token');
    if (code && token) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      apiRequest<BookingItem>(`/bookings/${encodeURIComponent(code)}`, { headers: { 'X-Booking-Token': token } })
        .then(existing => {
          if (!existing.payment_order_id) throw new Error('Booking lama tidak menggunakan pembayaran QRIS. Hubungi admin.');
          setBooking(existing); setBookingAccessToken(token); setSelectedCode(existing.package.code); setStep(3);
        })
        .catch(err => setError(err.message));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('kleiora_booking_state', JSON.stringify({ selectedCode, form, booking, bookingAccessToken, requestID }));
  }, [mounted, selectedCode, form, booking, bookingAccessToken, requestID]);

  useEffect(() => {
    if (!booking?.payment_expires_at) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((Date.parse(booking.payment_expires_at!) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [booking?.payment_expires_at]);

  useEffect(() => {
    if (!mounted || !bookingCode || !bookingAccessToken || step !== 3) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${bookingCode}/payment`, { headers: { 'X-Booking-Token': bookingAccessToken } });
        if (stopped) return;
        setBooking(result.booking); setQRAvailable(result.qr_available);
        if (['verified', 'payment_review', 'refunded'].includes(result.booking.payment_status)) { setStep(4); return; }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'Status pembayaran belum dapat diperiksa.');
      }
      if (!stopped) timer = setTimeout(poll, 10000);
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [mounted, bookingCode, bookingAccessToken, step]);

  useEffect(() => {
    if (!bookingCode || !bookingAccessToken || !qrAvailable) { setQRImage(''); return; }
    const controller = new AbortController();
    let blobURL = '';
    fetch(`${API_BASE_URL}/bookings/${bookingCode}/qris.png`, { headers: { 'X-Booking-Token': bookingAccessToken }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Gambar QRIS belum dapat dimuat. Klik Periksa pembayaran untuk mencoba lagi.'); return response.blob(); })
      .then(blob => { if (!controller.signal.aborted) { blobURL = URL.createObjectURL(blob); setQRImage(blobURL); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); if (blobURL) URL.revokeObjectURL(blobURL); };
  }, [bookingCode, bookingAccessToken, qrAvailable]);

  const displayMinutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const displaySeconds = (timeLeft % 60).toString().padStart(2, '0');

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
        const pkgs = [...data.packages];
        setPackages(pkgs);
        if (!selectedCode && pkgs[0]) setSelectedCode(pkgs[0].code);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.session_date) { setSlots([]); return; }
    setSlotsLoading(true);
    if (!booking) setForm(current => ({ ...current, session_hour: '' }));
    apiRequest<{ slots: Slot[] }>(`/availability?date=${form.session_date}`)
      .then(data => setSlots(data.slots))
      .catch(err => setError(err.message))
      .finally(() => setSlotsLoading(false));
  }, [form.session_date, booking]);

  const selectedPackage = useMemo(() => packages.find(pkg => pkg.code === selectedCode), [packages, selectedCode]);

  function proceedToPayment(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Periksa kembali data yang ditandai di bawah ini.');
      return;
    }
    if (form.payment_type === 'dp_custom' && (!form.custom_dp_amount || form.custom_dp_amount < 50000 || form.custom_dp_amount > (selectedPackage?.price || 0))) {
      setError('Masukkan nominal DP Custom minimal Rp50.000 dan tidak lebih dari harga paket.');
      return;
    }
    setFieldErrors({});
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createBooking() {
	if (!booking && form.payment_type === 'dp_custom' && (!Number.isInteger(form.custom_dp_amount) || form.custom_dp_amount < 50000 || form.custom_dp_amount > (selectedPackage?.price || 0))) {
		setError('DP custom minimal Rp50.000 dan tidak boleh melebihi harga paket.'); return;
	}
    setError(''); setSubmitting(true);
    try {
      let current = booking, token = bookingAccessToken;
      if (!current || !token) {
        const created = await apiRequest<{ booking: BookingItem; access_token: string }>('/bookings', {
          method: 'POST', body: JSON.stringify({ ...form, package_code: selectedCode, request_id: requestID }),
        });
        current = created.booking; token = created.access_token;
        setBooking(current); setBookingAccessToken(token);
      }
      const result = await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${current.code}/qris`, {
        method: 'POST', headers: { 'X-Booking-Token': token },
      });
      setBooking(result.booking); setQRAvailable(result.qr_available);
      if (result.booking.payment_status === 'verified' || result.booking.payment_status === 'payment_review') setStep(4);
    } catch (err) { setError(err instanceof Error ? err.message : 'QRIS belum dapat dibuat. Coba lagi pada booking yang sama.'); }
    finally { setSubmitting(false); }
  }

  async function checkPayment() {
    if (!booking) return;
    setSubmitting(true); setError('');
    try {
      const result = await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${booking.code}/payment`, { headers: { 'X-Booking-Token': bookingAccessToken } });
      setBooking(result.booking); setQRAvailable(result.qr_available);
      if (['verified', 'payment_review', 'refunded'].includes(result.booking.payment_status)) setStep(4);
      // Retry a failed image fetch without putting the access token in a URL.
      if (result.qr_available && !qrImage) {
        const response = await fetch(`${API_BASE_URL}/bookings/${booking.code}/qris.png`, { headers: { 'X-Booking-Token': bookingAccessToken } });
        if (!response.ok) throw new Error('Gambar QRIS belum tersedia.');
        setQRImage(URL.createObjectURL(await response.blob()));
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Status belum dapat diperiksa.'); }
    finally { setSubmitting(false); }
  }

  function startNewBooking() {
    setShowNewBooking(false);
    setBooking(null); setBookingAccessToken(''); setQRAvailable(false);
    setRequestID(Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''));
    setStep(1); setError('');
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto min-h-[85vh] max-w-6xl px-6 pb-24 pt-32">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Booking sesi foto</p><h1 className="mt-2 font-serif text-4xl font-medium">Siapkan momen wisudamu</h1></div>
          <div className="hidden items-center gap-2 text-xs font-semibold sm:flex">{['Pricelist', 'Form Data', 'Pembayaran', 'Konfirmasi'].map((label, index) => <div key={label} className={`rounded-full px-4 py-2 ${step >= index + 1 ? 'bg-[var(--text)] text-[var(--surface)]' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>{index + 1}. {label}</div>)}</div>
        </div>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 1 && (
          <section>
            {loading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--gold-dark)]" />
              </div>
            ) : (
              <PricelistGallery
                packages={packages}
                selectedCode={selectedCode}
                onSelectPackage={(code) => {
                  setSelectedCode(code);
                  setStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </section>
        )}

        {step === 2 && selectedPackage && (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-28">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Langkah Booking</h3>
                <div className="relative">
                  <div className="absolute bottom-4 left-3.5 top-4 w-[2px] bg-[var(--line)]"></div>
                  {[{ step: 1, label: 'Pilih Paket' }, { step: 2, label: 'Form Data' }, { step: 3, label: 'Pembayaran' }, { step: 4, label: 'Konfirmasi' }].map(s => (
                    <div key={s.step} className="relative z-10 mb-6 flex items-center gap-4 last:mb-0">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${step === s.step ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--surface)]' : step > s.step ? 'border-[var(--green)] text-[var(--green)] bg-[var(--surface)]' : 'border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]'}`}>
                        {step > s.step ? <Check className="h-4 w-4" /> : s.step}
                      </div>
                      <span className={`text-sm font-semibold ${step === s.step ? 'text-orange-600' : step > s.step ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                  {selectedPackage.image_path?.match(/\.(mp4|webm)$/i) ? (
                    <video src={getImageUrl(selectedPackage.image_path)} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <img src={getImageUrl(selectedPackage.image_path)} alt={selectedPackage.name} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
                <h2 className="mt-5 font-serif text-2xl font-semibold">{selectedPackage.name}</h2>
                <p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(selectedPackage.price)}</p>
                <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Kuota pilihan setelah sesi: {selectedPackage.edited_photos} foto.</p>
                <button onClick={() => setStep(1)} className="btn-secondary mt-5 w-full px-4 py-2.5 text-sm"><ArrowLeft className="h-4 w-4" /> Ubah Paket</button>
              </div>
            </aside>
            <form noValidate onSubmit={proceedToPayment} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali ke Pilih Paket
              </button>
              <h2 className="font-serif text-3xl font-medium">Lengkapi data dirimu</h2><p className="mt-2 text-sm text-[var(--muted)]">Kami menggunakan data ini untuk mengatur jadwal dan menghubungimu.</p>
              <div className="mt-8 grid gap-5">
                <Field label="Nama Lengkap" error={fieldErrors.full_name}><input required aria-invalid={Boolean(fieldErrors.full_name)} value={form.full_name} onChange={e => updateField('full_name', e.target.value)} className="field" placeholder="Nama lengkap" /></Field>
                <Field label="Asal Kampus" error={fieldErrors.campus_name}><input required aria-invalid={Boolean(fieldErrors.campus_name)} value={form.campus_name} onChange={e => updateField('campus_name', e.target.value)} className="field" placeholder="Asal kampus" /></Field>
                <div>
                  <Field label="No. WhatsApp" error={fieldErrors.whatsapp}><input required type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(fieldErrors.whatsapp)} value={form.whatsapp} onChange={e => updateField('whatsapp', e.target.value)} className="field" placeholder="Contoh: 081234567890" /></Field>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Pastikan nomor WhatsApp aktif agar kami mudah menghubungi kamu.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Field label={<span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-[var(--gold)]" /> Tanggal Sesi Foto</span>} error={fieldErrors.session_date}><input required type="date" min={todayInMakassar()} aria-invalid={Boolean(fieldErrors.session_date)} value={form.session_date} onChange={e => updateField('session_date', e.target.value)} className="field" /></Field>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">Format: dd/mm/yyyy (Sesuai pengaturan perangkat Anda)</p>
                  </div>
                  <div>
                    <Field label={<span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[var(--gold)]" /> Jam Sesi Foto</span>} error={fieldErrors.session_hour}><select required disabled={!form.session_date || slotsLoading} aria-invalid={Boolean(fieldErrors.session_hour)} value={form.session_hour} onChange={e => updateField('session_hour', e.target.value)} className="field"><option value="">{slotsLoading ? 'Memeriksa...' : 'Pilih jam'}</option>{slots.map(slot => <option key={slot.hour} value={slot.hour} disabled={!slot.available}>{slot.hour}.00 WITA{slot.available ? '' : ' — penuh'}</option>)}</select></Field>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">Pilih jam mulai sesi foto.</p>
                  </div>
                </div>
                <div>
                  <Field label={<span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[var(--gold)]" /> Lokasi Sesi Foto</span>} error={fieldErrors.session_location}>
                    <LocationAutocomplete
                      value={form.session_location}
                      onChange={val => updateField('session_location', val)}
                      placeholder="Contoh: Taman Ismail Marzuki, Jakarta"
                      className="field"
                      ariaInvalid={Boolean(fieldErrors.session_location)}
                    />
                  </Field>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Ketik nama lokasi dan pilih dari saran, atau cari di <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="font-semibold text-[var(--gold-dark)] hover:underline">Google Maps &rarr;</a></p>
                </div>
              </div>
              <div className="mt-5"><Field label="Catatan (opsional)"><textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} className="field resize-none" placeholder="Informasi tambahan untuk tim kami" /></Field></div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={submitting}
                  className="btn-secondary w-full px-7 py-4 sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4" /> Kembali
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full flex-1 px-7 py-4 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ''} Lanjut ke Pembayaran &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (booking || selectedPackage) && (
          <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
            <div className="flex items-center gap-3"><QrCode className="h-8 w-8 text-[var(--gold-dark)]" /><h2 className="font-serif text-3xl">Pembayaran QRIS</h2></div>
            <p className="mt-3 text-sm text-[var(--muted)]">Scan menggunakan aplikasi bank atau e-wallet yang mendukung QRIS, atau unduh gambarnya untuk dibayar dari galeri.</p>
            {!booking && selectedPackage && <>
              <h3 className="mt-6 font-bold">Pilih nominal pembayaran</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'full', label: 'Pembayaran penuh', amount: selectedPackage.price },
                  { value: 'dp', label: 'DP 50%', amount: Math.floor(selectedPackage.price / 2) },
                  { value: 'dp_custom', label: 'DP custom', amount: form.custom_dp_amount },
                ].map(option => <label key={option.value} className="cursor-pointer rounded-xl border border-[var(--line)] p-4">
                  <input type="radio" name="payment_type" checked={form.payment_type === option.value} onChange={() => setForm({ ...form, payment_type: option.value })} disabled={submitting} className="mr-2" />
                  <span className="font-semibold">{option.label}</span><p className="mt-2 text-sm">{option.value === 'dp_custom' ? 'Minimal Rp50.000' : formatRupiah(option.amount)}</p>
                </label>)}
              </div>
              {form.payment_type === 'dp_custom' && <input type="number" min={50000} max={selectedPackage.price} value={form.custom_dp_amount || ''} disabled={submitting} onChange={event => setForm({ ...form, custom_dp_amount: Number(event.target.value) })} className="field mt-3" aria-label="Nominal DP custom" />}
            </>}
            {booking && <div className="mt-6 rounded-xl bg-[var(--surface2)] p-5">
              <p className="font-mono text-sm">{booking.code}</p>
              <p className="mt-2">{booking.full_name} · {booking.package.name}</p>
              <p className="mt-3 text-2xl font-bold">{formatRupiah(booking.amount_due)}</p>
              <p className="mt-2 text-sm">{booking.payment_type === 'full' ? 'Pembayaran penuh' : 'Pembayaran DP — bukan pelunasan'}</p>
              {timeLeft > 0 ? <p className="mt-3 font-semibold text-orange-700">Berlaku selama {displayMinutes}:{displaySeconds}</p> : <p className="mt-3 font-semibold text-orange-700">Reservasi sudah kedaluwarsa. Jika sudah membayar, jangan bayar ulang; hubungi admin dengan kode ini.</p>}
            </div>}
            {qrImage && qrAvailable && timeLeft > 0 && <div className="mt-6 text-center">
              <img src={qrImage} alt="QRIS pembayaran booking" className="mx-auto w-full max-w-xs rounded-xl bg-white p-3" />
              <a href={qrImage} download={`QRIS-${booking?.code}.png`} className="btn-secondary mt-4 px-6 py-3"><Download className="h-4 w-4" />Unduh QRIS PNG</a>
            </div>}
            <p className="mt-6 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">Pembayaran dikonfirmasi otomatis oleh Midtrans. Mengunduh QRIS atau menekan tombol periksa bukan bukti pembayaran. Tidak perlu upload bukti.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!booking && <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary px-6 py-3">Kembali</button>}
              {(!booking || (booking.payment_status === 'pending' && timeLeft > 20 && !qrAvailable)) && <button onClick={createBooking} disabled={submitting || !requestID} className="btn-primary px-6 py-3">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}{booking ? 'Coba muat QRIS lagi' : 'Buat QRIS'}</button>}
              {booking && <button onClick={checkPayment} disabled={submitting} className="btn-secondary px-6 py-3">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Periksa pembayaran</button>}
              {booking && timeLeft === 0 && booking.paid_amount === 0 && <button onClick={() => setShowNewBooking(true)} className="btn-secondary px-6 py-3">Booking baru</button>}
            </div>
          </section>
        )}

        {step === 4 && booking && (
          <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-sm sm:p-10">
              <CheckCircle2 className="mx-auto h-10 w-10 sm:h-14 sm:w-14 text-[var(--green)]" />
              <p className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">{booking.payment_status === 'verified' ? 'Pembayaran diterima' : 'Perlu pemeriksaan admin'}</p>
              <h2 className="mt-1 font-serif text-2xl sm:text-4xl">{booking.payment_status === 'verified' ? 'Booking terkonfirmasi' : 'Hubungi admin untuk pemeriksaan'}</h2>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[var(--muted)]">{booking.payment_status === 'verified' ? (booking.payment_type === 'full' ? 'Pembayaran penuh telah diterima melalui QRIS.' : 'DP telah diterima melalui QRIS. Sisa tagihan belum lunas.') : 'Status pembayaran perlu diperiksa admin, termasuk jadwal atau pengembalian dana. Jangan membayar ulang.'}</p>
              <div className="my-4 rounded-xl bg-[var(--surface2)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Kode booking</p>
                <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-base font-bold sm:text-xl">{booking.code}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
                  <Detail label="Paket" value={booking.package.name}/>
                  <Detail label="Total dibayar" value={formatRupiah(booking.paid_amount || 0)}/>
                  <Detail label="Tanggal" value={booking.session_date}/>
                  <Detail label="Jam" value={`${booking.session_hour}.00 WITA`}/>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <a className="btn-secondary px-4 py-2 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/6285752528300?text=${encodeURIComponent(`Halo Admin Kleiora.grads, saya ingin mengonfirmasi booking ${booking.code}.`)}`}>Hubungi Admin</a>
                <Link className="btn-secondary px-4 py-2 text-sm" href="/">Kembali ke Beranda</Link>
              </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <ConfirmDialog open={showNewBooking} danger={false} title="Buat booking baru?" description="Reservasi sebelumnya tetap tercatat. Lanjutkan hanya jika QRIS sebelumnya belum dibayar dan sudah kedaluwarsa. Jika sudah membayar, periksa status atau hubungi admin dahulu." confirmLabel="Booking baru" onConfirm={startNewBooking} onCancel={() => setShowNewBooking(false)} />
      <style jsx global>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.field:focus{border-color:var(--gold)}.field[aria-invalid="true"]{border-color:#ef4444;background:#fffafa}.field:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Field({ label, children, error }: { label: React.ReactNode; children: React.ReactNode; error?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="block text-xs text-[var(--muted)]">{label}</span><strong>{value}</strong></div>; }

export default function BookingPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Clock className="h-6 w-6 animate-pulse" /></div>}><BookingFlow /></Suspense>;
}
