// TMDB (The Movie Database) — used to fetch horizontal backdrop art (1280x720,
// 16:9) for the home billboard, the same source UHF-style apps use for hero art.
// Free API key: register at https://www.themoviedb.org/settings/api.
// Add your key in Settings → Integrations → TMDB API Key.

import { useEffect, useState } from 'react';

const IMG_BASE = 'https://image.tmdb.org/t/p/w1280';

const cache = new Map<string, string | null>();

export async function fetchTmdbBackdrop(
  title: string,
  year: number | undefined,
  kind: 'movie' | 'tv',
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey || !title) return null;
  const cacheKey = `${kind}:${title.toLowerCase()}:${year || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({ api_key: apiKey, query: title });
    if (year) params.set(kind === 'movie' ? 'year' : 'first_air_date_year', String(year));
    const res = await fetch(`https://api.themoviedb.org/3/search/${kind}?${params}`);
    if (!res.ok) { cache.set(cacheKey, null); return null; }
    const data = await res.json();
    const hit = (data.results || [])[0];
    const path = hit?.backdrop_path || hit?.poster_path || null;
    const url = path ? `${IMG_BASE}${path}` : null;
    cache.set(cacheKey, url);
    return url;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}

/** React hook wrapper — fetches once per (title, year, kind, key) and skips entirely when `skip` is true. */
export function useTmdbBackdrop(
  title: string,
  year: number | undefined,
  kind: 'movie' | 'tv',
  apiKey: string | undefined,
  skip: boolean,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (skip || !apiKey || !title) return;
    let cancelled = false;
    fetchTmdbBackdrop(title, year, kind, apiKey).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [title, year, kind, apiKey, skip]);
  return url;
}
