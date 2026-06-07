import type { Channel } from '../types';
import { proxify } from './proxy';

// Parses M3U/M3U8 playlists (IPTV format with #EXTINF attributes)
export function parseM3U(text: string): Channel[] {
  const lines = text.split('\n').map((l) => l.trim());
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF')) continue;

    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith('#')) continue;

    const name = line.replace(/^#EXTINF:[^,]*,/, '').trim() || 'Unknown';
    const tvgName = extractAttr(line, 'tvg-name') || name;
    const groupTitle = extractAttr(line, 'group-title') || 'General';
    const tvgLogo = extractAttr(line, 'tvg-logo') || '';
    const tvgId = extractAttr(line, 'tvg-id') || '';

    channels.push({
      id: slugify(tvgId || name) + '_' + i,
      num: channels.length + 1,
      name: tvgName,
      logo: tvgName.slice(0, 2).toUpperCase(),
      cat: groupTitle,
      grad: gradientForCat(groupTitle),
      now: 'Live',
      next: '',
      prog: 0,
      rating: 'TV-G',
      viewers: '—',
      desc: `${groupTitle} · ${tvgName}`,
      streamUrl: proxify(urlLine),
      logoUrl: tvgLogo,
      epgId: tvgId,
    });
  }

  return channels;
}

function extractAttr(line: string, attr: string): string {
  const match = line.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function gradientForCat(cat: string): [string, string] {
  const c = cat.toLowerCase();
  if (c.includes('sport')) return ['#06301d', '#0b6248'];
  if (c.includes('news')) return ['#0b1f3a', '#1f4e88'];
  if (c.includes('movie') || c.includes('film') || c.includes('cine')) return ['#1a1140', '#4d2c8b'];
  if (c.includes('music')) return ['#3d0d3a', '#c2369d'];
  if (c.includes('kid') || c.includes('child')) return ['#0b3a4a', '#2bb3c9'];
  if (c.includes('comedy')) return ['#3a2a06', '#caa01f'];
  if (c.includes('doc')) return ['#06321f', '#198a4f'];
  if (c.includes('drama')) return ['#2a0810', '#7c1530'];
  if (c.includes('action')) return ['#311006', '#8a3410'];
  if (c.includes('reality')) return ['#0a2436', '#1f5a78'];
  return ['#1a1a1a', '#3a3a3a'];
}

export async function fetchM3U(url: string): Promise<Channel[]> {
  const res = await fetch(proxify(url));
  if (!res.ok) throw new Error(`Failed to fetch M3U: ${res.status}`);
  const text = await res.text();
  return parseM3U(text);
}

// IPTV-org awesome list — well-known free public M3U sources
export const AWESOME_IPTV_SOURCES = [
  { label: 'IPTV-org · All channels', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { label: 'IPTV-org · News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { label: 'IPTV-org · Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { label: 'IPTV-org · Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { label: 'IPTV-org · Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { label: 'IPTV-org · Kids', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
  { label: 'IPTV-org · Documentary', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
];
