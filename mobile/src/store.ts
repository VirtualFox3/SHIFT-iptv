import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Provider, Channel, Title, Settings } from './types';
import { fetchXtream } from './api/xtream';
import { fetchM3U } from './api/m3u';

interface AppStore {
  provider: Provider | null;
  savedProviders: Provider[];
  channels: Channel[];
  titles: Title[];
  myList: string[];
  continueWatching: Record<string, number>;
  watchedAt: Record<string, number>;
  settings: Settings;
  loading: boolean;
  loadError: string | null;

  setProvider: (p: Provider | null) => void;
  saveProvider: (p: Provider) => void;
  removeSavedProvider: (id: string) => void;
  loadContent: (p: Provider) => Promise<void>;
  toggleMyList: (id: string) => void;
  setProgress: (id: string, pct: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  accentColor: '#E50914',
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      provider: null,
      savedProviders: [],
      channels: [],
      titles: [],
      myList: [],
      continueWatching: {},
      watchedAt: {},
      settings: DEFAULT_SETTINGS,
      loading: false,
      loadError: null,

      setProvider: (p) => {
        if (!p) { set({ provider: null, channels: [], titles: [] }); return; }
        set({ provider: p });
        get().saveProvider(p);
        get().loadContent(p);
      },

      saveProvider: (p) => set((s) => {
        const exists = s.savedProviders.some((x) => x.id === p.id);
        return {
          savedProviders: exists
            ? s.savedProviders.map((x) => x.id === p.id ? p : x)
            : [...s.savedProviders, p],
        };
      }),

      removeSavedProvider: (id) => set((s) => ({
        savedProviders: s.savedProviders.filter((x) => x.id !== id),
      })),

      loadContent: async (p) => {
        set({ loading: true, loadError: null });
        try {
          if (p.type === 'm3u' && p.m3uUrl) {
            const channels = await fetchM3U(p.m3uUrl);
            set({ channels, titles: [] });
          } else if (p.type === 'xtream' && p.serverUrl && p.username) {
            const result = await fetchXtream({
              serverUrl: p.serverUrl,
              username: p.username,
              password: p.password || '',
            });
            set({ channels: result.channels, titles: result.titles });
          }
        } catch (e: any) {
          set({ loadError: e?.message || 'Failed to load content' });
        } finally {
          set({ loading: false });
        }
      },

      toggleMyList: (id) => set((s) => ({
        myList: s.myList.includes(id)
          ? s.myList.filter((x) => x !== id)
          : [...s.myList, id],
      })),

      setProgress: (id, pct) => set((s) => ({
        continueWatching: { ...s.continueWatching, [id]: pct },
        watchedAt: { ...s.watchedAt, [id]: Date.now() },
      })),

      updateSettings: (patch) => set((s) => ({
        settings: { ...s.settings, ...patch },
      })),
    }),
    {
      name: 'shift-iptv-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
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
