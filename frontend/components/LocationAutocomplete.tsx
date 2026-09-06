'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface Suggestion {
  place_id: number;
  display_name: string;
  short: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  ariaInvalid?: boolean;
}

function buildShortName(displayName: string): string {
  // Ambil 2-3 segmen pertama yang bermakna dari nama lengkap Nominatim
  const parts = displayName.split(',').map(s => s.trim()).filter(Boolean);
  return parts.slice(0, 3).join(', ');
}

export function LocationAutocomplete({ value, onChange, placeholder, className, ariaInvalid }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync external value ke query jika berbeda (misal reset form)
  useEffect(() => {
    setQuery(value);
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

  function handleInput(val: string) {
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&countrycodes=id&limit=6&format=json&addressdetails=0`,
          { signal: abortRef.current.signal, headers: { 'Accept-Language': 'id' } }
        );
        const data: { place_id: number; display_name: string }[] = await res.json();
        setSuggestions(data.map(d => ({ place_id: d.place_id, display_name: d.display_name, short: buildShortName(d.display_name) })));
        setOpen(data.length > 0);
      } catch {
        // Abaikan abort error
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function select(s: Suggestion) {
    setQuery(s.short);
    onChange(s.short);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          required
          aria-invalid={ariaInvalid}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className={className}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            className="h-4 w-4 animate-spin text-[var(--muted)]"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          overflow: 'hidden', margin: 0, padding: 0, listStyle: 'none',
        }}>
          {suggestions.map(s => (
            <li
              key={s.place_id}
              onMouseDown={() => select(s)}
              style={{ padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <MapPin style={{ flexShrink: 0, marginTop: '2px' }} className="h-3.5 w-3.5 text-[var(--gold)]" />
              <span style={{ fontSize: '0.8125rem', lineHeight: 1.4, color: 'var(--text)' }}>{s.short}</span>
            </li>
          ))}
          <li style={{ padding: '0.4rem 0.85rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
            Sumber: OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
