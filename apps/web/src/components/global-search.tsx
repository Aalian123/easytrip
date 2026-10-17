'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, query } from '@/lib/api';
import { PlateChip } from './plate-chip';

interface Hit {
  type: string;
  id: string;
  label: string;
  detail: string;
  href: string;
}

const TYPE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  rider: 'Rider',
  fuelCard: 'Fuel card',
  assignment: 'Assignment',
  accident: 'Accident',
};

/** One box over plates, riders, cards, assignments and accidents. */
export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => api<Hit[]>(`/search${query({ q: term })}`),
    enabled: term.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const hits = data ?? [];

  const go = (hit: Hit) => {
    router.push(hit.href);
    setOpen(false);
    setTerm('');
  };

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 transition focus-within:border-sky focus-within:ring-[3px] focus-within:ring-sky/15">
        <Search size={15} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!hits.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((current) => (current + 1) % hits.length);
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((current) => (current - 1 + hits.length) % hits.length);
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              go(hits[highlight]);
            }
          }}
          placeholder="Search a plate, rider, card or accident"
          className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          aria-label="Search"
        />
        <kbd className="hidden shrink-0 rounded border border-line-strong bg-canvas px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted sm:block">
          ⌘K
        </kbd>
      </div>

      {open && term.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          {isFetching && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Searching</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              Nothing matches “{term}”. Try a plate or part of a name.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {hits.map((hit, index) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                      index === highlight ? 'bg-canvas' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {hit.type === 'vehicle' ? (
                        <PlateChip registration={hit.label} size="sm" />
                      ) : (
                        <span className="truncate text-sm font-semibold text-navy">{hit.label}</span>
                      )}
                      <span className="truncate text-xs text-muted">{hit.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted">
                      {TYPE_LABELS[hit.type] ?? hit.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
