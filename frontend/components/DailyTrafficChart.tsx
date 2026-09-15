'use client';

import React, { useState, useMemo } from 'react';
import { DailyTraffic } from '@/lib/api';
import { Calendar, TrendingUp, Users, Eye, BarChart3 } from 'lucide-react';

interface DailyTrafficChartProps {
  data?: DailyTraffic[];
}

export function DailyTrafficChart({ data = [] }: DailyTrafficChartProps) {
  const [metric, setMetric] = useState<'views' | 'visitors' | 'both'>('views');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Format date string YYYY-MM-DD into short Indonesian format (e.g. 15 Sep)
  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Identify peak date (highest total_views or unique_visits)
  const peakItem = useMemo(() => {
    if (!data || data.length === 0) return null;
    return [...data].sort((a, b) => (b.total_views + b.unique_visits) - (a.total_views + a.unique_visits))[0];
  }, [data]);

  // Max value for chart scaling
  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 1;
    let max = 0;
    data.forEach(item => {
      if (metric === 'views') max = Math.max(max, item.total_views);
      else if (metric === 'visitors') max = Math.max(max, item.unique_visits);
      else max = Math.max(max, item.total_views, item.unique_visits);
    });
    return max > 0 ? max : 1;
  }, [data, metric]);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface2)] text-gray-400">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-semibold text-gray-800">Belum Ada Data Trafik Harian</h3>
        <p className="mt-1 text-sm text-gray-500">
          Grafik akan otomatis menampilkan statistik tanggal saat pengunjung dan klien mulai mengakses website.
        </p>
      </div>
    );
  }

  const activeHoverItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="space-y-4">
      {/* Peak Access Banner */}
      {peakItem && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-100/30 to-amber-500/5 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Tanggal Teramai Akses</span>
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    Puncak Akses
                  </span>
                </div>
                <h4 className="mt-0.5 text-lg font-bold text-gray-900">
                  {formatDateFull(peakItem.date)}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-amber-200/60 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-[10px] font-medium text-gray-500">Total Tayangan</div>
                  <div className="text-sm font-bold text-gray-900">{peakItem.total_views} kali</div>
                </div>
              </div>
              <div className="h-7 w-[1px] bg-amber-200/80" />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] font-medium text-gray-500">Pengunjung Unik</div>
                  <div className="text-sm font-bold text-gray-900">{peakItem.unique_visits} klien</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chart Container */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        {/* Header & Metric Controls */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <Calendar className="h-4 w-4 text-[var(--gold)]" />
              Grafik Akses Klien per Tanggal
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Visualisasi jumlah kunjungan dan pengakses website dari waktu ke waktu
            </p>
          </div>

          {/* Metric Selector Buttons */}
          <div className="inline-flex rounded-xl bg-[var(--surface2)] p-1 border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setMetric('views')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                metric === 'views'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tayangan
            </button>
            <button
              type="button"
              onClick={() => setMetric('visitors')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                metric === 'visitors'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pengunjung
            </button>
            <button
              type="button"
              onClick={() => setMetric('both')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                metric === 'both'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 flex items-center justify-end gap-5 text-xs font-medium text-gray-600">
          {(metric === 'views' || metric === 'both') && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400" />
              <span>Tayangan (Views)</span>
            </div>
          )}
          {(metric === 'visitors' || metric === 'both') && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" />
              <span>Pengunjung Unik</span>
            </div>
          )}
        </div>

        {/* Hover Info Tooltip Preview */}
        <div className="min-h-[28px] mb-2 flex items-center justify-center">
          {activeHoverItem ? (
            <div className="inline-flex items-center gap-3 rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs text-white shadow-md">
              <span className="font-semibold text-amber-300">{formatDateFull(activeHoverItem.date)}</span>
              <span className="text-gray-400">|</span>
              <span>Tayangan: <strong className="text-amber-400">{activeHoverItem.total_views}</strong></span>
              <span className="text-gray-400">|</span>
              <span>Pengunjung: <strong className="text-emerald-400">{activeHoverItem.unique_visits}</strong></span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-400">Arahkan kursor ke batang grafik untuk melihat detail tanggal</span>
          )}
        </div>

        {/* Visual Bar Chart */}
        <div className="relative pt-6 pb-2">
          {/* Y-Axis Grid Lines */}
          <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
            <div className="w-full border-b border-dashed border-gray-100 flex justify-end">
              <span className="text-[10px] text-gray-400 -mt-2.5 bg-white px-1">{maxVal}</span>
            </div>
            <div className="w-full border-b border-dashed border-gray-100 flex justify-end">
              <span className="text-[10px] text-gray-400 -mt-2.5 bg-white px-1">{Math.round(maxVal / 2)}</span>
            </div>
            <div className="w-full border-b border-gray-200 flex justify-end">
              <span className="text-[10px] text-gray-400 -mt-2.5 bg-white px-1">0</span>
            </div>
          </div>

          {/* Bars Container */}
          <div className="relative z-10 flex h-48 items-end gap-1 sm:gap-2 px-2">
            {data.map((item, idx) => {
              const isPeak = peakItem && item.date === peakItem.date;
              const isHovered = hoveredIdx === idx;

              const viewsPct = Math.max(8, (item.total_views / maxVal) * 100);
              const visitorsPct = Math.max(8, (item.unique_visits / maxVal) * 100);

              return (
                <div
                  key={item.date || idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                >
                  {/* Peak Marker Badge */}
                  {isPeak && (
                    <div className="absolute -top-6 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shadow-2xs whitespace-nowrap z-20">
                      ★ Puncak
                    </div>
                  )}

                  {/* Dual or Single Bar Group */}
                  <div className="flex w-full items-end justify-center gap-0.5 sm:gap-1 h-full pb-1">
                    {(metric === 'views' || metric === 'both') && (
                      <div
                        style={{ height: `${viewsPct}%` }}
                        className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${
                          isPeak
                            ? 'bg-gradient-to-t from-amber-600 to-amber-400 ring-2 ring-amber-300'
                            : isHovered
                            ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                            : 'bg-gradient-to-t from-amber-500/80 to-amber-300/80'
                        }`}
                      />
                    )}

                    {(metric === 'visitors' || metric === 'both') && (
                      <div
                        style={{ height: `${visitorsPct}%` }}
                        className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${
                          isPeak
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 ring-2 ring-emerald-300'
                            : isHovered
                            ? 'bg-gradient-to-t from-emerald-500 to-emerald-300'
                            : 'bg-gradient-to-t from-emerald-500/80 to-emerald-300/80'
                        }`}
                      />
                    )}
                  </div>

                  {/* X-Axis Label */}
                  <div className="mt-1 text-center">
                    <span
                      className={`block text-[10px] font-medium transition ${
                        isPeak
                          ? 'font-bold text-amber-700'
                          : isHovered
                          ? 'text-gray-900'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatDateShort(item.date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
