import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import type { Title } from '../types';
import { fetchTmdbBackdrop } from '../api/tmdb';

interface Props {
  title: Title;
  accentColor: string;
  tmdbApiKey?: string;
  onPlay: () => void;
  onInfo: () => void;
}

function isMovie(t: Title) {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film';
}

const W = Dimensions.get('window').width;
const H = Math.round(W * 1.15);

export default function Billboard({ title, accentColor, tmdbApiKey, onPlay, onInfo }: Props) {
  const [art, setArt] = useState<string | undefined>(title.backdropUrl || title.logoUrl);

  useEffect(() => {
    setArt(title.backdropUrl || title.logoUrl);
    if (title.backdropUrl || !tmdbApiKey) return;
    let cancelled = false;
    fetchTmdbBackdrop(title.title, title.year, isMovie(title) ? 'movie' : 'tv', tmdbApiKey).then((url) => {
      if (!cancelled && url) setArt(url);
    });
    return () => { cancelled = true; };
  }, [title.id, tmdbApiKey]);

  return (
    <View style={styles.wrap}>
      {art ? (
        <Image source={{ uri: art }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={[styles.img, { backgroundColor: '#1a1a1a' }]} />
      )}
      {/* scrim — stacked dark overlays fake a bottom gradient without a dep */}
      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />

      <View style={styles.content}>
        <View style={styles.liveRow}>
          <View style={[styles.tag, { backgroundColor: accentColor }]}>
            <Text style={styles.tagText}>SHIFT</Text>
          </View>
          <Text style={styles.kindText}>{isMovie(title) ? 'FILM' : 'SERIES'}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{title.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {title.year}{title.seasons ? `  ·  ${title.seasons}` : ''}{title.imdbRating ? `  ·  ⭐ ${title.imdbRating}` : ''}
        </Text>
        {!!title.genres?.length && (
          <Text style={styles.genres} numberOfLines={1}>{title.genres.slice(0, 3).join('  ·  ')}</Text>
        )}
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.playBtn]} onPress={onPlay} activeOpacity={0.85}>
            <Text style={styles.playIcon}>▶</Text>
            <Text style={styles.playText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={onInfo} activeOpacity={0.85}>
            <Text style={styles.infoText}>ⓘ  More Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H, backgroundColor: '#000' },
  img: { width: '100%', height: '100%' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.35)' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.6, backgroundColor: 'rgba(20,20,20,0.55)' },
  content: { position: 'absolute', left: 0, right: 0, bottom: 22, paddingHorizontal: 18 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  kindText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12, marginBottom: 8 },
  meta: { color: '#fff', fontSize: 13.5, fontWeight: '600', marginBottom: 4 },
  genres: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 10 },
  playBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 13 },
  playIcon: { color: '#000', fontSize: 15 },
  playText: { color: '#000', fontSize: 16, fontWeight: '800' },
  infoBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(109,109,110,0.6)', borderRadius: 8, paddingVertical: 13 },
  infoText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
