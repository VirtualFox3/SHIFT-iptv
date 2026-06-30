// TMDB (The Movie Database) — used to fetch horizontal backdrop art (1280x720,
// 16:9) for the home billboard, the same source UHF-style apps use for hero art.
// Free API key: register at https://www.themoviedb.org/settings/api.
// Add your key in Settings → Integrations → TMDB API Key.

import { useEffect, useState } from 'react';

const IMG_BASE = 'https://image.tmdb.org/t/p/w1280';

const cache = new Map<string, string | null>();

// IPTV providers prefix/suffix titles with their own tags — "EN - Supernatural
// (US)", "D+ - Supernatural (2005) (US)", "4K | Dexter" — none of which TMDB's
// search can match. Strip a short leading provider/quality/region code and any
// trailing (US)/(UK)/(year) parentheticals, but leave real titles with colons
// or dashes (e.g. "Mission: Impossible - Fallout") untouched.
function cleanTitleForTmdb(raw: string): string {
  let t = raw.trim();
  const m = t.match(/^([A-Z0-9+]{1,5})\s*[-:|]\s*(.+)$/);
  if (m) t = m[2];
  t = t.replace(/·.*$/, '');
  t = t.replace(/\s*\((?:US|UK|CA|AU|NZ|IN|RAW|\d{4})\)\s*/gi, ' ');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || raw.trim();
}

async function searchTmdb(query: string, year: number | undefined, kind: 'movie' | 'tv', apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({ api_key: apiKey, query });
  if (year) params.set(kind === 'movie' ? 'year' : 'first_air_date_year', String(year));
  const res = await fetch(`https://api.themoviedb.org/3/search/${kind}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.results || [])[0];
  return hit?.backdrop_path || hit?.poster_path || null;
}

export async function fetchTmdbBackdrop(
  rawTitle: string,
  year: number | undefined,
  kind: 'movie' | 'tv',
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey || !rawTitle) return null;
  const title = cleanTitleForTmdb(rawTitle);
  const cacheKey = `${kind}:${title.toLowerCase()}:${year || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    // Try with the provider's claimed year first, then without — providers
    // sometimes get the year wrong or omit it, which would otherwise 0-match.
    let path = await searchTmdb(title, year, kind, apiKey);
    if (!path && year) path = await searchTmdb(title, undefined, kind, apiKey);
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
