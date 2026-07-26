import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View, StyleSheet } from 'react-native';

// "Shifty" — the SHIFT cat mascot, animated with the RN Animated API.
type Mood = 'idle' | 'loading' | 'sad';

interface Props {
  size?: number;
  mood?: Mood;
}

export default function Shifty({ size = 120, mood = 'idle' }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cfg =
      mood === 'loading'
        ? { dur: 620, easing: Easing.out(Easing.quad) }
        : mood === 'sad'
        ? { dur: 1600, easing: Easing.inOut(Easing.sin) }
        : { dur: 2000, easing: Easing.inOut(Easing.sin) };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: cfg.dur, easing: cfg.easing, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: cfg.dur, easing: cfg.easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mood, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: mood === 'loading' ? [0, -size * 0.22] : mood === 'sad' ? [0, size * 0.04] : [0, -size * 0.06],
  });
  const scaleY = mood === 'loading'
    ? anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1.03] })
    : 1;
  const rotate = mood === 'idle'
    ? anim.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] })
    : '0deg';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {mood === 'loading' && (
        <Animated.View
          style={[
            styles.glow,
            {
              width: size * 0.8,
              height: size * 0.4,
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
            },
          ]}
        />
      )}
      <Animated.View style={{ transform: [{ translateY }, { scaleY }, { rotate }] }}>
        <Image
          source={require('../../assets/shifty.png')}
          style={{ width: size, height: size, opacity: mood === 'sad' ? 0.75 : 1 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    bottom: '18%',
    borderRadius: 999,
    backgroundColor: '#E50914',
  },
});
