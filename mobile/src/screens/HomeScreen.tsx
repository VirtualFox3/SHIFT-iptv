import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Rail from '../components/Rail';
import TitleCard from '../components/TitleCard';
import ChannelCard from '../components/ChannelCard';
import Billboard from '../components/Billboard';
import Shifty from '../components/Shifty';
import { useResponsive } from '../useResponsive';
import type { Title, Channel } from '../types';

type Tab = 'home' | 'movies' | 'series' | 'live' | 'mylist';

function isMovie(t: Title) {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film';
}

// Flagship titles pinned to the front of the billboard, matching the web app.
const FEATURED = ['dexter', 'supernatural', 'breaking bad', 'the boys', 'stranger things', 'the last of us', 'five nights at freddy', 'fnaf'];

interface Props {
  onPlay: (item: Title | Channel) => void;
  onSettings: () => void;
}

export default function HomeScreen({ onPlay, onSettings }: Props) {
  const provider = useStore((s) => s.provider);
  const setProvider = useStore((s) => s.setProvider);
  const channels = useStore((s) => s.channels);
  const titles = useStore((s) => s.titles);
  const myList = useStore((s) => s.myList);
  const continueWatching = useStore((s) => s.continueWatching);
  const watchedAt = useStore((s) => s.watchedAt);
  const loading = useStore((s) => s.loading);
  const accent = useStore((s) => s.settings.accentColor);
  const tmdbApiKey = useStore((s) => s.settings.tmdbApiKey);

  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');
  const r = useResponsive();

  // Shared config for the poster grids (Movies / Series / My List). Columns are
  // computed from the live window width, so iPad shows 5–7 across instead of 3
  // giant cards, and it re-flows on rotation.
  const gridProps = {
    key: `grid-${r.numColumns}`,   // remount when the column count changes (RN requirement)
    numColumns: r.numColumns,
    columnWrapperStyle: r.numColumns > 1 ? { gap: r.gap, marginBottom: r.gap } : undefined,
    contentContainerStyle: { paddingHorizontal: r.gutter, paddingTop: 12, paddingBottom: 40 },
  };

  const titlesById = useMemo(
    () => Object.fromEntries(titles.map((t) => [t.id, t])),
    [titles],
  );

  const movies = useMemo(() => titles.filter(isMovie), [titles]);
  const series = useMemo(() => titles.filter((t) => !isMovie(t)), [titles]);

  // Hero for the home billboard — a pinned flagship if present, else the first
  // title that has artwork (TMDB fills the rest).
  const hero = useMemo(() => {
    const rank = (t: Title) => {
      const i = FEATURED.findIndex((n) => t.title.toLowerCase().includes(n));
      return (i >= 0 ? 1000 - i : 0) + (t.logoUrl ? 10 : 0);
    };
    return [...titles].sort((a, b) => rank(b) - rank(a))[0] || null;
  }, [titles]);

  const continueWatchingRail = useMemo(() => {
    const ids = Object.keys(continueWatching)
      .filter((id) => {
        const p = continueWatching[id];
        return p > 0 && p < 95 && titlesById[id];
      })
      .sort((a, b) => (watchedAt[b] || 0) - (watchedAt[a] || 0))
      .slice(0, 20);
    return ids.map((id) => titlesById[id]).filter(Boolean) as Title[];
  }, [continueWatching, watchedAt, titlesById]);

  const myListTitles = useMemo(
    () => myList.map((id) => titlesById[id]).filter(Boolean) as Title[],
    [myList, titlesById],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { titles: [] as Title[], channels: [] as Channel[] };
    return {
      titles: titles.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 40),
      channels: channels.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20),
    };
  }, [query, titles, channels]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'movies', label: 'Movies' },
    { id: 'series', label: 'Series' },
    { id: 'live', label: 'Live TV' },
    { id: 'mylist', label: 'My List' },
  ];

  if (loading && titles.length === 0 && channels.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <Shifty size={120} mood="loading" />
        <Text style={styles.loadingText}>Loading your content…</Text>
      </View>
    );
  }

  const renderContent = () => {
    // Search
    if (query.trim()) {
      return (
        <ScrollView contentContainerStyle={{ paddingHorizontal: r.gutter, paddingTop: 12, paddingBottom: 40 }}>
          <Text style={[styles.searchHeading, r.isTablet && { fontSize: 22 }]}>
            Results for "{query}"
          </Text>
          {searchResults.titles.length === 0 && searchResults.channels.length === 0 && (
            <Text style={styles.emptyText}>No results found.</Text>
          )}
          {searchResults.channels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Live Channels</Text>
              {searchResults.channels.map((c) => (
                <ChannelCard key={c.id} channel={c} onPress={() => onPlay(c)} />
              ))}
            </View>
          )}
          {searchResults.titles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Movies & Series</Text>
              <View style={styles.grid}>
                {searchResults.titles.map((t) => (
                  <TitleCard key={t.id} title={t} accentColor={accent} onPress={() => onPlay(t)} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      );
    }

    if (tab === 'home') {
      return (
        <ScrollView>
          {hero && (
            <Billboard
              title={hero}
              accentColor={accent}
              tmdbApiKey={tmdbApiKey}
              onPlay={() => onPlay(hero)}
              onInfo={() => onPlay(hero)}
            />
          )}
          {/* No horizontal padding here — Rails bleed edge-to-edge and apply
              their own gutter, so the row can scroll past the screen edge. */}
          <View style={{ paddingTop: hero ? 22 : 12, paddingBottom: 40 }}>
            {continueWatchingRail.length > 0 && (
              <Rail
                title="Continue Watching"
                items={continueWatchingRail}
                progress={continueWatching}
                accentColor={accent}
                onPress={onPlay}
              />
            )}
            {movies.length > 0 && (
              <Rail
                title="Movies"
                items={movies.slice(0, 40)}
                accentColor={accent}
                onPress={onPlay}
              />
            )}
            {series.length > 0 && (
              <Rail
                title="Series & Shows"
                items={series.slice(0, 40)}
                accentColor={accent}
                onPress={onPlay}
              />
            )}
            {channels.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: r.gutter }]}>
                <Text style={[styles.railHeading, { fontSize: r.headingSize }]}>Live Channels</Text>
                {channels.slice(0, 12).map((c) => (
                  <ChannelCard key={c.id} channel={c} onPress={() => onPlay(c)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    if (tab === 'movies') {
      return (
        <FlatList
          data={movies}
          keyExtractor={(t) => t.id}
          {...gridProps}
          renderItem={({ item }) => (
            <TitleCard title={item} accentColor={accent} width={r.gridCardW} spacing={0} onPress={() => onPlay(item)} />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No movies in this provider.</Text>}
        />
      );
    }

    if (tab === 'series') {
      return (
        <FlatList
          data={series}
          keyExtractor={(t) => t.id}
          {...gridProps}
          renderItem={({ item }) => (
            <TitleCard title={item} accentColor={accent} width={r.gridCardW} spacing={0} onPress={() => onPlay(item)} />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No series in this provider.</Text>}
        />
      );
    }

    if (tab === 'live') {
      return (
        <FlatList
          data={channels}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: r.gutter, paddingTop: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <ChannelCard channel={item} onPress={() => onPlay(item)} />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No live channels in this provider.</Text>}
        />
      );
    }

    if (tab === 'mylist') {
      return (
        <FlatList
          data={myListTitles}
          keyExtractor={(t) => t.id}
          {...gridProps}
          renderItem={({ item }) => (
            <TitleCard title={item} accentColor={accent} width={r.gridCardW} spacing={0} onPress={() => onPlay(item)} />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Add titles to your list using the ♥ button.</Text>
          }
        />
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: r.gutter }]}>
        <Text style={[styles.logoText, { color: accent, fontSize: r.isTablet ? 27 : 22 }]}>SHIFT</Text>
        <TextInput
          style={[styles.searchInput, r.isTablet && { fontSize: 16, paddingVertical: 11, maxWidth: 460 }]}
          placeholder="Search titles and channels…"
          placeholderTextColor="#6b6b6b"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity onPress={onSettings} style={styles.signOutBtn} hitSlop={10}>
          <Text style={[styles.gearIcon, r.isTablet && { fontSize: 26 }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar — pill style, scrolls on phones, fits inline on iPad */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={[styles.tabBarContent, { paddingHorizontal: r.gutter }]}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.tabItem,
                r.isTablet && { paddingHorizontal: 18, paddingVertical: 10 },
                active && { backgroundColor: accent },
              ]}
              onPress={() => { setTab(t.id); setQuery(''); }}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.tabText,
                r.isTablet && { fontSize: 15 },
                active && styles.tabTextActive,
              ]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  loadingWrap: { flex: 1, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#b3b3b3', fontSize: 15, marginTop: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  logoText: { fontWeight: '900', letterSpacing: 1.5, marginRight: 2 },
  searchInput: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10,
    borderWidth: 1, borderColor: '#2c2c2c',
    paddingHorizontal: 14, paddingVertical: 9, color: '#fff', fontSize: 14.5,
  },
  signOutBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  gearIcon: { color: '#aaa', fontSize: 22 },
  tabBar: { flexGrow: 0, marginBottom: 4 },
  tabBarContent: { paddingVertical: 8, gap: 8 },
  tabItem: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#1e1e1e',
  },
  tabText: { color: '#b3b3b3', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  railHeading: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 40 },
  searchHeading: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
});
