import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import type { Channel } from '../types';
import { useResponsive } from '../useResponsive';

interface Props {
  channel: Channel;
  onPress: () => void;
  /** Override the width (e.g. for a horizontal rail). Defaults to full width. */
  width?: number | string;
}

export default function ChannelCard({ channel, onPress, width }: Props) {
  const r = useResponsive();
  const big = r.isTablet;
  const logoSize = big ? 56 : 46;

  return (
    <TouchableOpacity
      style={[styles.card, { width: (width as any) ?? '100%' }, big && styles.cardBig]}
      onPress={onPress}
      activeOpacity={0.75}
      {...({ isTVSelectable: Platform.isTV } as object)}
    >
      <View style={[styles.logoWrap, { width: logoSize, height: logoSize }]}>
        {channel.logoUrl ? (
          <Image
            source={{ uri: channel.logoUrl }}
            style={{ width: logoSize - 6, height: logoSize - 6 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.fallback}>{channel.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, big && { fontSize: 16 }]} numberOfLines={1}>{channel.name}</Text>
        {!!channel.cat && (
          <Text style={[styles.cat, big && { fontSize: 13 }]} numberOfLines={1}>{channel.cat}</Text>
        )}
      </View>

      <View style={styles.liveTag}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#272727',
    padding: 10,
    marginBottom: 10,
  },
  cardBig: { padding: 14, borderRadius: 14 },
  logoWrap: {
    borderRadius: 9,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  fallback: { color: '#fff', fontSize: 15, fontWeight: '800' },
  info: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  cat: { color: '#8a8a8a', fontSize: 12, marginTop: 2 },
  liveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(229,9,20,0.14)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    marginLeft: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E50914' },
  liveText: { color: '#E50914', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
});
