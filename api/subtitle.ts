// Server-side OpenSubtitles download + fetch.
// Avoids CORS issues: the POST to OS API and the CDN subtitle fetch both
// happen here in Node, then the text is returned to the browser.

export const config = { runtime: 'nodejs', maxDuration: 15 };

const OS_BASE = 'https://api.opensubtitles.com/api/v1';
const DEFAULT_KEY = 'wknZPX5xh3zJzEJCunGExMHTZf2apu5H';

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const host = req.headers['host'];
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const reqUrl = new URL(req.url, `${proto}://${host}`);
  const fileId = reqUrl.searchParams.get('fileId');
  const token = reqUrl.searchParams.get('token') || undefined;

  if (!fileId || isNaN(Number(fileId))) {
    res.statusCode = 400; res.end('Missing fileId'); return;
  }

  const osHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': DEFAULT_KEY,
    'User-Agent': 'SHIFT-IPTV v1.0.0',
  };
  if (token) osHeaders['Authorization'] = `Bearer ${token}`;

  // Step 1: get download link from OS
  const dlRes = await fetch(`${OS_BASE}/download`, {
    method: 'POST',
    headers: osHeaders,
    body: JSON.stringify({ file_id: Number(fileId) }),
  });

  if (!dlRes.ok) {
    const body = await dlRes.text().catch(() => '');
    res.statusCode = 502;
    res.end(`OS API ${dlRes.status}: ${body}`);
    return;
  }
  const dlData = await dlRes.json();
  const link: string = dlData.link;
  if (!link) { res.statusCode = 502; res.end('No download link in OS response'); return; }

  // Step 2: fetch the actual subtitle file
  const subRes = await fetch(link);
  if (!subRes.ok) { res.statusCode = 502; res.end(`Subtitle CDN ${subRes.status}`); return; }
  const text = await subRes.text();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.statusCode = 200;
  res.end(text);
}
