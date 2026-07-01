// Trakt.tv API v2 — OAuth Device Flow (no redirect URI needed)
//
// Trakt is the shared layer that lets watch progress cross between SHIFT and
// any other Trakt-connected player (e.g. UHF) — apps don't talk to each
// other directly, they both read/write the same Trakt account, via the
// scrobble (start/pause/stop) and sync/playback endpoints below.
import type { Title } from '../types';

const BASE = 'https://api.trakt.tv';
// Client ID for the registered Trakt application (public — safe to ship in
// client code). Its paired secret lives server-side only, as TRAKT_CLIENT_SECRET.
const CLIENT_ID = '3bd42437342c81c44b76f43553637df357251e3ee3669080e6fcb8fec6093cf0';

function authHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'trakt-api-version': '2',
    'trakt-api-key': CLIENT_ID,
  };
}

// Trakt scrobbling needs a different payload shape for a movie vs a TV
// episode — sending everything as `movie` (the old behavior) silently
// fails to scrobble actual episodes, since Trakt has no movie by that name.
function traktItemPayload(item: Title, progress: number) {
  const base: any = { progress, app_version: '1.0.0' };
  if (item.season != null && item.episode != null) {
    base.show = {
      title: item.seriesTitle || item.title,
      ids: item.imdbId ? { imdb: item.imdbId } : undefined,
    };
    base.episode = { season: item.season, number: item.episode };
  } else {
    base.movie = {
      title: item.title,
      year: item.year,
      ids: item.imdbId ? { imdb: item.imdbId } : undefined,
    };
  }
  return base;
}

// On the deployed site, the connect flow goes through our server (which holds the
// secret). On localhost there's no serverless function, so we hit Trakt directly.
function isLocal(): boolean {
  if (typeof location === 'undefined') return true;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

export interface TraktDeviceCode {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface TraktTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function traktGetDeviceCode(): Promise<TraktDeviceCode> {
  const res = await fetch(`${BASE}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  if (!res.ok) throw new Error(`Failed to get device code (${res.status}) — the app's Trakt Client ID may be invalid`);
  return res.json();
}

export async function traktPollToken(deviceCode: string): Promise<TraktTokens | null> {
  // Routed through our own serverless function — the token exchange needs
  // client_secret, which can't safely live in client-side code.
  const res = await fetch('/api/trakt-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode, client_id: CLIENT_ID }),
  });
  if (res.status === 400) return null; // still pending — keep polling
  if (res.status === 200) return res.json();
  // Surface the real reason (e.g. our server missing TRAKT_CLIENT_SECRET)
  // instead of a bare status code — this is what actually fails silently.
  let detail = '';
  try { detail = (await res.json())?.error || ''; } catch {}
  throw new Error(detail || `Token exchange failed (${res.status})`);
}

export async function traktGetProfile(accessToken: string): Promise<{ username: string; name: string }> {
  // Direct to Trakt — reads with a bearer token need no client_secret.
  const res = await fetch(`${BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  return { username: data.username, name: data.name };
}

// Call once when playback begins (or resumes after a pause) — NOT on a
// periodic timer. Trakt treats repeated /start calls as "still watching"
// pings, but /pause + /stop are what other apps (UHF included) read to know
// where you left off.
export async function traktScrobbleStart(accessToken: string, item: Title, progress: number): Promise<void> {
  await fetch(`${BASE}/scrobble/start`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(traktItemPayload(item, progress)),
  }).catch(() => {});
}

export async function traktScrobblePause(accessToken: string, item: Title, progress: number): Promise<void> {
  await fetch(`${BASE}/scrobble/pause`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(traktItemPayload(item, progress)),
  }).catch(() => {});
}

// Stop also marks watched once progress crosses Trakt's own threshold (~80%).
export async function traktScrobbleStop(accessToken: string, item: Title, progress: number): Promise<void> {
  await fetch(`${BASE}/scrobble/stop`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(traktItemPayload(item, progress)),
  }).catch(() => {});
}

export interface TraktPlaybackItem {
  progress: number;       // 0–100
  pausedAt: string;
  type: 'movie' | 'episode';
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  imdbId?: string;
}

/** Every in-progress (paused) item on this Trakt account — including ones
 *  paused from a different app, like UHF. This is the actual cross-app sync. */
export async function traktGetPlaybackProgress(accessToken: string): Promise<TraktPlaybackItem[]> {
  try {
    const res = await fetch(`${BASE}/sync/playback`, { headers: authHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).map((d): TraktPlaybackItem | null => {
      if (d.type === 'episode' && d.show && d.episode) {
        return {
          progress: d.progress, pausedAt: d.paused_at, type: 'episode',
          title: d.show.title, year: d.show.year,
          season: d.episode.season, episode: d.episode.number,
          imdbId: d.show.ids?.imdb,
        };
      }
      if (d.type === 'movie' && d.movie) {
        return {
          progress: d.progress, pausedAt: d.paused_at, type: 'movie',
          title: d.movie.title, year: d.movie.year, imdbId: d.movie.ids?.imdb,
        };
      }
      return null;
    }).filter(Boolean) as TraktPlaybackItem[];
  } catch {
    return [];
  }
}

export async function traktMarkWatched(
  accessToken: string,
  title: string,
  year: number
): Promise<void> {
  await fetch(`${BASE}/sync/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
    },
    body: JSON.stringify({
      movies: [{ title, year, watched_at: new Date().toISOString() }],
    }),
  });
}

export async function traktGetWatchedMovies(accessToken: string): Promise<Set<string>> {
  const res = await fetch(`${BASE}/sync/watched/movies`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
    },
  });
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set((data as any[]).map((m: any) => m.movie?.title?.toLowerCase()));
}

/** Fetch audience rating (0–100%) for a movie or show by title. No auth required. */
export async function traktFetchRating(type: 'movie' | 'show', title: string, year?: number): Promise<number | null> {
  try {
    const q = encodeURIComponent(title);
    const yearParam = year ? `&years=${year}` : '';
    const res = await fetch(`${BASE}/search/${type}?query=${q}${yearParam}&limit=1`, {
      headers: { 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || !results.length) return null;
    const found = results[0][type];
    const traktId = found?.ids?.trakt;
    if (!traktId) return null;

    const rRes = await fetch(`${BASE}/${type}s/${traktId}/ratings`, {
      headers: { 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID },
    });
    if (!rRes.ok) return null;
    const rData = await rRes.json();
    return rData.rating ? Math.round(rData.rating * 10) : null;  // 1–10 → 10–100
  } catch {
    return null;
  }
}
