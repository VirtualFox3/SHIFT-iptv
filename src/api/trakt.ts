// Trakt.tv API v2 — OAuth Device Flow (no redirect URI needed)
const BASE = 'https://api.trakt.tv';
// Public client ID for device auth — works without a backend
const CLIENT_ID = 'b4f7ed8323521f2e0f3b8e53e85bd1dc0de58a62ac7d9ad4a2e82d0e88591cf0';

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
  if (!res.ok) throw new Error('Failed to get device code');
  return res.json();
}

export async function traktPollToken(deviceCode: string): Promise<TraktTokens | null> {
  const res = await fetch(`${BASE}/oauth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID },
    body: JSON.stringify({ code: deviceCode, client_id: CLIENT_ID, client_secret: '' }),
  });
  if (res.status === 400) return null; // pending
  if (res.status === 200) return res.json();
  throw new Error('Token poll error: ' + res.status);
}

export async function traktGetProfile(accessToken: string): Promise<{ username: string; name: string }> {
  const res = await fetch(`${BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
    },
  });
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
