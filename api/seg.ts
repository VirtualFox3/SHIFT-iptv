// Vercel built-in transcoder — segment endpoint.
//
// Transcodes just one ~6s slice of the source to H.264/AAC MPEG-TS and streams
// it back. Each call finishes well under the 60s function limit. -copyts keeps
// the source timestamps so hls.js places the segment correctly on the timeline.
//
//   GET /api/seg?url=<encoded>&start=<sec>&dur=<sec>  -> video/mp2t

import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

export const config = { maxDuration: 60 };

const UA = 'VLC/3.0.20 LibVLC/3.0.20';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.query?.url as string;
  const start = parseFloat(req.query?.start) || 0;
  const dur = parseFloat(req.query?.dur) || 6;
  if (!url) { res.status(400).send('missing url'); return; }

  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-user_agent', UA,
    '-ss', String(start),     // fast input seek to the segment start
    '-i', url,
    '-t', String(dur),
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-vf', "scale='min(1280,iw)':-2", '-pix_fmt', 'yuv420p',
    '-force_key_frames', 'expr:gte(t,0)',  // IDR at segment start
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-copyts',                 // keep source timestamps for HLS continuity
    '-f', 'mpegts', 'pipe:1',
  ];

  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'no-store');
  const ff = spawn(ffmpegPath as unknown as string, args);
  ff.stdout.pipe(res);
  ff.stderr.on('data', (d) => process.stderr.write(d));
  const kill = () => { try { ff.kill('SIGKILL'); } catch {} };
  req.on('close', kill);
  res.on('close', kill);
  ff.on('error', () => { try { res.end(); } catch {} });
  ff.on('close', () => { try { res.end(); } catch {} });
}
