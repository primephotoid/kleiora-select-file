'use client';

import { useEffect, useState } from 'react';

export type Region = 'makassar' | 'out_of_town';

const STORAGE_KEY = 'kleiora_region';
const AUTO_DETECT_KEY = 'kleiora_region_auto_detected';

// Free IP geolocation APIs (no API key required, best-effort)
const GEO_APIS = [
  'https://ipapi.co/json/',
  'https://ip-api.com/json/?fields=city,regionName,country',
];

// Keywords indicating Makassar area
const MAKASSAR_KEYWORDS = [
  'makassar', 'gowa', 'maros', 'takalar', 'pangkep', 'barru',
  'sulawesi selatan', 'south sulawesi',
];

function isMakassarArea(city?: string, region?: string, country?: string): boolean {
  if (!country || !['id', 'indonesia'].includes(country.toLowerCase())) return false;
  const haystack = `${city ?? ''} ${region ?? ''}`.toLowerCase();
  return MAKASSAR_KEYWORDS.some(kw => haystack.includes(kw));
}

async function detectRegion(): Promise<Region | null> {
  for (const url of GEO_APIS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = await res.json();
      // ipapi.co: { city, region, country_code }
      // ip-api.com: { city, regionName, country }
      const city: string = data.city ?? '';
      const regionName: string = data.region ?? data.regionName ?? '';
      const country: string = data.country_code ?? data.country ?? '';
      if (isMakassarArea(city, regionName, country)) return 'makassar';
      return 'out_of_town';
    } catch {
      // try next API
    }
  }
  return null; // detection failed – keep manual choice
}

export function useRegion() {
  const [region, setRegionState] = useState<Region>('makassar');
  const [detecting, setDetecting] = useState(false);

  // Load saved or auto-detect on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Region | null;
    if (saved === 'makassar' || saved === 'out_of_town') {
      setRegionState(saved);
      return;
    }
    // Not yet detected – try auto-detect once
    const alreadyTried = localStorage.getItem(AUTO_DETECT_KEY);
    if (alreadyTried) {
      setRegionState('makassar'); // default
      return;
    }
    setDetecting(true);
    detectRegion()
      .then(detected => {
        if (detected) {
          localStorage.setItem(STORAGE_KEY, detected);
          setRegionState(detected);
        } else {
          setRegionState('makassar');
        }
      })
      .catch(() => setRegionState('makassar'))
      .finally(() => {
        localStorage.setItem(AUTO_DETECT_KEY, '1');
        setDetecting(false);
      });
  }, []);

  const setRegion = (r: Region) => {
    localStorage.setItem(STORAGE_KEY, r);
    setRegionState(r);
  };

  return { region, setRegion, detecting };
}

/** Return the effective price based on region */
export function effectivePrice(pkg: { price: number; price_out_of_town: number }, region: Region): number {
  return region === 'out_of_town' && pkg.price_out_of_town > 0
    ? pkg.price_out_of_town
    : pkg.price;
}
