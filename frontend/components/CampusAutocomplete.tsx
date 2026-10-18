'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';

export interface CampusItem {
  name: string;
  short?: string;
  city?: string;
}

// Daftar kampus terpopuler (prioritas Makassar/Sulsel & kampus nasional)
export const POPULAR_CAMPUSES: CampusItem[] = [
  // Makassar & Sulawesi Selatan
  { name: 'Universitas Hasanuddin', short: 'UNHAS', city: 'Makassar' },
  { name: 'Universitas Negeri Makassar', short: 'UNM', city: 'Makassar' },
  { name: 'Universitas Islam Negeri Alauddin', short: 'UIN Alauddin', city: 'Makassar' },
  { name: 'Universitas Muslim Indonesia', short: 'UMI', city: 'Makassar' },
  { name: 'Universitas Muhammadiyah Makassar', short: 'UNISMUH', city: 'Makassar' },
  { name: 'Politeknik Negeri Ujung Pandang', short: 'PNUP', city: 'Makassar' },
  { name: 'Universitas Bosowa', short: 'UNIBOS', city: 'Makassar' },
  { name: 'Universitas Fajar', short: 'UNIFA', city: 'Makassar' },
  { name: 'Universitas Kristen Indonesia Paulus', short: 'UKIP', city: 'Makassar' },
  { name: 'Universitas Atma Jaya Makassar', short: 'UAJM', city: 'Makassar' },
  { name: 'Universitas Megarezky', short: 'UNIMERZ', city: 'Makassar' },
  { name: 'Universitas Dipa Makassar', short: 'UNDIPA', city: 'Makassar' },
  { name: 'Universitas Islam Makassar', short: 'UIM', city: 'Makassar' },
  { name: 'Institut Teknologi dan Bisnis Kalla', short: 'Kalla Institute', city: 'Makassar' },
  { name: 'Politeknik Pertanian Negeri Pangkajene Kepulauan', short: 'Politani Pangkep', city: 'Pangkep' },
  { name: 'Politeknik Kesehatan Kemenkes Makassar', short: 'Poltekkes Makassar', city: 'Makassar' },
  { name: 'Politeknik Maritim AMI Makassar', short: 'POLIMARIM', city: 'Makassar' },
  { name: 'Universitas Pancasakti Makassar', short: 'UNPANTI', city: 'Makassar' },
  { name: 'Universitas Indonesia Timur', short: 'UIT', city: 'Makassar' },
  { name: 'Universitas Cokroaminoto Makassar', short: 'UCM', city: 'Makassar' },
  { name: 'Universitas Sawerigading', short: 'UNSA', city: 'Makassar' },
  { name: 'Universitas Patria Artha', short: 'UPA', city: 'Makassar' },
  { name: 'STIE Nobel Indonesia', short: 'Nobel Indonesia', city: 'Makassar' },
  { name: 'Institut Bisnis dan Keuangan Nitro', short: 'IBK Nitro', city: 'Makassar' },
  { name: 'Universitas Terbuka Makassar', short: 'UT Makassar', city: 'Makassar' },
  { name: 'IAIN Bone', short: 'IAIN Bone', city: 'Bone' },
  { name: 'IAIN Palopo', short: 'IAIN Palopo', city: 'Palopo' },
  { name: 'IAIN Parepare', short: 'IAIN Parepare', city: 'Parepare' },
  { name: 'Universitas Andi Djemma', short: 'UNANDA', city: 'Palopo' },
  { name: 'Universitas Cokroaminoto Palopo', short: 'UNCP', city: 'Palopo' },
  { name: 'Universitas Puangrimaggalatung', short: 'UNIPRIMA', city: 'Wajo' },
  // Sulawesi lainnya
  { name: 'Universitas Sam Ratulangi', short: 'UNSRAT', city: 'Manado' },
  { name: 'Universitas Tadulako', short: 'UNTAD', city: 'Palu' },
  { name: 'Universitas Halu Oleo', short: 'UHO', city: 'Kendari' },
  { name: 'Universitas Negeri Gorontalo', short: 'UNG', city: 'Gorontalo' },
  { name: 'Universitas Sulawesi Barat', short: 'UNSULBAR', city: 'Majene' },
  // Nasional Terkemuka
  { name: 'Universitas Indonesia', short: 'UI', city: 'Depok' },
  { name: 'Institut Teknologi Bandung', short: 'ITB', city: 'Bandung' },
  { name: 'Universitas Gadjah Mada', short: 'UGM', city: 'Yogyakarta' },
  { name: 'Universitas Airlangga', short: 'UNAIR', city: 'Surabaya' },
  { name: 'Institut Teknologi Sepuluh Nopember', short: 'ITS', city: 'Surabaya' },
  { name: 'Universitas Brawijaya', short: 'UB', city: 'Malang' },
  { name: 'Universitas Padjadjaran', short: 'UNPAD', city: 'Bandung' },
  { name: 'Universitas Diponegoro', short: 'UNDIP', city: 'Semarang' },
  { name: 'Universitas Sebelas Maret', short: 'UNS', city: 'Surakarta' },
  { name: 'IPB University (Institut Pertanian Bogor)', short: 'IPB', city: 'Bogor' },
  { name: 'Universitas Pendidikan Indonesia', short: 'UPI', city: 'Bandung' },
  { name: 'Universitas Sumatera Utara', short: 'USU', city: 'Medan' },
  { name: 'Universitas Andalas', short: 'UNAND', city: 'Padang' },
  { name: 'Universitas Udayana', short: 'UNUD', city: 'Bali' },
  { name: 'Universitas Bina Nusantara', short: 'BINUS', city: 'Jakarta' },
  { name: 'Telkom University', short: 'Tel-U', city: 'Bandung' }
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  ariaInvalid?: boolean;
  dataField?: string;
}

export function CampusAutocomplete({
  value,
  onChange,
  placeholder = 'Ketik nama atau singkatan kampus...',
  className,
  ariaInvalid,
  dataField = 'campus_name'
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter daftar kampus berdasarkan input pengguna
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return POPULAR_CAMPUSES.slice(0, 8); // Tampilkan rekomendasi awal kampus teratas saat kolom disentuh

    return POPULAR_CAMPUSES.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const shortMatch = c.short ? c.short.toLowerCase().includes(q) : false;
      const cityMatch = c.city ? c.city.toLowerCase().includes(q) : false;
      return nameMatch || shortMatch || cityMatch;
    }).slice(0, 10);
  }, [value]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(campus: CampusItem) {
    const formatted = campus.short && !campus.name.includes(campus.short)
      ? `${campus.name} (${campus.short})`
      : campus.name;
    onChange(formatted);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      if (filtered[highlightIndex]) {
        e.preventDefault();
        handleSelect(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div>
        <input
          ref={inputRef}
          required
          data-field={dataField}
          aria-invalid={ariaInvalid}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setHighlightIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setHighlightIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={className}
          placeholder={placeholder}
        />
      </div>

      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1"
        >
          <li className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]/50 mb-1 flex items-center justify-between">
            <span>Saran Kampus Otomatis</span>
            <span className="text-[10px] font-normal normal-case">Ketik bebas jika tidak terdaftar</span>
          </li>
          {filtered.map((campus, idx) => {
            const isSelected = value.toLowerCase() === campus.name.toLowerCase() ||
              (campus.short && value.toLowerCase().includes(campus.short.toLowerCase()));
            const isHighlighted = idx === highlightIndex;

            return (
              <li
                key={`${campus.name}-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseDown={e => {
                  e.preventDefault(); // Mencegah input kehilangan fokus sebelum handleSelect
                  handleSelect(campus);
                }}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isHighlighted
                    ? 'bg-[var(--surface2)] text-[var(--text)]'
                    : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                }`}
              >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-gray-900">{campus.name}</span>
                      {campus.short && (
                        <span className="rounded bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-dark)] ring-1 ring-inset ring-[var(--line)]">
                          {campus.short}
                        </span>
                      )}
                    </div>
                    {campus.city && (
                      <span className="block text-[11px] text-[var(--muted)]">
                        {campus.city}
                      </span>
                    )}
                  </div>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--gold-dark)] ml-2" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
