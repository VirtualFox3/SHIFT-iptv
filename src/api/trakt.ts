// Trakt.tv API v2 — OAuth Device Flow.
const BASE = 'https://api.trakt.tv';
// Public client ID for public reads (search/ratings/scrobble). The device-flow
// TOKEN exchange needs a client_secret and MUST go server-side — see api/trakt.ts.
const CLIENT_ID = 'b4f7ed8323521f2e0f3b8e53e85bd1dc0de58a62ac7d9ad4a2e82d0e88591cf0';

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
  const res = isLocal()
    ? await fetch(`${BASE}/oauth/device/code`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID }, body: JSON.stringify({ client_id: CLIENT_ID }) })
    : await fetch(`/api/trakt?action=code`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to get device code');
  return res.json();
}

export async function traktPollToken(deviceCode: string): Promise<TraktTokens | null> {
  const res = await fetch(`/api/trakt?action=token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: deviceCode }),
  });
  if (res.status === 400) return null; // still pending — keep polling
  if (res.status === 200) return res.json();
  if (res.status === 501) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error_description || 'Trakt is not set up on this deployment.');
  }
  throw new Error('Token poll error: ' + res.status);
}

export async function traktGetProfile(accessToken: string): Promise<{ username: string; name: string }> {
  const res = isLocal()
    ? await fetch(`${BASE}/users/me`, { headers: { Authorization: `Bearer ${accessToken}`, 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID } })
    : await fetch(`/api/trakt?action=profile&token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  return { username: data.username, name: data.name };
}

export async function traktScrobbleStart(
  accessToken: string,
  title: string,
  year: number,
  progress: number
): Promise<void> {
  await fetch(`${BASE}/scrobble/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
    },
    body: JSON.stringify({
      movie: { title, year },
      progress,
      app_version: '1.0.0',
    }),
  });
}

export async function traktScrobbleStop(
  accessToken: string,
  title: string,
  year: number,
  progress: number
): Promise<void> {
  await fetch(`${BASE}/scrobble/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
    },
    body: JSON.stringify({
      movie: { title, year },
      progress,
      app_version: '1.0.0',
    }),
  });
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
