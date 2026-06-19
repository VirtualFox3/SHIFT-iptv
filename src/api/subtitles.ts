// Unified subtitle search.
// Primary: Wyzie Subs (https://sub.wyzie.ru) — keyless, CORS-enabled, returns
// direct .srt/.vtt URLs by TMDB/IMDB id. Widely used by open-source web players.
// Falls back to OpenSubtitles.com query search when the user is signed in.

import type { Title } from '../types';
import { searchSubtitles as osSearch, getSubtitleDownloadUrl, parseSRT, type SubCue } from './opensubtitles';

export interface SubResult {
  id: string;
  label: string;
  language: string;
  url?: string;        // Wyzie: direct file URL
  fileId?: number;     // OpenSubtitles: download via API
}

const WYZIE = 'https://sub.wyzie.ru';
const OS_V3 = 'https://opensubtitles-v3.strem.io';

/** Search Wyzie by tmdb or imdb id. */
async function wyzieSearch(id: string, lang: string): Promise<SubResult[]> {
  try {
    const res = await fetch(`${WYZIE}/search?id=${encodeURIComponent(id)}&language=${lang}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, 20).map((s: any, i: number) => ({
      id: 'wyzie_' + (s.id || i),
      label: `${(s.display || s.language || lang).toString()}${s.isHearingImpaired ? ' [HI]' : ''}`,
      language: s.language || lang,
      url: s.url,
    }));
  } catch {
    return [];
  }
}

/** Keyless strem.io OpenSubtitles v3 addon — search by imdb id (movie). */
async function stremSearch(imdbId: string, lang: string): Promise<SubResult[]> {
  if (!/^tt\d+/.test(imdbId)) return [];
  try {
    const res = await fetch(`${OS_V3}/subtitles/movie/${imdbId}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.subtitles || [])
      .filter((s: any) => !lang || (s.lang || '').toLowerCase().startsWith(lang))
      .slice(0, 20)
      .map((s: any, i: number) => ({
        id: 'strem_' + (s.id || i),
        label: (s.lang || lang).toUpperCase(),
        language: s.lang || lang,
        url: s.url,
      }));
  } catch {
    return [];
  }
}

/** Extract season + episode numbers from a provider title string, e.g. "S05 E06", "S5E6". */
export function extractEpisode(t: string): { season?: number; episode?: number } {
  const m = t.match(/\bS(\d{1,2})\s*E(\d{1,2})\b/i) || t.match(/\bSeason\s*(\d+)\s*Episode\s*(\d+)\b/i);
  if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
  return {};
}

/**
 * Find subtitles for a title.
 * @param resolveTmdbId optional async resolver (e.g. Xtream vod_info) → tmdb/imdb id
 */
export async function findSubtitles(
  title: Title,
  lang = 'en',
  osToken?: string,
  resolveId?: () => Promise<string | undefined>
): Promise<SubResult[]> {
  const { season, episode } = extractEpisode(title.title);

  // 1. Try an id we already have, or resolve one (Xtream vod_info).
  let id = title.imdbId || (title.tmdbId ? String(title.tmdbId) : undefined);
  if (!id && resolveId) {
    try { id = await resolveId(); } catch { /* ignore */ }
  }
  if (id) {
    const wy = await wyzieSearch(id, lang);
    if (wy.length) return wy;
    // strem.io OpenSubtitles v3 (keyless) — needs an imdb id
    if (/^tt\d+/.test(id)) {
      const st = await stremSearch(id, lang);
      if (st.length) return st;
    }
  }
  // 2. OpenSubtitles query search — clean provider junk from title, pass episode params.
  const query = cleanSubtitleQuery(title.title);
  const os = await osSearch(query, lang, title.imdbId, title.tmdbId, osToken, season, episode);
  return os.map((s) => ({
    id: s.id,
    label: s.fileName.replace(/\.[^.]+$/, ''),
    language: s.language,
    fileId: s.fileId,
  }));
}

// Strip language/quality/region tags, episode markers and parentheticals.
export function cleanSubtitleQuery(t: string): string {
  return t
    .replace(/·.*$/, '')                                   // drop "· S7 E6"
    .replace(/\bS\d+\s*E\d+\b/gi, '')                       // SxxExx
    .replace(/^(4K[\s\-|]*)?(EN|ENG|ENGLISH|US|USA|UK|IN|FR|ES|DE|IT|AR|VIP|HD|FHD|UHD|4K)[\s\-|:]+/i, '')
    .replace(/\((?:US|UK|\d{4})\)/gi, '')                   // (US) (2026)
    .replace(/\[[^\]]*\]/g, '')                             // [tags]
    .replace(/\s{2,}/g, ' ')
    .trim() || t;
}

/** Load + parse a subtitle into cues. Handles both Wyzie URLs and OS file ids. */
export async function loadSubtitleCues(sub: SubResult, osToken?: string): Promise<SubCue[]> {
  let text = '';
  if (sub.url) {
    // Proxy through /api/proxy to bypass CDN CORS and fix HTTP mixed-content
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(sub.url)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } else if (sub.fileId) {
    // Server-side endpoint: POSTs to OS API + fetches file — no CORS issues
    const params = new URLSearchParams({ fileId: String(sub.fileId) });
    if (osToken) params.set('token', osToken);
    const res = await fetch(`/api/subtitle?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } else {
    throw new Error('No URL or file ID');
  }
  // WebVTT header strip so the SRT parser handles both formats
  text = text.replace(/^WEBVTT[^\n]*\n/, '').replace(/\r/g, '');
  const cues = parseSRT(text);
  if (!cues.length) throw new Error('Empty subtitle file');
  return cues;
}
