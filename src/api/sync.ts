// Cross-device "Continue Watching" sync.
// Lets the same provider account pick up an episode on one device exactly
// where another device left off — no real user accounts, just a stable hash
// of the provider's own credentials as the sync key (same trust model as the
// credentials themselves, which the app already stores client-side).

import type { Provider } from '../types';

const SUPABASE_URL = 'https://kifprauamrclbkugvfts.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4J1bkirW7Vcq2vj36NDHDg_gZOFADft';
const REST = `${SUPABASE_URL}/rest/v1/watch_progress`;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

/** Stable per-provider identity, derived client-side — never sent to the provider itself. */
export async function accountKeyFor(p: Provider | null): Promise<string | null> {
  if (!p) return null;
  let seed = '';
  if (p.type === 'xtream' && p.serverUrl && p.username) seed = `xt:${p.serverUrl}:${p.username}`;
  else if (p.type === 'm3u' && p.m3uUrl) seed = `m3u:${p.m3uUrl}`;
  else if (p.type === 'manifest' && p.manifestUrl) seed = `mf:${p.manifestUrl}`;
  else if (p.type === 'jellyfin' && p.jellyfinUrl) seed = `jf:${p.jellyfinUrl}:${p.jellyfinApiKey || ''}`;
  else return null; // demo / unknown — nothing real to key sync off of

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface RemoteProgress { titleId: string; pct: number; updatedAt: number; }

/** Pull every progress row for this account (called once on login/reconnect). */
export async function pullProgress(accountKey: string): Promise<RemoteProgress[]> {
  try {
    const res = await fetch(`${REST}?account_key=eq.${accountKey}&select=title_id,pct,updated_at`, { headers });
    if (!res.ok) return [];
    const rows: { title_id: string; pct: number; updated_at: number }[] = await res.json();
    return rows.map((r) => ({ titleId: r.title_id, pct: r.pct, updatedAt: r.updated_at }));
  } catch {
    return [];
  }
}

// Throttle pushes per title — `timeupdate` fires several times a second, but
// nobody needs sub-10-second sync resolution for "resume where you left off".
const lastPush = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const THROTTLE_MS = 8000;

export function schedulePush(accountKey: string, titleId: string, pct: number, updatedAt: number) {
  const key = `${accountKey}:${titleId}`;
  const since = Date.now() - (lastPush.get(key) || 0);
  if (since >= THROTTLE_MS) {
    lastPush.set(key, Date.now());
    pushProgress(accountKey, titleId, pct, updatedAt);
    return;
  }
  if (pending.has(key)) return; // a trailing push is already queued
  const t = setTimeout(() => {
    pending.delete(key);
    lastPush.set(key, Date.now());
    pushProgress(accountKey, titleId, pct, updatedAt);
  }, THROTTLE_MS - since);
  pending.set(key, t);
}

/** Immediate, unthrottled push — use on pause/close so the last position always lands. */
export function flushProgress(accountKey: string, titleId: string, pct: number, updatedAt: number) {
  const key = `${accountKey}:${titleId}`;
  const t = pending.get(key);
  if (t) { clearTimeout(t); pending.delete(key); }
  lastPush.set(key, Date.now());
  pushProgress(accountKey, titleId, pct, updatedAt);
}

function pushProgress(accountKey: string, titleId: string, pct: number, updatedAt: number) {
  try {
    fetch(REST, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ account_key: accountKey, title_id: titleId, pct, updated_at: updatedAt }),
      keepalive: true, // let the request survive a tab close / navigation
    }).catch(() => {});
  } catch {}
}
