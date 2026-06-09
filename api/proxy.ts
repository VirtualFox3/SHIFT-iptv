// Vercel Edge proxy — forwards IPTV requests with permissive CORS and upgrades
// http→https-origin mixed content. Rewrites HLS (.m3u8) playlists so their
// segment/variant URLs route back through this proxy too.
//
// Usage from the app:  /api/proxy?url=<encoded absolute url>

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function proxiedUrl(origin: string, target: string): string {
  return `${origin}/api/proxy?url=${encodeURIComponent(target)}`;
}

// Rewrite every URL in an m3u8 so playback stays behind the proxy.
function rewriteM3U8(text: string, baseUrl: string, origin: string): string {
  const base = new URL(baseUrl);
  const abs = (u: string) => {
    try { return new URL(u, base).toString(); } catch { return u; }
  };
  return text.split('\n').map((line) => {
    const t = line.trim();
    if (!t) return line;
    // URI="..." attributes (EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, etc.)
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${proxiedUrl(origin, abs(u))}"`);
    }
    // Bare segment / variant URL lines
    return proxiedUrl(origin, abs(t));
  }).join('\n');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const { searchParams, origin } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return new Response('Missing url', { status: 400, headers: CORS });

  // Forward the caller's BROWSER User-Agent — exactly what localhost sends when it
  // plays directly. Many panels transcode VOD to browser-playable H.264 when a
  // browser asks (raw HEVC when a player like VLC asks), so this makes the proxy
  // relay the same playable stream localhost gets. Falls back to a Chrome UA.
  const clientUa = req.headers.get('user-agent');
  const fwd: Record<string, string> = {
    'User-Agent': clientUa || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };
  const range = req.headers.get('range');
  if (range) fwd['Range'] = range;
  const method = req.method === 'HEAD' ? 'HEAD' : 'GET';

  // Follow redirects MANUALLY so the Range header survives (fetch's automatic
  // redirect-follow drops Range → origin returns the whole file → seeking breaks).
  let upstream: Response;
  try {
    let current = target;
    let hops = 0;
    while (true) {
      upstream = await fetch(current, { method, headers: fwd, redirect: 'manual' });
      const loc = upstream.headers.get('location');
      if (upstream.status >= 300 && upstream.status < 400 && loc && hops < 5) {
        current = new URL(loc, current).toString();
        hops++;
        continue;
      }
      break;
    }
  } catch (e: any) {
    return new Response('Upstream fetch failed: ' + (e?.message || e), { status: 502, headers: CORS });
  }

  const ct = upstream.headers.get('content-type') || '';
  const isM3U8 = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(target);

  const headers = new Headers(CORS);
  ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach((h) => {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  });

  if (isM3U8) {
    const text = await upstream.text();
    const rewritten = rewriteM3U8(text, upstream.url || target, origin);
    headers.set('content-type', 'application/vnd.apple.mpegurl');
    headers.delete('content-length');
    return new Response(rewritten, { status: upstream.status, headers });
  }

  // Stream everything else straight through (segments, mp4, JSON, m3u, etc.)
  return new Response(upstream.body, { status: upstream.status, headers });
}
