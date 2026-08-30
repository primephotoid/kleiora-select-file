'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Loader2, Upload, MapPin, Calendar, Landmark, QrCode, Wallet, ImageIcon, Copy } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { apiRequest, BookingItem, formatRupiah, PackageItem, getImageUrl } from '@/lib/api';
import imageCompression from 'browser-image-compression';

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
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [processingProof, setProcessingProof] = useState(false);
  const [proofSent, setProofSent] = useState(false);
  const [form, setForm] = useState({ full_name: '', campus_name: '', whatsapp: '', session_date: '', session_hour: '', session_location: '', payment_type: 'full', notes: '', custom_dp_amount: 0 });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState('');
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<number | null>(null);
  const [sessionTimestamp, setSessionTimestamp] = useState(Date.now());
  const [copiedText, setCopiedText] = useState('');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!proof) {
      setProofPreview('');
      return;
    }
    const previewURL = URL.createObjectURL(proof);
    setProofPreview(previewURL);
    return () => URL.revokeObjectURL(previewURL);
  }, [proof]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  // Restore state on mount
  useEffect(() => {
    const saved = localStorage.getItem('kleiora_booking_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (parsed.timestamp && now - parsed.timestamp > oneHour) {
          localStorage.removeItem('kleiora_booking_state');
          // Sesi kadaluarsa setelah 1 jam, otomatis terulang dari awal
        } else if (parsed.step && parsed.step < 4) {
          setStep(parsed.step);
          setSelectedCode(parsed.selectedCode || '');
          if (parsed.form) setForm(parsed.form);
          setPaymentMethod(parsed.paymentMethod || '');
          if (parsed.paymentExpiresAt) setPaymentExpiresAt(parsed.paymentExpiresAt);
          if (parsed.timestamp) setSessionTimestamp(parsed.timestamp);
          if (parsed.booking) setBooking(parsed.booking);
          if (parsed.bookingAccessToken) setBookingAccessToken(parsed.bookingAccessToken);
        }
      } catch (e) {
        console.error('Gagal memuat data booking:', e);
      }
    }
    setMounted(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!mounted) return;
    if (step < 4) {
      localStorage.setItem('kleiora_booking_state', JSON.stringify({
        step, selectedCode, form, paymentMethod, paymentExpiresAt, booking, bookingAccessToken, timestamp: sessionTimestamp
      }));
    } else {
      localStorage.removeItem('kleiora_booking_state');
    }
  }, [step, selectedCode, form, paymentMethod, paymentExpiresAt, booking, bookingAccessToken, sessionTimestamp, mounted]);

  useEffect(() => {
    if (!mounted || !window.location.hash) return;
    const recovery = new URLSearchParams(window.location.hash.slice(1));
    const code = recovery.get('code');
    const accessToken = recovery.get('token');
    if (!code || !accessToken) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    apiRequest<BookingItem>(`/bookings/${encodeURIComponent(code)}`, { headers: { 'X-Booking-Token': accessToken } })
      .then(existing => {
        const now = Date.now();
        setBooking(existing);
        setBookingAccessToken(accessToken);
        setSelectedCode(existing.package.code);
        setForm({
          full_name: existing.full_name,
          campus_name: existing.campus_name,
          whatsapp: existing.whatsapp,
          session_date: existing.session_date,
          session_hour: existing.session_hour,
          session_location: existing.session_location,
          payment_type: existing.payment_type,
          notes: existing.notes || '',
          custom_dp_amount: existing.payment_type === 'dp_custom' ? existing.amount_due : 0,
        });
        setPaymentMethod(existing.payment_method || '');
        setPaymentExpiresAt(now + 30 * 60 * 1000);
        setSessionTimestamp(now);
        setStep(3);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Link akses booking tidak valid.'));
  }, [mounted]);

  useEffect(() => {
    if (!paymentExpiresAt || step === 4) return;
    
    function tick() {
      const remaining = Math.floor((paymentExpiresAt! - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        setStep(1);
        setError('Waktu pembayaran habis. Silakan ulangi proses booking.');
        setPaymentExpiresAt(null);
        setBooking(null);
        setBookingAccessToken('');
        return false;
      }
      setTimeLeft(remaining);
      return true;
    }

    if (!tick()) return;

    const interval = setInterval(() => {
      if (!tick()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, paymentExpiresAt]);

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
    if (!paymentExpiresAt || paymentExpiresAt <= Date.now()) {
      setPaymentExpiresAt(Date.now() + 30 * 60 * 1000);
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createBooking() {
    const requiresProof = ['transfer', 'ewallet'].includes(paymentMethod);
      if (requiresProof && !proof) {
        setError('Silakan upload bukti pembayaran terlebih dahulu.');
        return;
      }
      if (proof && proof.size > 5 * 1024 * 1024) {
        setError('Ukuran file bukti pembayaran terlalu besar (maksimal 5MB).');
        return;
      }
      setError('');
    setSubmitting(true);
    try {
      let activeBooking = booking;
      let activeAccessToken = bookingAccessToken;
      if (!activeBooking || !activeAccessToken) {
        const result = await apiRequest<{ booking: BookingItem; access_token: string }>('/bookings', { method: 'POST', body: JSON.stringify({ ...form, payment_method: paymentMethod, package_code: selectedCode }) });
        activeBooking = result.booking;
        activeAccessToken = result.access_token;
        setBooking(activeBooking);
        setBookingAccessToken(activeAccessToken);
      }
      
      if (proof && requiresProof) {
        const body = new FormData();
        body.append('proof', proof);
        body.append('payment_method', paymentMethod);
        await apiRequest(`/bookings/${activeBooking.code}/payment-proof`, { method: 'POST', headers: { 'X-Booking-Token': activeAccessToken }, body });
        setProofSent(true);
      }

      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking gagal dibuat.');
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
          <div className="hidden items-center gap-2 text-xs font-semibold sm:flex">{['Pricelist', 'Form Data', 'Pembayaran', 'Konfirmasi'].map((label, index) => <div key={label} className={`rounded-full px-4 py-2 ${step >= index + 1 ? 'bg-[var(--text)] text-[var(--surface)]' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>{index + 1}. {label}</div>)}</div>
        </div>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 1 && (
          <section>
            {loading ? <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[var(--gold-dark)]" /></div> : (
              <div className="grid gap-6 lg:grid-cols-3">
                {packages.map(pkg => (
                  <div key={pkg.code} className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] text-left transition hover:-translate-y-1">
                    <div className="relative aspect-[16/9]">
                      <img src={getImageUrl(pkg.image_path)} alt={pkg.name} className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
                    </div>
                    <div className="p-6">
                      <h2 className="font-serif text-2xl font-semibold">{pkg.name}</h2>
                      <p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(pkg.price)}</p>
                      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{pkg.description}</p>
                      <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                        <span>{pkg.code === 'cinematic' ? '1 jam take' : (pkg.duration_label || `${pkg.duration_hours} jam sesi foto`)}</span>
                        <span>{pkg.code === 'cinematic' ? 'Include edit' : `${pkg.location_count} lokasi`}</span>
                        <span>{pkg.code === 'cinematic' ? '1x free revisi edit' : (pkg.edited_photos > 0 ? `${pkg.edited_photos} foto edited` : '1x free revisi edit')}</span>
                        <span>{pkg.includes_print || (pkg.code === 'cinematic' ? 'Hasil durasi menyesuaikan' : 'Semua soft file')}</span>
                      </div>
                      <button
                        onClick={() => { setSelectedCode(pkg.code); setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="btn-primary mt-6 w-full px-5 py-3.5"
                      >
                        Pilih Paket <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl"><img src={getImageUrl(selectedPackage.image_path)} alt={selectedPackage.name} className="absolute inset-0 h-full w-full object-cover" /></div>
                <h2 className="mt-5 font-serif text-2xl font-semibold">{selectedPackage.name}</h2>
                <p className="mt-1 font-bold text-[var(--gold-dark)]">{formatRupiah(selectedPackage.price)}</p>
                <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Kuota pilihan setelah sesi: {selectedPackage.edited_photos} foto.</p>
                <button onClick={() => setStep(1)} className="btn-secondary mt-5 w-full px-4 py-2.5 text-sm"><ArrowLeft className="h-4 w-4" /> Ubah Paket</button>
              </div>
            </aside>
            <form noValidate onSubmit={proceedToPayment} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
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
                    <Field label={<span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[var(--gold)]" /> Jam Sesi Foto</span>} error={fieldErrors.session_hour}><select required disabled={!form.session_date || slotsLoading} aria-invalid={Boolean(fieldErrors.session_hour)} value={form.session_hour} onChange={e => updateField('session_hour', e.target.value)} className="field"><option value="">{slotsLoading ? 'Memeriksa...' : 'Pilih jam'}</option>{slots.map(slot => <option key={slot.hour} value={slot.hour} disabled={!slot.available}>{slot.hour}.00 WITA {slot.available ? `— tersisa ${slot.remaining}` : '— penuh'}</option>)}</select></Field>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">Pilih jam mulai sesi foto.</p>
                  </div>
                </div>
                <div>
                  <Field label={<span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[var(--gold)]" /> Lokasi Sesi Foto</span>} error={fieldErrors.session_location}><input required aria-invalid={Boolean(fieldErrors.session_location)} value={form.session_location} onChange={e => updateField('session_location', e.target.value)} className="field" placeholder="Contoh: Taman Ismail Marzuki, Jakarta" /></Field>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Sebutkan lokasi atau area yang Anda inginkan. <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="font-semibold text-[var(--gold-dark)] hover:underline">Buka Google Maps &rarr;</a></p>
                </div>
              </div>
              <div className="mt-5"><Field label="Catatan (opsional)"><textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} className="field resize-none" placeholder="Informasi tambahan untuk tim kami" /></Field></div>
              <button disabled={submitting} className="btn-primary mt-8 w-full px-7 py-4 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ''} Lanjut ke Pembayaran &rarr;</button>
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
                    <img src={getImageUrl(selectedPackage.image_path)} alt={selectedPackage.name} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold">{selectedPackage.name}</p>
                    <p className="text-sm text-[var(--gold-dark)]">{formatRupiah(selectedPackage.price)}</p>
                  </div>
                </div>
                <hr className="my-4 border-[var(--line)]" />
                <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
                  <span className="text-[var(--muted)]">Nama</span><span className="text-right font-medium">{form.full_name}</span>
                  <span className="text-[var(--muted)]">Kampus</span><span className="text-right font-medium">{form.campus_name}</span>
                  <span className="text-[var(--muted)]">No. WA</span><span className="text-right font-medium">{form.whatsapp}</span>
                  <span className="text-[var(--muted)]">Tanggal</span><span className="text-right font-medium">{form.session_date ? new Date(form.session_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                  <span className="text-[var(--muted)]">Jam</span><span className="text-right font-medium">{form.session_hour}.00 WITA</span>
                  <span className="text-[var(--muted)]">Lokasi</span><span className="text-right font-medium">{form.session_location}</span>
                  <span className="text-[var(--muted)]">Opsi Bayar</span><span className="text-right font-medium">{form.payment_type === 'dp' ? 'Down Payment (Setengah Harga)' : form.payment_type === 'dp_custom' ? 'DP Custom' : 'Full Payment (Lunas)'}</span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--surface2)] p-3 text-sm font-bold">
                  <span>Harus Bayar</span>
                  <span className="text-[var(--gold-dark)]">{formatRupiah(form.payment_type === 'dp' ? selectedPackage.price / 2 : form.payment_type === 'dp_custom' ? form.custom_dp_amount : selectedPackage.price)}</span>
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
              <div className="mt-8">
                <h3 className="mb-4 font-bold">Opsi Pembayaran</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'full' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                    <input type="radio" className="hidden" checked={form.payment_type === 'full'} onChange={() => setForm({...form,payment_type:'full'})} />
                    <p className="text-sm font-medium text-[var(--muted)]">Lunas</p>
                    <p className="mt-1 text-xl font-bold">{formatRupiah(selectedPackage.price)}</p>
                  </label>
                  <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'dp' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                    <input type="radio" className="hidden" checked={form.payment_type === 'dp'} onChange={() => setForm({...form,payment_type:'dp'})} />
                    <p className="text-sm font-medium text-[var(--muted)]">DP 50%</p>
                    <p className="mt-1 text-xl font-bold">{formatRupiah(selectedPackage.price / 2)}</p>
                  </label>
                  <label className={`cursor-pointer rounded-xl border p-5 transition-colors ${form.payment_type === 'dp_custom' ? 'border-[var(--gold)] bg-[var(--gold-glow)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                    <input type="radio" className="hidden" checked={form.payment_type === 'dp_custom'} onChange={() => setForm({...form,payment_type:'dp_custom'})} />
                    <p className="text-sm font-medium text-[var(--muted)]">DP Custom</p>
                    {form.payment_type !== 'dp_custom' && <p className="mt-1 text-xs text-[var(--muted)]">Input manual (Min 50k)</p>}
                    {form.payment_type === 'dp_custom' && (
                      <div className="mt-3">
                        <input type="number" min="50000" max={selectedPackage.price} value={form.custom_dp_amount || ''} onChange={e => setForm({...form, custom_dp_amount: parseInt(e.target.value) || 0})} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface2)] p-2 text-sm focus:border-[var(--gold)] focus:outline-none" placeholder="Nominal (Min 50k)" />
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="mt-8">
                <h3 className="mb-4 font-bold">Pilih Metode Pembayaran</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { id: 'transfer', title: 'Transfer Bank', desc: 'Transfer melalui rekening BCA, Mandiri, BRI, SeaBank', icon: <Landmark className="h-6 w-6" /> },
                    { id: 'ewallet', title: 'E-Wallet', desc: 'DANA, ShopeePay, GoPay', icon: <Wallet className="h-6 w-6" /> }
                  ].map(method => (
                    <label key={method.id} className={`flex cursor-pointer gap-4 rounded-xl border p-4 transition-colors ${paymentMethod === method.id ? 'border-[var(--text)] bg-[var(--surface2)] shadow-sm' : 'border-[var(--line)] hover:border-[var(--text)]'}`}>
                      <input type="radio" className="hidden" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                      <div className="flex shrink-0 items-center justify-center text-[var(--muted)]">{method.icon}</div>
                      <div>
                        <p className="font-bold">{method.title}</p>
                        <p className="text-xs text-[var(--muted)]">{method.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {(paymentMethod === 'transfer' || paymentMethod === 'ewallet') && (
                <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface2)] p-5 sm:p-6">
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
                  
                  <div className="mt-6">
                    <h3 className="mb-3 flex items-center gap-2 font-bold"><Upload className="h-5 w-5" /> Upload Bukti Pembayaran / Transaksi</h3>
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] text-center transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-glow)] ${proofPreview ? 'p-4' : 'p-8'}`}>
                      {proofPreview ? <>
                        <div className="relative flex max-h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-black/5">
                          <img src={proofPreview} alt="Preview bukti pembayaran" className="max-h-72 w-full object-contain" />
                          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">Klik untuk ganti</span>
                        </div>
                        <span className="mt-3 max-w-full truncate text-sm font-semibold text-[var(--text)]">{proof?.name}</span>
                      </> : processingProof ? <>
                        <Loader2 className="mb-3 h-8 w-8 animate-spin text-[var(--gold-dark)]" />
                        <span className="text-sm font-semibold text-[var(--text)]">Memproses gambar...</span>
                      </> : <>
                        <ImageIcon className="mb-3 h-8 w-8 text-[var(--muted)]" />
                        <span className="text-sm font-semibold text-[var(--text)]">Pilih foto bukti pembayaran (.jpg, .png, .webp)</span>
                      </>}
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

              <div className="mt-8 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <strong>Penting:</strong> Jika pembayaran tidak dilakukan, semua data dan pilihan paket tidak akan tersimpan. Silakan selesaikan pembayaran untuk melanjutkan.
              </div>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button onClick={() => setStep(2)} type="button" disabled={submitting} className="btn-secondary w-full px-7 py-4 sm:w-auto">
                  <ArrowLeft className="h-4 w-4" /> Kembali
                </button>
                <button onClick={createBooking} type="button" disabled={submitting || !paymentMethod} className="btn-primary w-full flex-1 px-7 py-4 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Konfirmasi & Bayar Sekarang'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && booking && (
          <section className="mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10"><CheckCircle2 className="mx-auto h-14 w-14 text-[var(--green)]" /><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">Booking tercatat</p><h2 className="mt-2 font-serif text-4xl">Menunggu verifikasi pembayaran</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Simpan kode booking berikut. Slotmu akan dikonfirmasi setelah admin memeriksa bukti pembayaran.</p><div className="my-7 rounded-2xl bg-[var(--surface2)] p-6"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Kode booking</p><p className="mt-2 break-all font-mono text-xl font-bold">{booking.code}</p><div className="mt-5 grid gap-3 text-left text-sm sm:grid-cols-2"><Detail label="Paket" value={booking.package.name}/><Detail label="Total dibayar" value={formatRupiah(booking.amount_due)}/><Detail label="Tanggal" value={booking.session_date}/><Detail label="Jam" value={`${booking.session_hour}.00 WITA`}/></div></div>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><a className="btn-secondary px-5 py-3 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/6285752528300?text=${encodeURIComponent(`Halo Admin Kleiora.grads, saya ingin mengonfirmasi booking ${booking.code}.`)}`}>Hubungi Admin</a><Link className="btn-secondary px-5 py-3 text-sm" href="/">Kembali ke Beranda</Link></div>
          </section>
        )}
      </main>
      <SiteFooter />
      <style jsx global>{`.field{width:100%;border:1px solid var(--line);border-radius:.75rem;background:var(--bg);padding:.8rem .9rem;font-size:.875rem;outline:none}.field:focus{border-color:var(--gold)}.field[aria-invalid="true"]{border-color:#ef4444;background:#fffafa}.field:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Field({ label, children, error }: { label: React.ReactNode; children: React.ReactNode; error?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="block text-xs text-[var(--muted)]">{label}</span><strong>{value}</strong></div>; }

export default function BookingPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Clock className="h-6 w-6 animate-pulse" /></div>}><BookingFlow /></Suspense>;
}
