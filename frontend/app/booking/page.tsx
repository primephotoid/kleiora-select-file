'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock, Loader2, Upload, MapPin, Calendar, Landmark, QrCode, Wallet, ImageIcon, Copy, Download } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { apiRequest, BookingItem, formatRupiah, PackageItem, getImageUrl, API_BASE_URL } from '@/lib/api';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { PricelistGallery } from '@/components/PricelistGallery';
import { RegionSwitcher } from '@/components/RegionSwitcher';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useRegion, effectivePrice } from '@/lib/useRegion';
import imageCompression from 'browser-image-compression';

interface Slot { hour: string; remaining: number; available: boolean }

function todayInMakassar() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const { region, setRegion, detecting } = useRegion();
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
  
  // Manual Payment states
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [processingProof, setProcessingProof] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [copiedText, setCopiedText] = useState('');
  const [dpRawInput, setDpRawInput] = useState('');
  
  // QRIS Midtrans states
  const [requestID, setRequestID] = useState('');
  const [qrAvailable, setQRAvailable] = useState(false);
  const [qrImage, setQRImage] = useState('');
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [showNewBooking, setShowNewBooking] = useState(false);

  const [form, setForm] = useState({
    full_name: '', campus_name: '', whatsapp: '', session_date: '', session_hour: '', session_location: '', payment_type: 'full', notes: '', custom_dp_amount: 0
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  const bookingCode = booking?.code;
  const bookingDetails = booking ?? form;

  useEffect(() => {
    if (!proof) {
      setProofPreview('');
      return;
    }
    const previewURL = URL.createObjectURL(proof);
    setProofPreview(previewURL);
    return () => URL.revokeObjectURL(previewURL);
  }, [proof]);

  useEffect(() => {
    return () => { if (qrImage) URL.revokeObjectURL(qrImage); };
  }, [qrImage]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (err) {
      console.error('Gagal menyalin:', err);
    }
  }

  // Restore state on mount
  useEffect(() => {
    const freshID = Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('');
    setRequestID(freshID);
    try {
      const saved = JSON.parse(localStorage.getItem('kleiora_booking_state') || 'null');
      if (saved?.booking && saved?.bookingAccessToken) {
        setBooking(saved.booking);
        setBookingAccessToken(saved.bookingAccessToken);
        setSelectedCode(saved.booking.package.code);
        if (saved.booking.payment_method) setPaymentMethod(saved.booking.payment_method);
        setStep(3);
        if (saved.requestID) setRequestID(saved.requestID);
      } else if (saved?.form) {
        setForm(saved.form);
        setSelectedCode(saved.selectedCode || '');
        if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
        if (saved.requestID) setRequestID(saved.requestID);
      }
    } catch {
      localStorage.removeItem('kleiora_booking_state');
    }

    const recovery = new URLSearchParams(window.location.hash.slice(1));
    const code = recovery.get('code'), token = recovery.get('token');
    if (code && token) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      apiRequest<BookingItem>(`/bookings/${encodeURIComponent(code)}`, { headers: { 'X-Booking-Token': token } })
        .then(existing => {
          setBooking(existing);
          setBookingAccessToken(token);
          setSelectedCode(existing.package.code);
          if (existing.payment_method) setPaymentMethod(existing.payment_method);
          setStep(3);
        })
        .catch(err => setError(err.message));
    }
    setMounted(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!mounted) return;
    if (step < 4) {
      localStorage.setItem('kleiora_booking_state', JSON.stringify({
        step, selectedCode, form, paymentMethod, booking, bookingAccessToken, requestID
      }));
    } else {
      localStorage.removeItem('kleiora_booking_state');
    }
  }, [step, selectedCode, form, paymentMethod, booking, bookingAccessToken, requestID, mounted]);

  // Timer for QRIS / payment expiration
  useEffect(() => {
    if (!booking?.payment_expires_at || step === 4) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((Date.parse(booking.payment_expires_at!) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [booking?.payment_expires_at, step]);

  // Recover saved bookings and track both manual review and QRIS payments.
  useEffect(() => {
    if (!mounted || !bookingCode || !bookingAccessToken || (step !== 3 && !(step === 4 && booking?.payment_status === 'submitted'))) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const headers = { 'X-Booking-Token': bookingAccessToken };
        const result = paymentMethod === 'qris'
          ? await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${bookingCode}/payment`, { headers })
          : { booking: await apiRequest<BookingItem>(`/bookings/${bookingCode}`, { headers }), qr_available: false };
        if (stopped) return;
        setBooking(result.booking);
        setQRAvailable(result.qr_available);
        if (['submitted', 'verified', 'payment_review', 'refunded'].includes(result.booking.payment_status)) {
          setStep(4);
          if (result.booking.payment_status !== 'submitted') return;
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'Status pembayaran belum dapat diperiksa.');
      }
      if (!stopped) timer = setTimeout(poll, 10000);
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [mounted, bookingCode, bookingAccessToken, step, paymentMethod, booking?.payment_status]);

  // Load QRIS PNG image
  useEffect(() => {
    if (!bookingCode || !bookingAccessToken || !qrAvailable || paymentMethod !== 'qris') {
      setQRImage('');
      return;
    }
    const controller = new AbortController();
    let blobURL = '';
    fetch(`${API_BASE_URL}/bookings/${bookingCode}/qris.png`, { headers: { 'X-Booking-Token': bookingAccessToken }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Gambar QRIS belum dapat dimuat. Klik tombol periksa untuk mencoba lagi.');
        return response.blob();
      })
      .then(blob => {
        if (!controller.signal.aborted) {
          blobURL = URL.createObjectURL(blob);
          setQRImage(blobURL);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => { controller.abort(); if (blobURL) URL.revokeObjectURL(blobURL); };
  }, [bookingCode, bookingAccessToken, qrAvailable, paymentMethod]);

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
  const isOutOfTown = region === 'out_of_town';
  // Effective amount due based on region
  const displayAmount = useMemo(() => {
    if (!selectedPackage) return 0;
    return effectivePrice(selectedPackage, region);
  }, [selectedPackage, region]);

  function proceedToPayment(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Periksa kembali data yang ditandai di bawah ini.');
      return;
    }
    if (form.payment_type === 'dp_custom' && (!form.custom_dp_amount || form.custom_dp_amount < 50000 || form.custom_dp_amount > displayAmount)) {
      setError('Masukkan nominal DP Custom minimal Rp50.000 dan tidak lebih dari harga paket.');
      return;
    }
    setFieldErrors({});
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createBooking() {
    if (!booking && form.payment_type === 'dp_custom' && (!Number.isInteger(form.custom_dp_amount) || form.custom_dp_amount < 50000 || form.custom_dp_amount > displayAmount)) {
      setError('DP custom minimal Rp50.000 dan tidak boleh melebihi harga paket.');
      return;
    }
    if (!paymentMethod) {
      setError('Pilih metode pembayaran terlebih dahulu.');
      return;
    }

    if (paymentMethod === 'qris') {
      setError(''); setSubmitting(true);
      try {
        let current = booking, token = bookingAccessToken;
        if (!current || !token) {
          const created = await apiRequest<{ booking: BookingItem; access_token: string }>('/bookings', {
            method: 'POST', body: JSON.stringify({ ...form, payment_method: 'qris', package_code: selectedCode, request_id: requestID, is_out_of_town: isOutOfTown }),
          });
          current = created.booking; token = created.access_token;
          setBooking(current); setBookingAccessToken(token);
        }
        const result = await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${current.code}/qris`, {
          method: 'POST', headers: { 'X-Booking-Token': token },
        });
        setBooking(result.booking); setQRAvailable(result.qr_available);
        if (['verified', 'payment_review'].includes(result.booking.payment_status)) setStep(4);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'QRIS belum dapat dibuat. Coba lagi.');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Manual payment (transfer or ewallet)
      if (booking && !proof) {
        setError('Silakan upload bukti pembayaran terlebih dahulu.');
        return;
      }
      if (proof && proof.size > 5 * 1024 * 1024) {
        setError('Ukuran file bukti pembayaran terlalu besar (maksimal 5MB).');
        return;
      }
      setError(''); setSubmitting(true);
      try {
        let activeBooking = booking;
        let activeAccessToken = bookingAccessToken;
        if (!activeBooking || !activeAccessToken) {
          const result = await apiRequest<{ booking: BookingItem; access_token: string }>('/bookings', {
            method: 'POST', body: JSON.stringify({ ...form, payment_method: paymentMethod, package_code: selectedCode, request_id: requestID, is_out_of_town: isOutOfTown })
          });
          activeBooking = result.booking;
          activeAccessToken = result.access_token;
          setBooking(activeBooking);
          setBookingAccessToken(activeAccessToken);
          if (['submitted', 'verified'].includes(activeBooking.payment_status)) setStep(4);
          return;
        }
        if (proof) {
          const body = new FormData();
          body.append('proof', proof);
          body.append('payment_method', paymentMethod);
          await apiRequest(`/bookings/${activeBooking.code}/payment-proof`, {
            method: 'POST', headers: { 'X-Booking-Token': activeAccessToken }, body
          });
          setBooking({ ...activeBooking, payment_status: 'submitted' });
          setProof(null);
        }
        setStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Booking gagal dibuat.');
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function checkPayment() {
    if (!booking) return;
    setSubmitting(true); setError('');
    try {
      const result = await apiRequest<{ booking: BookingItem; qr_available: boolean }>(`/bookings/${booking.code}/payment`, { headers: { 'X-Booking-Token': bookingAccessToken } });
      setBooking(result.booking); setQRAvailable(result.qr_available);
      if (['verified', 'payment_review', 'refunded'].includes(result.booking.payment_status)) setStep(4);
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
    setBooking(null); setBookingAccessToken(''); setQRAvailable(false); setProof(null); setProofPreview('');
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
            <RegionSwitcher region={region} detecting={detecting} onSwitch={setRegion} />
            {loading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--gold-dark)]" />
              </div>
            ) : (
              <PricelistGallery
                packages={packages}
                selectedCode={selectedCode}
                region={region}
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
                <p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(displayAmount)}</p>
                {isOutOfTown && selectedPackage.price_out_of_town > 0 && (
                  <p className="text-xs text-[var(--muted)] line-through">{formatRupiah(selectedPackage.price)}</p>
                )}
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

        {step === 3 && selectedPackage && (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-28">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                <h3 className="mb-6 font-bold">Langkah Booking</h3>
                <div className="flex flex-col gap-4">
                  {[ { step: 1, label: 'Pilih Paket' }, { step: 2, label: 'Form Data' }, { step: 3, label: 'Pembayaran' }, { step: 4, label: 'Konfirmasi' } ].map(s => (
                    <div key={s.step} className="flex items-center gap-4">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${step === s.step ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--surface)]' : step > s.step ? 'border-[var(--green)] text-[var(--green)] bg-[var(--surface)]' : 'border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]'}`}>
                        {step > s.step ? <Check className="h-4 w-4" /> : s.step}
                      </div>
                      <span className={`text-sm font-semibold ${step === s.step ? 'text-orange-600' : step > s.step ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Rangkuman Pesanan</h3>
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface2)]">
                    {selectedPackage.image_path?.match(/\.(mp4|webm)$/i) ? (
                      <video src={getImageUrl(selectedPackage.image_path)} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <img src={getImageUrl(selectedPackage.image_path)} alt={selectedPackage.name} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{selectedPackage.name}</p>
                    <p className="text-sm text-[var(--gold-dark)]">{formatRupiah(displayAmount)}</p>
                    {isOutOfTown && selectedPackage.price_out_of_town > 0 && (
                      <p className="text-[11px] text-[var(--muted)] line-through">{formatRupiah(selectedPackage.price)}</p>
                    )}
                  </div>
                </div>
                <hr className="my-4 border-[var(--line)]" />
                <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
                  <span className="text-[var(--muted)]">Nama</span><span className="text-right font-medium">{bookingDetails.full_name}</span>
                  <span className="text-[var(--muted)]">Kampus</span><span className="text-right font-medium">{bookingDetails.campus_name}</span>
                  <span className="text-[var(--muted)]">No. WA</span><span className="text-right font-medium">{bookingDetails.whatsapp}</span>
                  <span className="text-[var(--muted)]">Tanggal</span><span className="text-right font-medium">{bookingDetails.session_date ? new Date(bookingDetails.session_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                  <span className="text-[var(--muted)]">Jam</span><span className="text-right font-medium">{bookingDetails.session_hour}.00 WITA</span>
                  <span className="text-[var(--muted)]">Lokasi</span><span className="text-right font-medium">{bookingDetails.session_location}</span>
                  <span className="text-[var(--muted)]">Opsi Bayar</span><span className="text-right font-medium">{bookingDetails.payment_type === 'dp' ? 'Down Payment (Setengah Harga)' : bookingDetails.payment_type === 'dp_custom' ? 'DP Custom' : 'Pembayaran Penuh'}</span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--surface2)] p-3 text-sm font-bold">
                  <span>Harus Bayar</span>
                  <span className="text-[var(--gold-dark)]">{formatRupiah(booking?.amount_due ?? (form.payment_type === 'dp' ? Math.floor(displayAmount / 2) : form.payment_type === 'dp_custom' ? form.custom_dp_amount : displayAmount))}</span>
                </div>
              </div>
            </aside>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <h2 className="font-serif text-3xl font-medium">Lakukan Pembayaran</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Selesaikan pembayaran untuk mengamankan booking-mu.</p>
              
              <div className="mt-6 flex flex-col justify-between rounded-xl bg-orange-50 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Selesaikan pembayaran dalam</p>
                  <p className="mt-1 text-3xl font-bold text-orange-600">{displayMinutes} : {displaySeconds}</p>
                </div>
                <p className="mt-3 text-xs text-orange-700 sm:mt-0 sm:max-w-[200px] sm:text-right">Jika waktu habis, data booking tidak akan tersimpan. Silakan lakukan booking ulang.</p>
              </div>

              {/* Opsi Pembayaran (Lunas / DP / DP Custom) */}
              {!booking && (
                <div className="mt-8">
                  <h3 className="mb-4 font-bold">Opsi Pembayaran</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'full' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                      <input type="radio" className="hidden" checked={form.payment_type === 'full'} onChange={() => setForm({...form, payment_type:'full'})} />
                      <p className="text-sm font-medium text-[var(--muted)]">Lunas</p>
                      <p className="mt-1 text-xl font-bold">{formatRupiah(displayAmount)}</p>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'dp' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                      <input type="radio" className="hidden" checked={form.payment_type === 'dp'} onChange={() => setForm({...form, payment_type:'dp'})} />
                      <p className="text-sm font-medium text-[var(--muted)]">DP 50%</p>
                      <p className="mt-1 text-xl font-bold">{formatRupiah(displayAmount / 2)}</p>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'dp_custom' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                      <input type="radio" className="hidden" checked={form.payment_type === 'dp_custom'} onChange={() => setForm({...form, payment_type:'dp_custom'})} />
                      <p className="text-sm font-medium text-[var(--muted)]">DP Custom</p>
                      {form.payment_type !== 'dp_custom' && <p className="mt-1 text-xs text-[var(--muted)]">Input manual (Min 50k)</p>}
                      {form.payment_type === 'dp_custom' && (
                        <div className="mt-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            min="50000"
                            max={displayAmount}
                            value={dpRawInput}
                            onChange={e => {
                              const raw = e.target.value.replace(/\D/g, '');
                              const num = parseInt(raw) || 0;
                              setDpRawInput(raw === '' ? '' : num.toLocaleString('id-ID'));
                              setForm({...form, custom_dp_amount: num});
                            }}
                            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface2)] p-2 text-sm focus:border-[var(--gold)] focus:outline-none"
                            placeholder="Nominal (Min 50.000)"
                          />
                          {form.custom_dp_amount > 0 && (
                            <p className="mt-1 text-xs text-[var(--muted)]">= {formatRupiah(form.custom_dp_amount)}</p>
                          )}
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Pilih Metode Pembayaran */}
              {!booking && (
                <div className="mt-8">
                  <h3 className="mb-4 font-bold">Pilih Metode Pembayaran</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { id: 'qris', title: 'QRIS Otomatis', desc: 'Instant & Konfirmasi Otomatis', icon: <QrCode className="h-6 w-6 text-[var(--gold-dark)]" /> },
                      { id: 'transfer', title: 'Transfer Bank', desc: 'BCA, Mandiri, BRI, SeaBank', icon: <Landmark className="h-6 w-6" /> },
                      { id: 'ewallet', title: 'E-Wallet', desc: 'DANA, ShopeePay, OVO', icon: <Wallet className="h-6 w-6" /> }
                    ].map(method => (
                      <label key={method.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${paymentMethod === method.id ? 'border-[var(--text)] bg-[var(--surface2)] shadow-sm' : 'border-[var(--line)] hover:border-[var(--text)]'}`}>
                        <input type="radio" className="hidden" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                        <div className="flex shrink-0 items-center justify-center">{method.icon}</div>
                        <div>
                          <p className="font-bold text-sm">{method.title}</p>
                          <p className="text-xs text-[var(--muted)]">{method.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Rincian QRIS */}
              {paymentMethod === 'qris' && (
                <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface2)] p-5 sm:p-6 text-center">
                  <div className="flex justify-center items-center gap-2 mb-2">
                    <QrCode className="h-6 w-6 text-[var(--gold-dark)]" />
                    <h3 className="font-bold text-lg">Pembayaran QRIS</h3>
                  </div>
                  <p className="text-sm text-[var(--muted)]">Scan via aplikasi bank atau e-wallet pilihanmu. Sistem mengonfirmasi pembayaran secara otomatis tanpa perlu mengunggah bukti transfer.</p>

                  {booking && (
                    <div className="mt-5 rounded-xl bg-[var(--surface)] p-4 text-left border border-[var(--line)]">
                      <p className="font-mono text-xs text-[var(--muted)]">Kode Booking: <strong className="text-[var(--text)]">{booking.code}</strong></p>
                      <p className="mt-1 text-sm font-semibold">{booking.full_name} · {booking.package.name}</p>
                      <p className="mt-2 text-2xl font-bold text-[var(--gold-dark)]">{formatRupiah(booking.amount_due)}</p>
                    </div>
                  )}

                  {qrImage && qrAvailable && timeLeft > 0 && (
                    <div className="mt-6 text-center">
                      <img src={qrImage} alt="QRIS pembayaran booking" className="mx-auto w-full max-w-xs rounded-xl bg-white p-4 shadow-sm" />
                      <a href={qrImage} download={`QRIS-${booking?.code}.png`} className="btn-secondary mt-4 inline-flex items-center gap-2 px-6 py-3 text-sm font-medium"><Download className="h-4 w-4" />Unduh QRIS PNG</a>
                    </div>
                  )}
                  {booking && <p className="mt-4 text-xs text-[var(--muted)]">Periksa status pembayaran secara berkala atau biarkan halaman ini terbuka untuk verifikasi otomatis.</p>}

                  {booking && <p className="mt-4 text-xs text-[var(--muted)]">Metode pembayaran terkunci untuk booking ini agar tidak terjadi pembayaran ganda.</p>}
                </div>
              )}

              {/* Rincian Transfer Bank / E-Wallet Manual */}
              {!booking && paymentMethod !== 'qris' && <p className="mt-6 text-sm text-[var(--muted)]">Klik reservasi terlebih dahulu untuk memastikan slot tersedia dan melihat tujuan pembayaran. Batas pengiriman bukti adalah 30 menit sejak reservasi berhasil.</p>}
              {booking && paymentMethod !== 'qris' && timeLeft === 0 && booking.payment_status === 'pending' && <p className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">Reservasi berakhir. Jangan transfer untuk booking ini. Jika sudah membayar, hubungi admin dengan kode {booking.code} sebelum membuat booking baru.</p>}
              {booking && booking.status === 'pending_payment' && timeLeft > 0 && (paymentMethod === 'transfer' || paymentMethod === 'ewallet') && (
                <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface2)] p-5 sm:p-6">
                  <p className="mb-5 text-xs text-[var(--muted)]">Kode: {booking.code} · Sisa waktu: {Math.floor(timeLeft / 60)}m {timeLeft % 60}s. Metode pembayaran terkunci. Kirim bukti sebelum reservasi berakhir; hubungi admin jika sudah membayar tetapi tidak dapat mengunggah.</p>
                  {paymentMethod === 'transfer' && (
                    <>
                      <h3 className="mb-4 font-bold">Detail Rekening Transfer Bank</h3>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">BANK BCA</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xl font-bold">7685839920</p>
                            <button type="button" onClick={() => copyToClipboard('7685839920')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '7685839920' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">BANK BRI</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xl font-bold">205301004823538</p>
                            <button type="button" onClick={() => copyToClipboard('205301004823538')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '205301004823538' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">BANK MANDIRI</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xl font-bold">1520033239431</p>
                            <button type="button" onClick={() => copyToClipboard('1520033239431')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '1520033239431' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">SEABANK</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xl font-bold">901773152340</p>
                            <button type="button" onClick={() => copyToClipboard('901773152340')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '901773152340' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">PETUNJUK</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Transfer sesuai nominal paket terpilih. Simpan bukti transfer untuk diunggah di bawah ini.</p>
                        </div>
                      </div>
                    </>
                  )}

                  {paymentMethod === 'ewallet' && (
                    <>
                      <h3 className="mb-4 font-bold">Detail Pembayaran E-Wallet</h3>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">DANA / ShopeePay</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-2xl font-bold">085757746494</p>
                            <button type="button" onClick={() => copyToClipboard('085757746494')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '085757746494' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">OVO</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-2xl font-bold">085752528300</p>
                            <button type="button" onClick={() => copyToClipboard('085752528300')} className="flex items-center gap-1.5 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--line)]">
                              {copiedText === '085752528300' ? <><Check className="h-3 w-3 text-green-600" /> Disalin</> : <><Copy className="h-3 w-3" /> Salin</>}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">Atas Nama: <strong>MUHAMMAD NOER IKHSAN</strong></p>
                        </div>
                        <hr className="my-4 border-[var(--line)]" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">PETUNJUK</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Transfer saldo sesuai nominal paket terpilih ke salah satu nomor di atas. Simpan screenshot/bukti pembayaran untuk diunggah di bawah ini.</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Upload Bukti Foto */}
                  <div className="mt-6">
                    <h3 className="mb-3 flex items-center gap-2 font-bold"><Upload className="h-5 w-5" /> Upload Bukti Pembayaran / Transaksi</h3>
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] text-center transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-glow)] ${proofPreview ? 'p-4' : 'p-8'}`}>
                      {proofPreview ? (
                        <>
                          <div className="relative flex max-h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-black/5">
                            <img src={proofPreview} alt="Preview bukti pembayaran" className="max-h-72 w-full object-contain" />
                            <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">Klik untuk ganti</span>
                          </div>
                          <span className="mt-3 max-w-full truncate text-sm font-semibold text-[var(--text)]">{proof?.name}</span>
                        </>
                      ) : processingProof ? (
                        <>
                          <Loader2 className="mb-3 h-8 w-8 animate-spin text-[var(--gold-dark)]" />
                          <span className="text-sm font-semibold text-[var(--text)]">Memproses gambar...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="mb-3 h-8 w-8 text-[var(--muted)]" />
                          <span className="text-sm font-semibold text-[var(--text)]">Pilih foto bukti pembayaran (.jpg, .png, .webp)</span>
                        </>
                      )}
                      <span className="mt-1 text-xs text-[var(--muted)]">Maksimal ukuran file: 5MB</span>
                      <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setError('');
                        setProof(null);
                        setProcessingProof(true);
                        try {
                          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                          const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: outputType });
                          const extension = outputType === 'image/png' ? '.png' : '.jpg';
                          const baseName = file.name.replace(/\.[^.]+$/, '') || 'bukti-pembayaran';
                          const normalized = new File([compressed], `${baseName}${extension}`, { type: outputType, lastModified: Date.now() });
                          setProof(normalized);
                        } catch (err) {
                          console.error(err);
                          setProof(null);
                          setError('Foto bukti tidak dapat diproses. Gunakan JPG, PNG, atau WEBP yang valid.');
                        } finally {
                          setProcessingProof(false);
                          e.target.value = '';
                        }
                      }} />
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-3">
                {!booking && <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary px-6 py-3">Kembali</button>}
                
                {paymentMethod === 'qris' ? (
                  <>
                    {(!booking || (booking.payment_status === 'pending' && timeLeft > 20 && !qrAvailable)) && (
                      <button onClick={createBooking} disabled={submitting || !requestID} className="btn-primary px-6 py-3">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        {booking ? 'Coba muat QRIS lagi' : 'Buat QRIS & Bayar'}
                      </button>
                    )}
                    {booking && (
                      <button onClick={checkPayment} disabled={submitting} className="btn-secondary px-6 py-3">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}Periksa Pembayaran
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={createBooking} disabled={submitting || processingProof || !requestID || (!!booking && (!proof || booking.payment_status !== 'pending' || booking.status !== 'pending_payment' || timeLeft === 0))} className="btn-primary flex-1 px-6 py-3 disabled:opacity-50">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}{booking ? 'Kirim Bukti untuk Verifikasi' : 'Reservasi & Lihat Tujuan Pembayaran'}
                  </button>
                )}

                {booking && timeLeft === 0 && booking.payment_status === 'pending' && (
                  <button onClick={() => setShowNewBooking(true)} className="btn-secondary px-6 py-3">Booking Baru</button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && booking && (
          <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-sm sm:p-10">
            <CheckCircle2 className="mx-auto h-10 w-10 sm:h-14 sm:w-14 text-[var(--green)]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">
              {booking.payment_status === 'verified' ? 'Pembayaran diterima' : 'Booking tercatat'}
            </p>
            <h2 className="mt-1 font-serif text-2xl sm:text-4xl">
              {booking.payment_status === 'verified' ? 'Booking terkonfirmasi' : ['payment_review', 'refunded'].includes(booking.payment_status) ? 'Pembayaran perlu ditinjau' : 'Menunggu verifikasi pembayaran'}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[var(--muted)]">
              {booking.payment_status === 'verified' 
                ? (booking.payment_type === 'full' ? 'Pembayaran penuh telah diverifikasi.' : 'DP telah diverifikasi. Sisa pembayaran belum termasuk.')
                : ['payment_review', 'refunded'].includes(booking.payment_status) ? 'Hubungi admin untuk memeriksa jadwal dan status pembayaran. Jangan membayar ulang.'
                : 'Bukti pembayaran berhasil dikirim. Slot ditahan selama pemeriksaan; booking dikonfirmasi setelah admin memverifikasi pembayaran.'}
            </p>
            <div className="my-4 rounded-xl bg-[var(--surface2)] p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Kode booking</p>
              <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-base font-bold sm:text-xl">{booking.code}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
                <Detail label="Paket" value={booking.package.name}/>
                <Detail label={booking.payment_status === 'submitted' ? 'Nominal diajukan' : 'Nominal terverifikasi'} value={formatRupiah(booking.payment_status === 'submitted' ? booking.amount_due : (booking.paid_amount || 0))}/>
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
      <ConfirmDialog open={showNewBooking} danger={false} title="Buat booking baru?" description="Reservasi sebelumnya tetap tercatat. Lanjutkan hanya jika pembayaran sebelumnya belum dibayar dan sudah kedaluwarsa." confirmLabel="Booking baru" onConfirm={startNewBooking} onCancel={() => setShowNewBooking(false)} />
      <style jsx global>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.field:focus{border-color:var(--gold)}.field[aria-invalid="true"]{border-color:#ef4444;background:#fffafa}.field:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Field({ label, children, error }: { label: React.ReactNode; children: React.ReactNode; error?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="block text-xs text-[var(--muted)]">{label}</span><strong>{value}</strong></div>; }

export default function BookingPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Clock className="h-6 w-6 animate-pulse" /></div>}><BookingFlow /></Suspense>;
}
