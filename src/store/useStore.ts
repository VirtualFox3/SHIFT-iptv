import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Provider, Channel, Title, Settings } from '../types';
import { DEMO_CHANNELS, DEMO_TITLES } from '../data';
import { fetchM3U } from '../api/m3u';
import { xtreamGetLive, xtreamGetVOD, xtreamGetSeries } from '../api/xtream';

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

  // Continue watching
  continueWatching: Record<string, number>;
  watchedAt: Record<string, number>;  // title id → last-watched timestamp (ms)
  setProgress: (id: string, pct: number) => void;
  clearHistory: () => void;

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
  theme: 'Dark',
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
        if (!p) { set({ provider: null, channels: [], titles: [] }); return; }
        // Demo providers load the built-in catalogue.
        if (p.type === 'demo') {
          set({ provider: p, channels: DEMO_CHANNELS, titles: DEMO_TITLES });
        } else {
          // Real providers: keep whatever content was just fetched by the caller.
          set({ provider: p });
        }
        // Remember it.
        get().saveProvider(p);
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
      setProgress: (id, pct) => set((s) => ({
        continueWatching: { ...s.continueWatching, [id]: pct },
        watchedAt: { ...s.watchedAt, [id]: Date.now() },
      })),
      clearHistory: () => set({ continueWatching: {}, watchedAt: {} }),

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
