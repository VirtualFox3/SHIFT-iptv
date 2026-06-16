import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { xtreamGetSeriesInfo, type Episode, type SeriesInfo, type XtreamAuth } from '../api/xtream';
import type { Title } from '../types';

interface Props {
  series: Title;
  onClose: () => void;
  onPlayEpisode: (item: Title) => void;
}

export default function EpisodesScreen({ series, onClose, onPlayEpisode }: Props) {
  const provider = useStore((s) => s.provider);
  const accent = useStore((s) => s.settings.accentColor);

  const [info, setInfo] = useState<SeriesInfo | null>(null);
  const [activeSeason, setActiveSeason] = useState(0);
  const [loading, setLoading] = useState(true);

  const auth: XtreamAuth | null = provider?.type === 'xtream' && provider.serverUrl && provider.username
    ? { serverUrl: provider.serverUrl, username: provider.username, password: provider.password || '' }
    : null;

  useEffect(() => {
    const seriesId = series.id.replace(/^xt_series_/, '');
    if (!auth || !seriesId) { setLoading(false); return; }
    setLoading(true);
    xtreamGetSeriesInfo(auth, seriesId)
      .then((res) => {
        setInfo(res);
        if (res?.seasons.length) setActiveSeason(res.seasons[0].season);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id]);

  const seasonObj = useMemo(
    () => info?.seasons.find((s) => s.season === activeSeason) || info?.seasons[0],
    [info, activeSeason],
  );

  function playEpisode(ep: Episode) {
    const item: Title = {
      ...series,
      id: `${series.id}_s${ep.season}e${ep.episode}`,
      title: `${series.title} · S${ep.season} E${ep.episode}`,
      streamUrl: ep.playUrl,
      logoUrl: ep.still || series.logoUrl,
      synopsis: ep.plot || series.synopsis,
    };
    onPlayEpisode(item);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{series.title}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : !info || info.seasons.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>No episodes found for this series.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonBar} contentContainerStyle={styles.seasonBarContent}>
            {info.seasons.map((s) => (
              <TouchableOpacity
                key={s.season}
                style={[styles.seasonChip, activeSeason === s.season && { backgroundColor: accent }]}
                onPress={() => setActiveSeason(s.season)}
              >
                <Text style={[styles.seasonChipText, activeSeason === s.season && { color: '#fff' }]}>
                  Season {s.season}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.episodeList}>
            {seasonObj?.episodes.map((ep) => (
              <TouchableOpacity key={ep.id} style={styles.episodeRow} onPress={() => playEpisode(ep)}>
                {ep.still ? (
                  <Image source={{ uri: ep.still }} style={styles.episodeThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.episodeThumb, styles.episodeThumbFallback]}>
                    <Text style={styles.episodePlayIcon}>▶</Text>
                  </View>
                )}
                <View style={styles.episodeInfo}>
                  <Text style={styles.episodeTitle} numberOfLines={1}>
                    {ep.episode}. {ep.title}
                  </Text>
                  {ep.duration && <Text style={styles.episodeMeta}>{ep.duration}</Text>}
                  {ep.plot && <Text style={styles.episodePlot} numberOfLines={2}>{ep.plot}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  backBtn: { padding: 6 },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888', fontSize: 15 },
  seasonBar: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  seasonBarContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  seasonChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#222' },
  seasonChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  episodeList: { padding: 16, paddingBottom: 40 },
  episodeRow: { flexDirection: 'row', marginBottom: 16, gap: 12 },
  episodeThumb: { width: 120, height: 68, borderRadius: 6, backgroundColor: '#222' },
  episodeThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  episodePlayIcon: { color: '#666', fontSize: 20 },
  episodeInfo: { flex: 1, justifyContent: 'center' },
  episodeTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  episodeMeta: { color: '#888', fontSize: 12, marginBottom: 4 },
  episodePlot: { color: '#999', fontSize: 12, lineHeight: 16 },
});
