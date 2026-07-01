// Trakt OAuth device-flow proxy (Node runtime). The token exchange REQUIRES a
// client_secret, which must never live in browser JS — so it happens here, using
// env vars. Configure on Vercel:  TRAKT_CLIENT_ID  and  TRAKT_CLIENT_SECRET.
//
//   POST /api/trakt?action=code                 -> device code (public, no secret)
//   POST /api/trakt?action=token  {code}        -> tokens (needs secret; 400 = pending)
//   GET  /api/trakt?action=profile&token=...     -> the user's profile

export const config = { runtime: 'nodejs' };

const BASE = 'https://api.trakt.tv';
// Public device-flow client id (overridable by env); the secret is env-only.
const CLIENT_ID = process.env.TRAKT_CLIENT_ID || 'b4f7ed8323521f2e0f3b8e53e85bd1dc0de58a62ac7d9ad4a2e82d0e88591cf0';
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET || '';

function hdr() {
  return { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID } as Record<string, string>;
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action');
  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  const relay = async (r: Response) => {
    const text = await r.text();
    res.statusCode = r.status;
    res.end(text || '{}');
  };

  try {
    if (action === 'code') {
      return relay(await fetch(`${BASE}/oauth/device/code`, { method: 'POST', headers: hdr(), body: JSON.stringify({ client_id: CLIENT_ID }) }));
    }
    if (action === 'token') {
      if (!CLIENT_SECRET) {
        res.statusCode = 501;
        res.end(JSON.stringify({ error: 'not_configured', error_description: 'Trakt is not set up on this deployment — add TRAKT_CLIENT_SECRET in the Vercel project env vars.' }));
        return;
      }
      return relay(await fetch(`${BASE}/oauth/device/token`, { method: 'POST', headers: hdr(), body: JSON.stringify({ code: body.code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }) }));
    }
    if (action === 'profile') {
      const token = url.searchParams.get('token') || body.token;
      return relay(await fetch(`${BASE}/users/me`, { headers: { ...hdr(), Authorization: `Bearer ${token}` } }));
    }
    res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown_action' }));
  } catch (e: any) {
    res.statusCode = 502; res.end(JSON.stringify({ error: 'proxy_error', message: String(e?.message || e) }));
  }
}
