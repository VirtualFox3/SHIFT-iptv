// TMDB — fetches horizontal backdrop art for the billboard/cards, matching the
// web app. Free key from https://www.themoviedb.org/settings/api, entered in
// Settings. Falls back gracefully (returns null) when no key is set.

const IMG_BASE = 'https://image.tmdb.org/t/p/w1280';
const cache = new Map<string, string | null>();

// Providers prefix/suffix titles with tags ("EN - Dexter (US)") that TMDB
// can't match — strip a short leading code and trailing (US)/(year) bits.
function cleanTitle(raw: string): string {
  let t = raw.trim();
  const m = t.match(/^([A-Z0-9+]{1,5})\s*[-:|]\s*(.+)$/);
  if (m) t = m[2];
  t = t.replace(/·.*$/, '');
  t = t.replace(/\s*\((?:US|UK|CA|AU|NZ|IN|RAW|\d{4})\)\s*/gi, ' ');
  return t.replace(/\s{2,}/g, ' ').trim() || raw.trim();
}

async function search(query: string, year: number | undefined, kind: 'movie' | 'tv', apiKey: string): Promise<string | null> {
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
  const title = cleanTitle(rawTitle);
  const cacheKey = `${kind}:${title.toLowerCase()}:${year || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  try {
    let path = await search(title, year, kind, apiKey);
    if (!path && year) path = await search(title, undefined, kind, apiKey);
    const url = path ? `${IMG_BASE}${path}` : null;
    cache.set(cacheKey, url);
    return url;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}
