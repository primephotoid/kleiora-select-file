'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getImageUrl, PortfolioItem } from '@/lib/api';

const LIMIT = 15;

interface Meta {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

interface PortfolioPageResponse {
  portfolios: PortfolioItem[];
  meta: Meta;
}

async function fetchPortfolios(page: number): Promise<PortfolioPageResponse> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `http://${window.location.hostname}:4000/api/v1`
      : 'http://localhost:8080/api/v1');
  const res = await fetch(`${apiBase}/portfolios?page=${page}&limit=${LIMIT}`);
  if (!res.ok) throw new Error('Gagal memuat portofolio');
  return res.json();
}

interface Props {
  initialPortfolios: PortfolioItem[];
  initialHasMore: boolean;
}

export function PortfolioGallery({ initialPortfolios, initialHasMore }: Props) {
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>(initialPortfolios);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetching = useRef(false);

  const loadMore = useCallback(async () => {
    if (isFetching.current || !hasMore) return;
    isFetching.current = true;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const data = await fetchPortfolios(nextPage);
      setPortfolios(prev => [...prev, ...data.portfolios]);
      setPage(nextPage);
      setHasMore(data.meta.has_more);
    } catch {
      // Fail silently; user can scroll back down to retry
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [page, hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {portfolios.map(port => (
          <div
            key={port.id}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[var(--surface2)] shadow-sm group"
          >
            {port.image_path?.match(/\.(mp4|webm)$/i) ? (
              <video
                src={getImageUrl(port.image_path)}
                autoPlay
                loop
                muted
                playsInline
                className="absolute h-full w-full object-cover"
              />
            ) : (
              <img
                src={getImageUrl(port.image_path)}
                alt={`Portfolio foto wisuda ${port.title || 'Kleiora Grads'}`}
                className="absolute h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
        ))}
      </div>

      {/* Sentinel element — observed to trigger next page load */}
      <div ref={sentinelRef} aria-hidden="true" />

      {loading && (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gold)] border-t-transparent" />
        </div>
      )}

      {!hasMore && portfolios.length > 0 && (
        <p className="mt-8 text-center text-xs font-bold uppercase tracking-[.2em] text-[var(--muted)]">
          Semua foto telah ditampilkan
        </p>
      )}
    </div>
  );
}
