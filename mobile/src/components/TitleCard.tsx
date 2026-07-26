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
}

export default function TitleCard({ title, progress, accentColor, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      {...({ isTVSelectable: Platform.isTV, hasTVPreferredFocus: false } as object)}
    >
      <View style={styles.imageWrap}>
        {title.logoUrl ? (
          <Image source={{ uri: title.logoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: '#2a2a2a' }]}>
            <Text style={styles.placeholderText} numberOfLines={2}>{title.title}</Text>
          </View>
        )}
        {progress != null && progress > 0 && progress < 95 && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: accentColor }]} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{title.title}</Text>
      <Text style={styles.meta}>{title.year} · {title.seasons}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 10,
  },
  imageWrap: {
    width: 140,
    height: 200,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
});
