import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import TitleCard from './TitleCard';
import type { Title } from '../types';

interface Props {
  title: string;
  items: Title[];
  progress?: Record<string, number>;
  accentColor: string;
  onPress: (t: Title) => void;
}

export default function Rail({ title, items, progress, accentColor, onPress }: Props) {
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((t) => (
          <TitleCard
            key={t.id}
            title={t}
            progress={progress?.[t.id]}
            accentColor={accentColor}
            onPress={() => onPress(t)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 28,
  },
  heading: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    paddingHorizontal: 16,
  },
});
