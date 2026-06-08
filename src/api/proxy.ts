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
 * Best playback URL for a stream:
 * - HLS (.m3u8) goes through hls.js (fetch) → needs the CORS proxy when deployed.
 * - Direct files (.mp4/.mkv/.ts) play via <video src>, which does NOT enforce CORS —
 *   so play them DIRECTLY (fast native seeking) unless it's an http stream on an
 *   https page (mixed-content), where the proxy is the only way.
 */
export function streamSrc(url: string | undefined): string {
  if (!url) return '';
  const isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls) return proxify(url);
  const pageHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const urlHttp = /^http:\/\//i.test(url);
  if (pageHttps && urlHttp) return proxify(url); // mixed content → must proxy
  return url; // direct playback, fast seeking
}

/** Recover the original provider URL from a (possibly proxied) URL. */
export function deproxify(url: string | undefined): string {
  if (!url) return '';
  const i = url.indexOf('/api/proxy?url=');
  if (i === -1) return url;
  try { return decodeURIComponent(url.slice(i + '/api/proxy?url='.length)); } catch { return url; }
}
