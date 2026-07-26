import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import type { Title } from '../types';

interface Props {
  title: Title;
  progress?: number;
  accentColor: string;
  onPress: () => void;
  /** Card width — driven by useResponsive so iPad gets larger posters. */
  width?: number;
  /** Horizontal spacing after the card (rails only; grids handle their own). */
  spacing?: number;
}

export default function TitleCard({
  title, progress, accentColor, onPress, width = 132, spacing = 10,
}: Props) {
  const h = Math.round(width * 1.45);
  const big = width >= 160;

  return (
    <TouchableOpacity
      style={{ width, marginRight: spacing }}
      onPress={onPress}
      activeOpacity={0.75}
      {...({ isTVSelectable: Platform.isTV, hasTVPreferredFocus: false } as object)}
    >
      <View style={[styles.imageWrap, { width, height: h }]}>
        {title.logoUrl ? (
          <Image source={{ uri: title.logoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, big && { fontSize: 15 }]} numberOfLines={3}>
              {title.title}
            </Text>
          </View>
        )}

        {/* rating chip */}
        {!!title.imdbRating && (
          <View style={styles.ratingChip}>
            <Text style={styles.ratingText}>★ {title.imdbRating}</Text>
          </View>
        )}

        {progress != null && progress > 0 && progress < 95 && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: accentColor }]} />
          </View>
        )}
      </View>

      <Text style={[styles.name, big && { fontSize: 15 }]} numberOfLines={1}>{title.title}</Text>
      <Text style={[styles.meta, big && { fontSize: 12.5 }]} numberOfLines={1}>
        {title.year}{title.seasons ? ` · ${title.seasons}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 7,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    padding: 10, backgroundColor: '#232323',
  },
  placeholderText: { color: '#e5e5e5', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  ratingChip: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 5,
  },
  ratingText: { color: '#F5C518', fontSize: 10.5, fontWeight: '800' },
  progressBg: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(255,255,255,0.28)',
  },
  progressFill: { height: '100%' },
  name: { color: '#fff', fontSize: 13, fontWeight: '600' },
  meta: { color: '#8a8a8a', fontSize: 11, marginTop: 1 },
});
