import type { Channel } from '../types';

export async function fetchM3U(url: string): Promise<Channel[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
  });
  if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.status}`);
  const text = await res.text();
  return parseM3U(text);
}

function parseM3U(text: string): Channel[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#EXTINF')) {
      const nameMatch = line.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : 'Channel';
      const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      let streamUrl = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('#')) {
        streamUrl = lines[i];
        i++;
      }
      if (streamUrl) {
        channels.push({
          id: 'm3u_' + channels.length,
          num: channels.length + 1,
          name,
          cat: groupMatch ? groupMatch[1] : 'General',
          now: 'Live',
          streamUrl,
          logoUrl: tvgLogoMatch ? tvgLogoMatch[1] : '',
        });
      }
    } else {
      i++;
    }
  }
  return channels;
}
