// OpenSubtitles.com REST API v1 — works anonymously with Api-Key: free
// No user sign-in required. 10 downloads/day on free anonymous quota.

const BASE = 'https://api.opensubtitles.com/api/v1';
const APP_UA = 'SHIFT-IPTV v1.0.0';

// OpenSubtitles.com requires a registered consumer API key. Like UHF, the user
// signs in with their OpenSubtitles account; they also supply a free API key
// (register a consumer at opensubtitles.com → API). Defaults to 'free' which
// only works for limited anonymous calls — the keyless Wyzie/strem sources in
// subtitles.ts cover the no-key case.
// Registered consumer API key (like UHF ships its own) — subtitles work out of
// the box, no key entry needed. Users can still sign in for their own quota.
const DEFAULT_API_KEY = 'wknZPX5xh3zJzEJCunGExMHTZf2apu5H';
let API_KEY = DEFAULT_API_KEY;
export function setOsApiKey(key?: string) { API_KEY = key && key.trim() ? key.trim() : DEFAULT_API_KEY; }

export interface OSSubtitle {
  id: string;
  language: string;
  languageCode: string;
  fileName: string;
  downloadCount: number;
  fileId: number;
  fps?: number;
  uploader?: string;
  hearingImpaired: boolean;
  machineTranslated: boolean;
}

/** Optional: sign in for a larger download quota (anonymous still works without this) */
export async function osLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': API_KEY, 'User-Agent': APP_UA },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed — check your credentials');
  const data = await res.json();
  return data.token as string;
}

export async function osLogout(token: string): Promise<void> {
  await fetch(`${BASE}/logout`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Api-Key': API_KEY, 'User-Agent': APP_UA },
  }).catch(() => {});
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': API_KEY,
    'User-Agent': APP_UA,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Search subtitles — no sign-in needed, works anonymously */
export async function searchSubtitles(
  query: string,
  lang = 'en',
  imdbId?: string,
  tmdbId?: number,
  token?: string         // optional — if user is signed in, uses their quota
): Promise<OSSubtitle[]> {
  const params = new URLSearchParams({ languages: lang });
  if (query) params.set('query', query);
  if (imdbId) params.set('imdb_id', imdbId.replace('tt', ''));
  if (tmdbId) params.set('tmdb_id', String(tmdbId));

  try {
    const res = await fetch(`${BASE}/subtitles?${params}`, { headers: headers(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, 20).map((item: any) => ({
      id: item.id,
      language: item.attributes?.language || lang,
      languageCode: item.attributes?.language || lang,
      fileName: item.attributes?.files?.[0]?.file_name || 'subtitle.srt',
      downloadCount: item.attributes?.download_count || 0,
      fileId: item.attributes?.files?.[0]?.file_id || 0,
      fps: item.attributes?.fps,
      uploader: item.attributes?.uploader?.name,
      hearingImpaired: !!item.attributes?.hearing_impaired,
      machineTranslated: !!item.attributes?.machine_translated,
    }));
  } catch {
    return [];
  }
}

/** Get a download link — works anonymously (free quota: 10/day, resets daily) */
export async function getSubtitleDownloadUrl(
  fileId: number,
  token?: string
): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/download`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.link as string || null;
  } catch {
    return null;
  }
}

/** Parse SRT text into cue objects */
export interface SubCue { start: number; end: number; text: string; }

export function parseSRT(text: string): SubCue[] {
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  const cues: SubCue[] = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).join('\n').replace(/<[^>]+>/g, '');
    if (!textLines.trim()) continue;
    cues.push({ start: srtTime(startStr), end: srtTime(endStr), text: textLines });
  }
  return cues;
}

function srtTime(s: string): number {
  const [h, m, rest] = s.split(':');
  const [sec, ms] = rest.replace(',', '.').split('.');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + (parseInt(ms) || 0) / 1000;
}

export function langCodeToName(code: string): string {
  const map: Record<string, string> = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
    it: 'Italiano', pt: 'Português', ru: 'Russian', ja: 'Japanese',
    ko: 'Korean', zh: 'Chinese', ar: 'Arabic', nl: 'Dutch', tr: 'Turkish',
  };
  return map[code] || code.toUpperCase();
}
