// Routes IPTV requests through the Vercel edge proxy when the app is deployed
// (fixes CORS + http→https mixed content). On localhost we hit servers directly,
// since the dev server has no /api/proxy and CORS is more lenient there.

function isLocal(): boolean {
  if (typeof location === 'undefined') return true;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

/** Wrap a URL so it goes through /api/proxy when deployed. */
export function proxify(url: string | undefined): string {
  if (!url) return url || '';
  if (isLocal()) return url;
  // Already proxied
  if (url.includes('/api/proxy?url=')) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Best playback URL for a stream. Always route through the proxy when deployed:
 * the proxy spoofs a player User-Agent (many IPTV servers BLOCK browser UAs),
 * fixes CORS, and avoids http→https mixed content. On localhost it returns the
 * URL unchanged (direct). Seeking is a touch slower via the proxy, but this is
 * what actually makes provider streams play.
 */
export function streamSrc(url: string | undefined): string {
  return proxify(url);
}

/** Recover the original provider URL from a (possibly proxied) URL. */
export function deproxify(url: string | undefined): string {
  if (!url) return '';
  const i = url.indexOf('/api/proxy?url=');
  if (i === -1) return url;
  try { return decodeURIComponent(url.slice(i + '/api/proxy?url='.length)); } catch { return url; }
}
