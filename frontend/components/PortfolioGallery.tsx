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

/** Skeleton card — shimmer placeholder matching the real card's aspect ratio */
function SkeletonCard() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#e8e4dc]">
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}

/** Single portfolio card */
function PortfolioCard({ port }: { port: PortfolioItem }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#e8e4dc] shadow-sm group">
      {/* Skeleton behind the image until it loads */}
      {!loaded && <div className="skeleton-shimmer absolute inset-0" />}

      {port.image_path?.match(/\.(mp4|webm)$/i) ? (
        <video
          src={getImageUrl(port.image_path)}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setLoaded(true)}
          className={`absolute h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <img
          src={getImageUrl(port.image_path)}
          alt={`Portfolio foto wisuda ${port.title || 'Kleiora Grads'}`}
          onLoad={() => setLoaded(true)}
          className={`absolute h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-105 transition-transform`}
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
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
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      {/* Shimmer keyframe — injected once */}
      <style>{`
        @keyframes portfolio-shimmer {
          0%   { background-position: -800px 0; }
          100% { background-position:  800px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            #e8e4dc 25%,
            #f0ece4 50%,
            #e8e4dc 75%
          );
          background-size: 800px 100%;
          animation: portfolio-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Real cards */}
        {portfolios.map(port => (
          <PortfolioCard key={port.id} port={port} />
        ))}

        {/* Skeleton cards appear inside the grid while loading */}
        {loading && Array.from({ length: LIMIT }).map((_, i) => (
          <SkeletonCard key={`skeleton-${i}`} />
        ))}
      </div>

      {/* Sentinel — triggers loadMore when scrolled into view */}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />

      {!hasMore && portfolios.length > 0 && !loading && (
        <p className="mt-8 text-center text-xs font-bold uppercase tracking-[.2em] text-[var(--muted)]">
          Semua foto telah ditampilkan
        </p>
      )}
    </>
  );
}
