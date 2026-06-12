// Vercel proxy (Node.js runtime) — forwards IPTV requests with permissive CORS.
// Rewrites HLS (.m3u8) playlists so their segment/variant URLs route back through
// this proxy too, and preserves the Range header across redirects so seeking
// returns 206 (fast).
//
// IMPORTANT: this runs on the NODE runtime, not Edge. Xtream `/movie/` URLs
// 301-redirect to a streaming node identified by a RAW IP address, and Vercel's
// EDGE runtime refuses to fetch bare IPs ("Direct IP access is not allowed in
// Vercel's Edge environment"). The Node runtime has no such restriction, so the
// proxy can follow the redirect to the real stream node.
//
// Usage from the app:  /api/proxy?url=<encoded absolute url>

import { Readable } from 'node:stream';

export const config = { runtime: 'nodejs', maxDuration: 60 };

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
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${proxiedUrl(origin, abs(u))}"`);
    }
    return proxiedUrl(origin, abs(t));
  }).join('\n');
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const host = req.headers['host'];
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const origin = `${proto}://${host}`;
  const reqUrl = new URL(req.url, origin);
  const target = reqUrl.searchParams.get('url');
  if (!target) { res.statusCode = 400; res.end('Missing url'); return; }

  // Forward the caller's browser User-Agent (matches what localhost sends).
  const clientUa = req.headers['user-agent'] as string | undefined;
  const fwd: Record<string, string> = {
    'User-Agent': clientUa || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    // Ask for UNCOMPRESSED responses. Node's fetch auto-decompresses gzip, which
    // makes the upstream content-length wrong → forwarding it truncates JSON
    // ("Unterminated string in JSON"). Requesting identity keeps length === body.
    'Accept-Encoding': 'identity',
  };
  const range = req.headers['range'] as string | undefined;
  if (range) fwd['Range'] = range;
  const method = req.method === 'HEAD' ? 'HEAD' : 'GET';

  // CRITICAL: abort the upstream fetch the moment the client disconnects (the
  // browser closes a Range request to open the next one). The provider allows only
  // ONE simultaneous connection — orphaned upstream connections trip that limit and
  // the provider starts rejecting requests. Aborting frees the slot immediately.
  const ac = new AbortController();
  let done = false;
  const onClientGone = () => { if (!done) { try { ac.abort(); } catch {} } };
  req.on('close', onClientGone);
  res.on('close', onClientGone);

  // Follow redirects MANUALLY so the Range header survives every hop (the stream
  // node is often a different host/IP than the panel).
  const fetchFollowing = async (headers: Record<string, string>): Promise<Response> => {
    let current = target;
    let hops = 0;
    while (true) {
      const r = await fetch(current, { method, headers, redirect: 'manual', signal: ac.signal });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc && hops < 5) {
        current = new URL(loc, current).toString();
        hops++;
        continue;
      }
      return r;
    }
  };

  let upstream: Response;
  try {
    upstream = await fetchFollowing(fwd);
    // Panels disagree on User-Agents: some only transcode VOD to H.264 for
    // browser UAs (why we forward the browser's), while others flat-out 403
    // every browser UA. On 403, retry once identifying as a real player.
    if (upstream.status === 403) {
      try { await upstream.body?.cancel(); } catch {}
      const retry = await fetchFollowing({ ...fwd, 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' });
      if (retry.status === 403) { try { await retry.body?.cancel(); } catch {} }
      else upstream = retry;
    }
  } catch (e: any) {
    done = true;
    res.statusCode = 502;
    res.end('Upstream fetch failed: ' + (e?.message || e));
    return;
  }

  const ct = upstream.headers.get('content-type') || '';
  const isM3U8 = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(target);

  // Forward content-range/accept-ranges (needed for video seeking) but only
  // forward content-length when the body was NOT compressed upstream — otherwise
  // the length is the compressed size and the (decompressed) body gets truncated.
  ['content-type', 'content-range', 'accept-ranges', 'cache-control'].forEach((h) => {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  });
  if (!upstream.headers.get('content-encoding')) {
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('content-length', cl);
  }

  if (isM3U8) {
    const text = await upstream.text();
    done = true;
    const rewritten = rewriteM3U8(text, upstream.url || target, origin);
    res.setHeader('content-type', 'application/vnd.apple.mpegurl');
    res.removeHeader('content-length');
    res.statusCode = upstream.status;
    res.end(rewritten);
    return;
  }

  res.statusCode = upstream.status;
  if (upstream.body && method !== 'HEAD') {
    const node = Readable.fromWeb(upstream.body as any);
    node.on('end', () => { done = true; });
    node.on('error', () => { try { res.end(); } catch {} });
    node.pipe(res);
  } else {
    done = true;
    res.end();
  }
}
