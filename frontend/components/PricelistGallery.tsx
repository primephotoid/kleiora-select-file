'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PackageItem, formatRupiah, getImageUrl } from '@/lib/api';
import { ArrowRight, Check, ChevronDown, Clock, Images, MapPin, Sparkles } from 'lucide-react';

interface Props {
  packages: PackageItem[];
  selectedCode?: string;
  onSelectPackage?: (code: string) => void;
  title?: string;
  subtitle?: string;
}

export function PricelistGallery({
  packages,
  selectedCode,
  onSelectPackage,
  title,
  subtitle,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  if (!packages || packages.length === 0) return null;

  const visiblePackages = showAll ? packages : packages.slice(0, 4);

  return (
    <div className="w-full">
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-xl text-center">
          {subtitle && (
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--gold-dark)]">
              {subtitle}
            </p>
          )}
          {title && (
            <h2 className="mt-2 font-serif text-3xl font-medium sm:text-4xl text-[var(--text)]">
              {title}
            </h2>
          )}
        </div>
      )}

      {/* Grid layout matching reference screenshot: 2 columns on mobile/tablet */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {visiblePackages.map((pkg) => {
          const isSelected = selectedCode === pkg.code;
          return (
            <div
              key={pkg.code || pkg.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border bg-[var(--surface)] p-3 sm:p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                isSelected
                  ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/30 shadow-md'
                  : 'border-[var(--line)]'
              }`}
            >
              {/* Media preview with 3:4 aspect ratio matching reference */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-[var(--surface2)] shadow-inner">
                {pkg.image_path?.match(/\.(mp4|webm)$/i) ? (
                  <video
                    src={getImageUrl(pkg.image_path)}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <img
                    src={getImageUrl(pkg.image_path) || '/kleiora.grads-282.webp'}
                    alt={pkg.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                {/* Gradient overlay */}
              </div>

              {/* Card content */}
              <div className="mt-3 flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="font-serif text-base sm:text-xl font-semibold text-[var(--text)] line-clamp-1">
                    {pkg.name}
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold text-[var(--gold-dark)]">
                    {formatRupiah(pkg.price)}
                  </p>

                  {pkg.description && (
                    <p className="mt-1.5 text-xs leading-5 text-[var(--muted)] line-clamp-2">
                      {pkg.description}
                    </p>
                  )}

                  {/* Highlights list */}
                  <div className="mt-3 grid gap-1 text-[11px] text-[var(--muted)]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0 text-[var(--gold)]" />
                      <span className="truncate">
                        {pkg.code === 'cinematic'
                          ? '1 jam take'
                          : pkg.duration_label || `${pkg.duration_hours} jam sesi foto`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0 text-[var(--gold)]" />
                      <span className="truncate">
                        {pkg.code === 'cinematic' ? 'Include edit' : `${pkg.location_count} lokasi`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Images className="h-3 w-3 shrink-0 text-[var(--gold)]" />
                      <span className="truncate">
                        {pkg.code === 'cinematic'
                          ? '1x free revisi edit'
                          : pkg.edited_photos > 0
                          ? `${pkg.edited_photos} foto edited`
                          : '1x free revisi edit'}
                      </span>
                    </div>
                  </div>
                </div>

                {onSelectPackage ? (
                  <button
                    type="button"
                    onClick={() => onSelectPackage(pkg.code)}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold transition active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[var(--gold)] text-white shadow-md'
                        : 'bg-[var(--text)] text-[var(--surface)] hover:bg-[#34312d]'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Terpilih
                      </>
                    ) : (
                      <>
                        Pilih Paket <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/booking?package=${encodeURIComponent(pkg.code)}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--text)] text-[var(--surface)] hover:bg-[#34312d] py-2.5 px-4 text-xs font-bold transition active:scale-[0.98]"
                  >
                    Pilih Paket <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Button "Lihat Semua Pricelist" when packages count > 4 */}
      {packages.length > 4 && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full border border-[var(--gold-dark)] bg-[var(--surface)] px-8 py-4 text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] shadow-sm transition hover:bg-[var(--gold-dark)] hover:text-white active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            {!showAll
              ? `LIHAT SEMUA PRICELIST (${packages.length} PAKET)`
              : 'SEMBUNYIKAN PRICELIST'}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                showAll ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
