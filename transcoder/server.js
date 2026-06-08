// SHIFT transcoder — converts MKV/HEVC IPTV streams to browser-playable H.264/AAC
// on the fly using FFmpeg, so they play right inside the web app (the same trick
// Jellyfin/Plex use). Output is a fragmented MP4 streamed over a single response.
//
//   GET /stream?url=<encoded provider url>   -> video/mp4 (fragmented, progressive)
//   GET /health                               -> "ok"
//
// Deploy this folder to any host that allows FFmpeg + long-running responses
// (Railway, Render, Fly, a VPS). See README.md.

const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8080;
// IPTV panels block browser User-Agents — ask as a player so the fetch succeeds.
const UA = 'VLC/3.0.20 LibVLC/3.0.20';

app.get('/health', (_req, res) => res.send('ok'));

// Probe the source's video codec so we can COPY h264 (cheap remux) and only
// transcode when it's something the browser can't play (HEVC/AV1/etc).
function probeVideoCodec(url) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-user_agent', UA,
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=nw=1:nk=1', url,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => resolve(out.trim().toLowerCase()));
    p.on('error', () => resolve(''));
    setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve(out.trim().toLowerCase()); }, 9000);
  });
}

app.get('/stream', async (req, res) => {
  const url = req.query.url;
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!url || typeof url !== 'string') return res.status(400).send('missing url');

  const vcodec = await probeVideoCodec(url);
  // h264 → just remux (fast, low CPU). Anything else → transcode to h264.
  const videoArgs = vcodec === 'h264'
    ? ['-c:v', 'copy']
    : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
       // Cap at 720p so free-tier CPUs can keep up with realtime.
       '-vf', "scale='min(1280,iw)':-2", '-pix_fmt', 'yuv420p'];

  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-user_agent', UA,
    '-i', url,
    '-map', '0:v:0', '-map', '0:a:0?',
    ...videoArgs,
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    // Fragmented MP4 so it can be streamed before the whole file is processed.
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4', 'pipe:1',
  ];

  res.setHeader('Content-Type', 'video/mp4');
  const ff = spawn('ffmpeg', args);
  ff.stdout.pipe(res);
  ff.stderr.on('data', (d) => process.stderr.write(d));

  const kill = () => { try { ff.kill('SIGKILL'); } catch {} };
  req.on('close', kill);
  res.on('close', kill);
  ff.on('error', (e) => { console.error('ffmpeg error', e); try { res.end(); } catch {} });
  ff.on('close', () => { try { res.end(); } catch {} });
});

app.listen(PORT, () => console.log(`SHIFT transcoder listening on :${PORT}`));
