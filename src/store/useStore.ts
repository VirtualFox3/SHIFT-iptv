import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Provider, Channel, Title, Settings } from '../types';
import { DEMO_CHANNELS, DEMO_TITLES } from '../data';
import { fetchM3U } from '../api/m3u';
import { xtreamGetLive, xtreamGetVOD, xtreamGetSeries } from '../api/xtream';
import { accountKeyFor, pullProgress, schedulePush, flushProgress } from '../api/sync';
import { traktGetPlaybackProgress, type TraktPlaybackItem } from '../api/trakt';

interface AppStore {
  // Auth
  provider: Provider | null;
  setProvider: (p: Provider | null) => void;

  // Saved providers (persisted across app updates)
  savedProviders: Provider[];
  saveProvider: (p: Provider) => void;
  removeSavedProvider: (id: string) => void;

  // Reconnect a real (xtream/m3u) provider — re-fetches content
  reconnecting: boolean;
  loadFailed: boolean;
  reconnectProvider: (p: Provider) => Promise<void>;

  // Content
  channels: Channel[];
  titles: Title[];
  setChannels: (c: Channel[]) => void;
  setTitles: (t: Title[]) => void;

  // My List
  myList: string[];
  toggleMyList: (id: string) => void;

  // Continue watching — synced across devices logged into the same provider
  continueWatching: Record<string, number>;
  watchedAt: Record<string, number>;  // title id → last-watched timestamp (ms)
  accountKey: string | null;
  syncAccount: (p: Provider) => Promise<void>;
  setProgress: (id: string, pct: number) => void;
  flushProgressNow: (id: string) => void;
  clearHistory: () => void;

  // Trakt cross-app sync (e.g. with UHF) — both apps scrobble to the same
  // Trakt account, so this pulls back whatever the OTHER app left paused.
  traktPlaybackCache: TraktPlaybackItem[] | null;
  mergeTraktProgress: (item: Title) => Promise<void>;

  // Settings
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  // UI state (not persisted)
  tab: string;
  setTab: (t: string) => void;
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchOpen: boolean;
  setSearchOpen: (o: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  autoplayNext: true,
  autoplayPreviews: true,
  skipIntros: true,
  quality: 'Auto',
  dataSaver: false,
  subLang: 'English',
  audioLang: 'English',
  subSize: 'Medium',
  subEnabled: false,
  maturity: 'All maturity',
  notifNew: true,
  notifReminders: true,
  notifRecs: false,
  notifEmail: true,
  bbStyle: 'Spotlight',
  accentColor: '#E50914',
  cardRadius: 4,
  theme: 'dark',
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      provider: null,
      setProvider: (p) => {
        if (!p) { set({ provider: null, channels: [], titles: [], accountKey: null, traktPlaybackCache: null }); return; }
        // Demo providers load the built-in catalogue.
        if (p.type === 'demo') {
          set({ provider: p, channels: DEMO_CHANNELS, titles: DEMO_TITLES });
        } else {
          // Real providers: keep whatever content was just fetched by the caller.
          set({ provider: p });
        }
        // Remember it.
        get().saveProvider(p);
        get().syncAccount(p);
      },

      savedProviders: [],
      saveProvider: (p) => set((s) => {
        const exists = s.savedProviders.some((x) => x.id === p.id);
        return { savedProviders: exists ? s.savedProviders.map((x) => x.id === p.id ? p : x) : [...s.savedProviders, p] };
      }),
      removeSavedProvider: (id) => set((s) => ({ savedProviders: s.savedProviders.filter((x) => x.id !== id) })),

      reconnecting: false,
      loadFailed: false,
      reconnectProvider: async (p) => {
        if (p.type === 'demo') { get().setProvider(p); return; }
        // Keep the user logged in immediately — set the provider before fetching
        // so a slow/failed re-fetch never bounces them back to the login screen.
        set({ reconnecting: true, loadFailed: false, provider: p });
        get().saveProvider(p);
        get().syncAccount(p);
        // Retry a few times: the provider's single connection is often briefly
        // busy (open on another device), so a transient failure shouldn't strand
        // the user on an empty screen needing a manual page refresh.
        const attempt = async () => {
          if (p.type === 'm3u' && p.m3uUrl) {
            const channels = await fetchM3U(p.m3uUrl);
            set({ channels, titles: [] });
          } else if (p.type === 'manifest' && p.manifestUrl) {
            set({ channels: [{ id: 'manifest_ch_1', num: 1, name: p.name, logo: p.letter || '?', cat: 'Live', grad: ['#1a1a2e', '#16213e'] as [string, string], now: 'Live', next: '', prog: 0, rating: 'HD', viewers: '—', desc: '', streamUrl: p.manifestUrl, logoUrl: '' }], titles: [] });
          } else if (p.type === 'xtream' && p.serverUrl && p.username) {
            const auth = { serverUrl: p.serverUrl, username: p.username, password: p.password || '' };
            const [channels, vod, series] = await Promise.all([
              xtreamGetLive(auth), xtreamGetVOD(auth), xtreamGetSeries(auth),
            ]);
            set({ channels, titles: [...vod, ...series] });
          }
        };
        let ok = false;
        for (let i = 0; i < 3 && !ok; i++) {
          try {
            if (i > 0) await new Promise((r) => setTimeout(r, 1500 * i));
            await attempt();
            ok = get().channels.length > 0 || get().titles.length > 0;
          } catch { /* try again */ }
        }
        set({ reconnecting: false, loadFailed: !ok });
      },

      channels: [],
      titles: [],
      setChannels: (c) => set({ channels: c }),
      setTitles: (t) => set({ titles: t }),

      myList: [],
      toggleMyList: (id) => set((s) => ({
        myList: s.myList.includes(id) ? s.myList.filter((x) => x !== id) : [...s.myList, id],
      })),

      continueWatching: {},
      watchedAt: {},
      accountKey: null,
      syncAccount: async (p) => {
        const key = await accountKeyFor(p);
        set({ accountKey: key });
        if (!key) return;
        const remote = await pullProgress(key);
        if (!remote.length) return;
        set((s) => {
          const continueWatching = { ...s.continueWatching };
          const watchedAt = { ...s.watchedAt };
          for (const r of remote) {
            // Whichever device touched it more recently wins.
            if (!watchedAt[r.titleId] || r.updatedAt > watchedAt[r.titleId]) {
              continueWatching[r.titleId] = r.pct;
              watchedAt[r.titleId] = r.updatedAt;
            }
          }
          return { continueWatching, watchedAt };
        });
      },
      setProgress: (id, pct) => {
        const now = Date.now();
        set((s) => ({
          continueWatching: { ...s.continueWatching, [id]: pct },
          watchedAt: { ...s.watchedAt, [id]: now },
        }));
        const key = get().accountKey;
        if (key) schedulePush(key, id, pct, now);
      },
      flushProgressNow: (id) => {
        const key = get().accountKey;
        const pct = get().continueWatching[id];
        const at = get().watchedAt[id];
        if (key && pct != null && at) flushProgress(key, id, pct, at);
      },
      clearHistory: () => set({ continueWatching: {}, watchedAt: {} }),

      traktPlaybackCache: null,
      mergeTraktProgress: async (item) => {
        const token = get().settings.traktAccessToken;
        if (!token) return;
        let cache = get().traktPlaybackCache;
        if (!cache) {
          cache = await traktGetPlaybackProgress(token);
          set({ traktPlaybackCache: cache });
        }
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const match = cache.find((p) => {
          if (item.season != null && item.episode != null) {
            if (p.type !== 'episode' || p.season !== item.season || p.episode !== item.episode) return false;
            return (item.imdbId && p.imdbId === item.imdbId) || norm(p.title) === norm(item.seriesTitle || item.title);
          }
          if (p.type !== 'movie') return false;
          return (item.imdbId && p.imdbId === item.imdbId) || (norm(p.title) === norm(item.title) && (!p.year || !item.year || p.year === item.year));
        });
        if (!match) return;
        const at = Date.parse(match.pausedAt) || Date.now();
        const existing = get().continueWatching[item.id] || 0;
        // Only take it if Trakt's record is actually ahead of what we already have.
        if (match.progress > existing) {
          set((s) => ({
            continueWatching: { ...s.continueWatching, [item.id]: Math.round(match.progress) },
            watchedAt: { ...s.watchedAt, [item.id]: at },
          }));
        }
      },

      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      tab: 'home',
      setTab: (t) => set({ tab: t, activeCategory: null }),
      activeCategory: null,
      setActiveCategory: (c) => set({ activeCategory: c }),
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      searchOpen: false,
      setSearchOpen: (o) => set({ searchOpen: o }),
    }),
    {
      name: 'shift-iptv-store',
      version: 2,
      // Persist providers + creds so they survive app updates. Content (channels/titles)
      // is NOT persisted (can be huge) — real providers re-fetch via reconnectProvider.
      partialize: (s) => ({
        provider: s.provider,
        savedProviders: s.savedProviders,
        myList: s.myList,
        continueWatching: s.continueWatching,
        watchedAt: s.watchedAt,
        settings: s.settings,
      }),
    }
  )
);
