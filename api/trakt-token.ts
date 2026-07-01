// Exchanges a Trakt device code for an access token, server-side.
// Trakt's /oauth/device/token endpoint requires client_secret, which must
// never ship in the client bundle — anyone could read it out of the JS.
// TRAKT_CLIENT_SECRET is set as a Vercel project environment variable.

export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }

  const secret = process.env.TRAKT_CLIENT_SECRET;
  if (!secret) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'TRAKT_CLIENT_SECRET is not configured on the server' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  let payload: any;
  try { payload = JSON.parse(body); } catch { res.statusCode = 400; res.end('Bad JSON'); return; }

  const { device_code, client_id } = payload || {};
  if (!device_code || !client_id) { res.statusCode = 400; res.end('Missing device_code/client_id'); return; }

  const r = await fetch('https://api.trakt.tv/oauth/device/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: device_code, client_id, client_secret: secret }),
  });

  res.statusCode = r.status;
  res.setHeader('content-type', 'application/json');
  res.end(await r.text());
}
