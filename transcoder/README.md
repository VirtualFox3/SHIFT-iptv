# SHIFT Transcoder

A tiny FFmpeg server that converts MKV / HEVC IPTV streams into browser-playable
H.264/AAC **on the fly** — so those titles play right inside the SHIFT web app
instead of falling back to VLC. This is the same approach Jellyfin and Plex use.

- H.264-in-MKV → **remuxed** (fast, almost no CPU)
- HEVC / other codecs → **transcoded** to H.264, capped at 720p so free hosts keep up
- Output is a fragmented MP4 streamed over one HTTP response (`/stream?url=...`)

## Deploy to Railway (free, ~3 minutes)

1. Go to **https://railway.app** and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo** and pick this repo.
3. Railway detects the `Dockerfile` in `transcoder/`. If it builds from the repo
   root, set the **Root Directory** to `transcoder` in the service **Settings**.
4. Once it's deployed, open **Settings → Networking → Generate Domain**. Copy the
   URL it gives you (e.g. `https://shift-transcoder-production.up.railway.app`).
5. In the SHIFT app go to **Settings → Integrations → Transcoder URL** and paste it.

That's it — MKV/HEVC titles now play in the browser. Verify the server is up by
visiting `https://<your-url>/health` (should say `ok`).

## Deploy anywhere else

Any host that allows FFmpeg and long-lived HTTP responses works (Render, Fly.io,
a VPS). Build the Docker image and run it; the app just needs the public base URL.

```bash
docker build -t shift-transcoder .
docker run -p 8080:8080 shift-transcoder
# then use http://localhost:8080 as the Transcoder URL (local testing only)
```

## Notes

- **Seeking** on transcoded titles is limited (it's a live transcode). Remuxed
  H.264 titles seek fine.
- Free tiers have limited CPU; 1080p HEVC may buffer. The 720p cap helps. If you
  need full quality + smooth seeking, run it on a box with more CPU.
- The server forwards a VLC User-Agent because IPTV panels block browser UAs.
