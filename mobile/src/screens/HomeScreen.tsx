import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Rail from '../components/Rail';
import TitleCard from '../components/TitleCard';
import ChannelCard from '../components/ChannelCard';
import type { Title, Channel } from '../types';

type Tab = 'home' | 'movies' | 'series' | 'live' | 'mylist';

function isMovie(t: Title) {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film';
}

interface Props {
  onPlay: (item: Title | Channel) => void;
}

export default function HomeScreen({ onPlay }: Props) {
  const provider = useStore((s) => s.provider);
  const setProvider = useStore((s) => s.setProvider);
  const channels = useStore((s) => s.channels);
  const titles = useStore((s) => s.titles);
  const myList = useStore((s) => s.myList);
  const continueWatching = useStore((s) => s.continueWatching);
  const watchedAt = useStore((s) => s.watchedAt);
  const loading = useStore((s) => s.loading);
  const accent = useStore((s) => s.settings.accentColor);

  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');

  const titlesById = useMemo(
    () => Object.fromEntries(titles.map((t) => [t.id, t])),
    [titles],
  );

  const movies = useMemo(() => titles.filter(isMovie), [titles]);
  const series = useMemo(() => titles.filter((t) => !isMovie(t)), [titles]);

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
        <ActivityIndicator size="large" color={accent} />
        <Text style={styles.loadingText}>Loading your content…</Text>
      </View>
    );
  }

  const renderContent = () => {
    // Search
    if (query.trim()) {
      return (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.searchHeading}>
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
          <View style={styles.content}>
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
              <View style={styles.section}>
                <Text style={styles.railHeading}>Live Channels</Text>
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
          numColumns={3}
          contentContainerStyle={styles.content}
          renderItem={({ item, index }) => (
            <TitleCard title={item} accentColor={accent} onPress={() => onPlay(item)} />
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
          numColumns={3}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <TitleCard title={item} accentColor={accent} onPress={() => onPlay(item)} />
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
          contentContainerStyle={styles.content}
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
          numColumns={3}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <TitleCard title={item} accentColor={accent} onPress={() => onPlay(item)} />
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
      <View style={styles.header}>
        <Text style={[styles.logoText, { color: accent }]}>SHIFT</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search…"
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setProvider(null)} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabItem, tab === t.id && { borderBottomColor: accent, borderBottomWidth: 2 }]}
            onPress={() => { setTab(t.id); setQuery(''); }}
          >
            <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
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
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
  },
  logoText: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5, marginRight: 4 },
  searchInput: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 14,
  },
  signOutBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  signOutText: { color: '#888', fontSize: 13 },
  tabBar: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  tabBarContent: { paddingHorizontal: 12 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 12, marginRight: 4 },
  tabText: { color: '#888', fontSize: 14, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  railHeading: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 40 },
  searchHeading: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
});
