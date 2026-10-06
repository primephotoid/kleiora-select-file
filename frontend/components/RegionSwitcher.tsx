'use client';

import { MapPin, Loader2 } from 'lucide-react';
import { Region } from '@/lib/useRegion';

interface Props {
  region: Region;
  detecting: boolean;
  onSwitch: (r: Region) => void;
}

export function RegionSwitcher({ region, detecting, onSwitch }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface2)] text-[var(--gold-dark)]">
          <MapPin className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--text)]">Lokasi Sesi Foto</p>
          {detecting ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Mendeteksi lokasi otomatis...
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              {region === 'makassar'
                ? 'Sesi foto di area Makassar & sekitarnya'
                : 'Sesi foto di luar Makassar (termasuk biaya perjalanan tim)'}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface2)] p-1">
        <button
          type="button"
          onClick={() => onSwitch('makassar')}
          className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
            region === 'makassar'
              ? 'bg-[var(--text)] text-white shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          Makassar
        </button>
        <button
          type="button"
          onClick={() => onSwitch('out_of_town')}
          className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
            region === 'out_of_town'
              ? 'bg-[var(--text)] text-white shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          Luar Makassar
        </button>
      </div>
    </div>
  );
}
