'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarDays, Check, Copy, ExternalLink,
  Loader2, MapPin, MessageCircle, RefreshCw, X, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import { API_BASE_URL, apiRequest, BookingItem, formatRupiah } from '@/lib/api';
import { ToastContainer, ToastMessage } from '@/components/Toast';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

interface DailyScheduleResponse {
  date: string;
  month: string;
  total_clients: number;
  bookings: BookingItem[];
  monthly_summary: Record<string, number>;
}

interface RescheduleSlot {
  hour: string;
  remaining: number;
  available: boolean;
}

function todayInMakassar() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatLongDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatMonthYear(monthStr: string) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

function addDaysToDate(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DailySchedulePage() {
  const router = useRouter();
  const todayStr = useMemo(() => todayInMakassar(), []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentMonth, setCurrentMonth] = useState<string>(todayStr.substring(0, 7));
  const [data, setData] = useState<DailyScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingItem | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  useBodyScrollLock(Boolean(rescheduleTarget));

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), type, message }]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  function authHeaders() {
    const token = localStorage.getItem('kleiora_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadSchedule(date: string, month: string, background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const token = localStorage.getItem('kleiora_token');
      if (!token) {
        router.replace('/studio/login');
        return;
      }
      const res = await apiRequest<DailyScheduleResponse>(
        `/studio/schedule?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}`,
        { headers: authHeaders() }
      );
      setData(res);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal memuat jadwal sesi harian.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Load when selectedDate or currentMonth changes
  useEffect(() => {
    loadSchedule(selectedDate, currentMonth, false);
  }, [selectedDate, currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE event updates
  useEffect(() => {
    const token = localStorage.getItem('kleiora_token');
    if (!token) return;

    const sseUrl = `${API_BASE_URL}/studio/events?token=${encodeURIComponent(token)}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);
      eventSource.addEventListener('update', () => {
        loadSchedule(selectedDate, currentMonth, true);
      });
    } catch {
      /* ignore sse connection issues */
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [selectedDate, currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const newMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const newMonth = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
    setCurrentMonth(newMonth);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (!date.startsWith(currentMonth)) {
      setCurrentMonth(date.substring(0, 7));
    }
  };

  // Calendar days calculation for the month view
  const calendarDays = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    // In JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
    // Convert so Monday is 0, Sunday is 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Preceding padding days from previous month
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const pad = (n: number) => String(n).padStart(2, '0');
      const prevM = month - 1 === 0 ? 12 : month - 1;
      const prevY = month - 1 === 0 ? year - 1 : year;
      days.push({
        dateStr: `${prevY}-${pad(prevM)}-${pad(d)}`,
        dayNumber: d,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dateStr: `${year}-${pad(month)}-${pad(d)}`,
        dayNumber: d,
        isCurrentMonth: true,
      });
    }

    // Trailing padding days to fill 35 or 42 cells (full weeks)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month + 1 === 13 ? 1 : month + 1;
      const nextY = month + 1 === 13 ? year + 1 : year;
      days.push({
        dateStr: `${nextY}-${pad(nextM)}-${pad(d)}`,
        dayNumber: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const copyDispatchSummary = async () => {
    if (!data || !data.bookings.length) {
      addToast('info', 'Tidak ada jadwal sesi pada tanggal ini untuk disalin.');
      return;
    }

    const lines: string[] = [];
    lines.push(`📅 *JADWAL SESI FOTO KLEIORA*`);
    lines.push(`*Hari/Tanggal:* ${formatLongDate(selectedDate)}`);
    lines.push(`*Total Klien Terjadwal:* ${data.total_clients} Klien\n`);

    data.bookings.forEach((b, idx) => {
      lines.push(`${idx + 1}. ⏰ *${b.session_hour}.00 WITA* — ${b.full_name} (${b.code})`);
      lines.push(`   📍 *Lokasi:* ${b.session_location}`);
      lines.push(`   📦 *Paket:* ${b.package?.name || 'Paket Foto'}`);
      lines.push(`   🎓 *Kampus:* ${b.campus_name}`);
      lines.push(`   📱 *WA Klien:* ${b.whatsapp}`);
      lines.push(`   💳 *Status Bayar:* ${b.payment_type === 'dp' ? 'DP' : b.payment_type === 'dp_custom' ? 'DP Custom' : 'Lunas'} (${formatRupiah(b.amount_due)})`);
      if (b.notes) lines.push(`   📝 *Catatan:* ${b.notes}`);
      lines.push('');
    });

    lines.push(`⚠️ _Mohon fotografer (FG) hadir 15 menit sebelum sesi dimulai. Semangat & have fun!_ ✨`);

    const text = lines.join('\n');
    await navigator.clipboard.writeText(text);
    addToast('success', 'Agenda jadwal harian berhasil disalin! Siap dikirim ke WhatsApp Fotografer / Tim.');
  };

  const handleRescheduleSubmit = async (newDate: string, newHour: string, newLocation: string, notifyWa: boolean) => {
    if (!rescheduleTarget) return;
    const target = rescheduleTarget;
    setRescheduling(true);
    try {
      await apiRequest(`/studio/bookings/${target.code}/reschedule`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          session_date: newDate,
          session_hour: newHour,
          session_location: newLocation,
        }),
      });
      addToast('success', `Jadwal sesi foto ${target.full_name} (${target.code}) berhasil diubah!`);
      setRescheduleTarget(null);
      await loadSchedule(selectedDate, currentMonth, true);

      if (notifyWa) {
        const whatsapp = target.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62');
        const formattedDate = formatLongDate(newDate);
        const message = `Halo kak *${target.full_name}*, jadwal sesi foto wisuda kakak bersama Kleiora.grads (*Kode: ${target.code}*) telah berhasil kami perbarui:\n\n*Jadwal Baru Sesi Foto:*\n● Hari/Tanggal: ${formattedDate}\n● Waktu: ${newHour}.00 WITA\n● Lokasi: ${newLocation}\n● Paket: ${target.package?.name || 'Paket Foto'}\n\nMohon pastikan hadir 10–15 menit sebelum waktu sesi dimulai ya kak. Sampai jumpa di lokasi! ✨`;
        window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal memperbarui jadwal booking.');
      throw err;
    } finally {
      setRescheduling(false);
    }
  };

  const bookingsList = data?.bookings || [];
  const clientCount = data?.total_clients ?? 0;
  const isToday = selectedDate === todayStr;

  return (
    <div className="min-h-screen bg-[#f7f6f2] pb-16">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface2)]/80 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-[var(--surface2)] transition"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard Utama</span>
            </Link>
            <div className="h-6 w-px bg-[var(--line)]" />
            <Link href="/" className="flex items-center gap-2">
              <Image src="/brand/kleiora-mark-hd.png" alt="" width={1324} height={845} priority className="h-8 w-auto" />
              <span className="font-serif text-lg font-semibold sm:text-xl">
                Kleiora<span className="text-[#a54f3b]">.grads</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSchedule(selectedDate, currentMonth, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-[var(--surface2)] disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Memuat...' : 'Muat Ulang'}</span>
            </button>
            <Link
              href="/dashboard"
              className="btn-secondary px-4 py-2 text-xs"
            >
              Lihat Semua Booking
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Title & Quick Jump Section */}
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 border border-amber-300 px-3 py-1 text-[11px] font-bold text-amber-900">
              <CalendarDays className="h-3.5 w-3.5 text-amber-800" />
              Agenda Sesi Foto Harian
            </div>
            <h1 className="mt-2 font-serif text-3xl font-medium sm:text-4xl text-gray-900">
              Monitoring Jadwal per Hari
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Deteksi berapa klien yang memiliki sesi foto di hari yang sama, atur jadwal, dan pantau ketersediaan fotografer.
            </p>
          </div>

          {/* Quick Date Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleDateSelect(todayStr)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedDate === todayStr
                  ? 'bg-[var(--text)] text-white shadow-xs'
                  : 'border border-[var(--line)] bg-white text-gray-700 hover:bg-[var(--surface2)]'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handleDateSelect(addDaysToDate(todayStr, 1))}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedDate === addDaysToDate(todayStr, 1)
                  ? 'bg-[var(--text)] text-white shadow-xs'
                  : 'border border-[var(--line)] bg-white text-gray-700 hover:bg-[var(--surface2)]'
              }`}
            >
              Besok
            </button>
            <button
              onClick={() => handleDateSelect(addDaysToDate(todayStr, 2))}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedDate === addDaysToDate(todayStr, 2)
                  ? 'bg-[var(--text)] text-white shadow-xs'
                  : 'border border-[var(--line)] bg-white text-gray-700 hover:bg-[var(--surface2)]'
              }`}
            >
              Lusa
            </button>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && handleDateSelect(e.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-[var(--gold)]"
                title="Pilih tanggal bebas"
              />
            </div>
          </div>
        </section>

        {/* 2-Column Layout: Left Mini-Calendar, Right Daily Timeline */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left Column: Mini Calendar & Monthly Counts */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-xs">
              {/* Month Navigation */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold-dark)]">Kalender Bulan</p>
                  <h3 className="font-serif text-xl font-bold text-gray-900">{formatMonthYear(currentMonth)}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-gray-700 hover:bg-[var(--surface2)]"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-gray-700 hover:bg-[var(--surface2)]"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                <div>Sen</div>
                <div>Sel</div>
                <div>Rab</div>
                <div>Kam</div>
                <div>Jum</div>
                <div>Sab</div>
                <div>Min</div>
              </div>

              {/* Calendar Days Grid */}
              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const count = data?.monthly_summary?.[day.dateStr] || 0;
                  const isSelected = day.dateStr === selectedDate;
                  const isTodayDate = day.dateStr === todayStr;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateSelect(day.dateStr)}
                      className={`relative flex min-h-[58px] flex-col items-center justify-between rounded-xl p-1.5 transition ${
                        isSelected
                          ? 'bg-[#1c1b19] text-white shadow-md ring-2 ring-[var(--gold)]'
                          : day.isCurrentMonth
                          ? 'hover:bg-[var(--surface2)] text-gray-800'
                          : 'text-gray-300 hover:bg-gray-50'
                      } ${isTodayDate && !isSelected ? 'border border-amber-300 bg-amber-50/60' : ''}`}
                    >
                      <span className={`text-xs font-semibold ${isTodayDate && !isSelected ? 'text-amber-900 font-bold' : ''}`}>
                        {day.dayNumber}
                      </span>

                      {count > 0 && (
                        <span
                          className={`mt-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                            isSelected
                              ? 'bg-[var(--gold)] text-white'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                          title={`${count} booking pada ${day.dateStr}`}
                        >
                          {count} klien
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-200 border border-amber-400 inline-block" />
                  Ada sesi foto
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-black inline-block" />
                  Hari terpilih
                </span>
              </div>
            </div>

            {/* Quick Helper Card */}
            <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-900">
                <Sparkles className="h-4 w-4 text-[var(--gold-dark)]" />
                Tips Praktis Admin Studio
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
                Klik tanggal mana saja di kalender untuk langsung melihat berapa klien yang terdaftar pada hari tersebut.
                Gunakan tombol <strong>Salin Agenda</strong> untuk langsung membagikan jadwal harian ke grup WhatsApp tim & fotografer tanpa perlu mengetik ulang!
              </p>
            </div>
          </div>

          {/* Right Column: Day Detail & Bookings Timeline */}
          <div className="lg:col-span-7 space-y-4">
            {/* Day Header Banner */}
            <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)]">
                      {isToday ? 'Hari Ini' : 'Tanggal Terpilih'}
                    </span>
                    {clientCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                        {clientCount} Klien Terdaftar
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-gray-900">
                    {formatLongDate(selectedDate)}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyDispatchSummary}
                    disabled={clientCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-700 shadow-xs"
                    title="Salin ringkasan jadwal hari ini ke clipboard untuk dikirim ke WA Fotografer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Salin Agenda ke WA
                  </button>
                </div>
              </div>

              {/* Day Metrics */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 pt-5 border-t border-[var(--line)]">
                <div className="rounded-2xl bg-[var(--surface2)]/70 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Total Klien</p>
                  <strong className="mt-1 block font-serif text-2xl text-gray-900">{clientCount} Sesi</strong>
                </div>
                <div className="rounded-2xl bg-[var(--surface2)]/70 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Status Terbanyak</p>
                  <strong className="mt-1 block font-serif text-xl text-gray-900 truncate">
                    {clientCount === 0 ? '—' : `${bookingsList.filter(b => b.status === 'confirmed').length} Terkonfirmasi`}
                  </strong>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[var(--surface2)]/70 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Zona Waktu</p>
                  <strong className="mt-1 block font-serif text-xl text-gray-900">WITA (Makassar)</strong>
                </div>
              </div>
            </div>

            {/* List of Bookings on the selected date */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--line)] bg-white" />
                ))}
              </div>
            ) : bookingsList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface2)] text-[var(--gold-dark)]">
                  <CalendarIcon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-serif text-xl font-bold text-gray-800">
                  Tidak Ada Sesi Foto di Tanggal Ini
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)] max-w-sm mx-auto">
                  Belum ada klien yang memesan sesi foto pada {formatLongDate(selectedDate)}. Seluruh slot masih kosong.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    onClick={() => handleDateSelect(todayStr)}
                    className="btn-secondary px-4 py-2 text-xs"
                  >
                    Lihat Hari Ini
                  </button>
                  <button
                    onClick={() => handleDateSelect(addDaysToDate(todayStr, 1))}
                    className="btn-primary px-4 py-2 text-xs"
                  >
                    Lihat Besok
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {bookingsList.map((item, index) => {
                  const whatsapp = item.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62');
                  const canReschedule = !['completed', 'cancelled', 'expired'].includes(item.status);

                  return (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-5 transition hover:border-[#d4c4ac] hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Hour & Client Summary */}
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center justify-center rounded-2xl bg-[#1c1b19] px-3.5 py-2.5 text-white text-center shrink-0">
                            <span className="text-[10px] uppercase font-bold text-amber-200">Jam</span>
                            <span className="font-serif text-xl font-bold leading-tight">{item.session_hour}.00</span>
                            <span className="text-[9px] text-gray-300">WITA</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-bold">
                                Sesi #{index + 1}
                              </span>
                              <h3 className="font-bold text-base text-gray-900 truncate">
                                {item.full_name}
                              </h3>
                              <span className="font-mono text-xs text-[var(--muted)]">
                                ({item.code})
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-gray-600 font-medium">
                              🎓 {item.campus_name} • 📦 <span className="text-[var(--gold-dark)] font-bold">{item.package?.name}</span>
                            </p>

                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-700">
                              <MapPin className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <span className="font-semibold">{item.session_location}</span>
                            </p>

                            {item.notes && (
                              <p className="mt-2 text-xs italic text-gray-500 bg-[var(--surface2)]/60 p-2 rounded-xl border border-[var(--line)]">
                                &quot;{item.notes}&quot;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status & Quick Actions */}
                        <div className="flex flex-col sm:items-end gap-2 shrink-0 border-t border-[var(--line)] sm:border-t-0 pt-3 sm:pt-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                              item.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                              item.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {item.status}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {formatRupiah(item.amount_due)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap sm:justify-end">
                            {canReschedule && (
                              <button
                                type="button"
                                onClick={() => setRescheduleTarget(item)}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                                title="Ubah tanggal, jam, atau lokasi sesi ini"
                              >
                                <CalendarDays className="h-3 w-3 text-amber-700" />
                                Ubah Jadwal
                              </button>
                            )}

                            <a
                              href={`https://wa.me/${whatsapp}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Chat WA
                            </a>

                            {item.gallery?.slug && (
                              <Link
                                href={`/g/${item.gallery.slug}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-[var(--surface2)]"
                                title="Buka Galeri Foto"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Galeri
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <RescheduleScheduleModal
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSubmit={handleRescheduleSubmit}
          isSubmitting={rescheduling}
        />
      )}
    </div>
  );
}

function RescheduleScheduleModal({
  booking,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  booking: BookingItem;
  onClose: () => void;
  onSubmit: (newDate: string, newHour: string, newLocation: string, notifyWa: boolean) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [date, setDate] = useState(booking.session_date);
  const [hour, setHour] = useState(booking.session_hour);
  const [location, setLocation] = useState(booking.session_location);
  const [notifyWa, setNotifyWa] = useState(true);
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  const minDate = useMemo(() => todayInMakassar(), []);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError('');
    apiRequest<{ slots: RescheduleSlot[] }>(`/availability?date=${date}`)
      .then(res => setSlots(res.slots || []))
      .catch(err => {
        setSlots([]);
        setError(err instanceof Error ? err.message : 'Gagal memuat ketersediaan slot');
      })
      .finally(() => setLoadingSlots(false));
  }, [date]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !hour) {
      setError('Pilih tanggal dan jam sesi.');
      return;
    }
    try {
      await onSubmit(date, hour, location, notifyWa);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah jadwal');
    }
  };

  const hasChanges = date !== booking.session_date || hour !== booking.session_hour || location !== booking.session_location;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden overscroll-none bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={e => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--gold-dark)]">Reschedule Jadwal</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium">Ubah Jadwal Sesi Foto</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-[var(--line)] p-2 hover:bg-[var(--surface2)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-amber-950 text-sm">{booking.full_name}</span>
            <span className="font-mono text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{booking.code}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-amber-900">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Paket:</span>
              <span className="font-semibold">{booking.package?.name}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Jadwal Sekarang:</span>
              <span className="font-semibold">{booking.session_date} · {booking.session_hour}.00 WITA</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Lokasi:</span>
              <span className="font-semibold truncate block">{booking.session_location}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-800">Tanggal Sesi Baru</span>
            <input
              type="date"
              required
              min={minDate}
              value={date}
              onChange={e => {
                const newD = e.target.value;
                setDate(newD);
                if (newD !== booking.session_date) setHour('');
                else setHour(booking.session_hour);
              }}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface2)] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--gold)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-800">Jam Sesi Baru (WITA)</span>
            <select
              required
              disabled={!date || loadingSlots}
              value={hour}
              onChange={e => setHour(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface2)] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--gold)]"
            >
              <option value="">{loadingSlots ? 'Memeriksa ketersediaan slot...' : 'Pilih jam sesi'}</option>
              {slots.map(s => {
                const isCurrent = date === booking.session_date && s.hour === booking.session_hour;
                const canSelect = s.available || isCurrent;
                return (
                  <option key={s.hour} value={s.hour} disabled={!canSelect}>
                    {s.hour}.00 WITA
                    {isCurrent ? ' (Jadwal saat ini)' : s.available ? ` (${s.remaining} slot tersisa)` : ' — Penuh'}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-800">Lokasi Sesi Foto</span>
            <input
              type="text"
              required
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Contoh: Menara Pinisi UNM / Studio Kleiora"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface2)] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--gold)]"
            />
          </label>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface2)]/60 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyWa}
                onChange={e => setNotifyWa(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--gold)] focus:ring-[var(--gold)]"
              />
              <span className="text-xs font-semibold text-gray-800">
                Kirim pesan konfirmasi perubahan jadwal ke WhatsApp klien setelah disimpan
              </span>
            </label>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary flex-1 px-5 py-3.5 text-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasChanges || !hour}
            className="btn-primary flex-[1.5] px-5 py-3.5 text-sm disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal Baru'}
          </button>
        </div>
      </form>
    </div>
  );
}
