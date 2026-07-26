import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { Title } from '../types';
import { fetchTmdbBackdrop } from '../api/tmdb';
import { useResponsive } from '../useResponsive';

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

export default function Billboard({ title, accentColor, tmdbApiKey, onPlay, onInfo }: Props) {
  // Live dimensions — re-flows on rotation / iPad split view.
  const r = useResponsive();
  const H = r.billboardH;
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

  // On iPad the text column is capped so lines stay readable instead of
  // stretching the full width of a 12.9" screen.
  const contentMaxW = r.isTablet ? Math.min(620, r.width * 0.6) : undefined;

  return (
    <View style={[styles.wrap, { width: r.width, height: H }]}>
      {art ? (
        <Image source={{ uri: art }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={[styles.img, { backgroundColor: '#1a1a1a' }]} />
      )}
      {/* scrim — stacked dark overlays fake a bottom gradient without a dep */}
      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={[styles.scrimBottom, { height: H * 0.62 }]} pointerEvents="none" />
      <View style={[styles.scrimDeep, { height: H * 0.3 }]} pointerEvents="none" />

      <View style={[styles.content, { paddingHorizontal: r.gutter, maxWidth: contentMaxW }]}>
        <View style={styles.liveRow}>
          <View style={[styles.tag, { backgroundColor: accentColor }]}>
            <Text style={styles.tagText}>SHIFT</Text>
          </View>
          <Text style={styles.kindText}>{isMovie(title) ? 'FILM' : 'SERIES'}</Text>
        </View>
        <Text style={[styles.title, { fontSize: r.titleSize, lineHeight: r.titleSize * 1.05 }]} numberOfLines={2}>
          {title.title}
        </Text>
        <Text style={[styles.meta, r.isTablet && { fontSize: 15 }]} numberOfLines={1}>
          {title.year}{title.seasons ? `  ·  ${title.seasons}` : ''}{title.imdbRating ? `  ·  ⭐ ${title.imdbRating}` : ''}
        </Text>
        {!!title.genres?.length && (
          <Text style={[styles.genres, r.isTablet && { fontSize: 14 }]} numberOfLines={1}>
            {title.genres.slice(0, 3).join('  ·  ')}
          </Text>
        )}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.playBtn, r.isTablet && styles.btnWide]}
            onPress={onPlay}
            activeOpacity={0.85}
          >
            <Text style={styles.playIcon}>▶</Text>
            <Text style={styles.playText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.infoBtn, r.isTablet && styles.btnWide]}
            onPress={onInfo}
            activeOpacity={0.85}
          >
            <Text style={styles.infoText}>ⓘ  More Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000' },
  img: { width: '100%', height: '100%' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  // two stacked bottom scrims approximate a gradient (no extra dependency)
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,15,15,0.5)' },
  scrimDeep: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,10,10,0.72)' },
  content: { position: 'absolute', left: 0, right: 0, bottom: 24 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  kindText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontWeight: '900', letterSpacing: -0.8, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 14, marginBottom: 8 },
  meta: { color: '#fff', fontSize: 13.5, fontWeight: '600', marginBottom: 4 },
  genres: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 10 },
  playBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 14 },
  // on iPad the buttons shouldn't stretch across the whole hero
  btnWide: { flex: 0, minWidth: 190, paddingVertical: 16 },
  playIcon: { color: '#000', fontSize: 15 },
  playText: { color: '#000', fontSize: 16, fontWeight: '800' },
  infoBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(109,109,110,0.65)', borderRadius: 8, paddingVertical: 14 },
  infoText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
