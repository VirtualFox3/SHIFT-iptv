import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import TitleCard from './TitleCard';
import type { Title } from '../types';
import { useResponsive } from '../useResponsive';

interface Props {
  title: string;
  items: Title[];
  progress?: Record<string, number>;
  accentColor: string;
  onPress: (t: Title) => void;
}

export default function Rail({ title, items, progress, accentColor, onPress }: Props) {
  const r = useResponsive();
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { fontSize: r.headingSize, paddingHorizontal: r.gutter }]}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: r.gutter }}
        // snap to card edges so rails never rest mid-poster
        snapToInterval={r.cardW + r.gap}
        decelerationRate="fast"
      >
        {items.map((t) => (
          <TitleCard
            key={t.id}
            title={t}
            progress={progress?.[t.id]}
            accentColor={accentColor}
            width={r.cardW}
            spacing={r.gap}
            onPress={() => onPress(t)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 30 },
  heading: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
});
