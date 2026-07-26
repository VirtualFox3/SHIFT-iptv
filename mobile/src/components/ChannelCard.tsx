import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import type { Channel } from '../types';

interface Props {
  channel: Channel;
  onPress: () => void;
}

export default function ChannelCard({ channel, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      {...({ isTVSelectable: Platform.isTV } as object)}
    >
      <View style={styles.logoWrap}>
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text style={styles.fallback}>{channel.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
        <Text style={styles.cat} numberOfLines={1}>{channel.cat}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    marginRight: 8,
    width: 200,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  logo: {
    width: 40,
    height: 40,
  },
  fallback: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  cat: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
});
