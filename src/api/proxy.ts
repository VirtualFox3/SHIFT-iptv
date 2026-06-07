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
