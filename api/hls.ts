// Vercel built-in transcoder — playlist endpoint.
//
// Browsers can't decode MKV/HEVC. A single Vercel function can't stream a whole
// 45-min transcode (60s limit), so we expose the title as an HLS playlist whose
// segments are each transcoded on demand by /api/seg in a separate short-lived
// invocation. hls.js (already in the app) stitches them together — and seeking
// works because it's a real indexed VOD playlist.
//
//   GET /api/hls?url=<encoded provider url>  -> application/vnd.apple.mpegurl

import { spawn } from 'child_process';
import ffprobe from 'ffprobe-static';

export const config = { maxDuration: 60 };

const UA = 'VLC/3.0.20 LibVLC/3.0.20';
const SEG = 6; // seconds per segment

function getDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn((ffprobe as any).path, [
      '-v', 'error', '-user_agent', UA,
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', url,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => { const n = parseFloat(out.trim()); resolve(Number.isFinite(n) ? n : 0); });
    p.on('error', () => resolve(0));
    setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve(parseFloat(out.trim()) || 0); }, 9000);
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = (req.query?.url as string) || new URL(req.url, 'http://x').searchParams.get('url') || '';
  if (!url) { res.status(400).send('missing url'); return; }

  const dur = await getDuration(url);
  if (!dur) { res.status(502).send('could not probe stream'); return; }

  const enc = encodeURIComponent(url);
  let m = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n';
  m += `#EXT-X-TARGETDURATION:${SEG}\n#EXT-X-MEDIA-SEQUENCE:0\n`;
  for (let t = 0; t < dur; t += SEG) {
    const d = Math.min(SEG, dur - t);
    m += `#EXTINF:${d.toFixed(3)},\n/api/seg?url=${enc}&start=${t}&dur=${d.toFixed(3)}\n`;
  }
  m += '#EXT-X-ENDLIST\n';

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(m);
}
