import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import PlayerScreen from './screens/PlayerScreen';
import EpisodesScreen from './screens/EpisodesScreen';
import type { Title, Channel } from './types';

function isTitle(item: Title | Channel): item is Title {
  return 'title' in item;
}

function isMovie(t: Title) {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film';
}

type RootParamList = {
  Auth: undefined;
  Home: undefined;
  Player: { item: Title | Channel };
};

const Stack = createNativeStackNavigator<RootParamList>();

export default function App() {
  const provider = useStore((s) => s.provider);
  const loadContent = useStore((s) => s.loadContent);
  const channels = useStore((s) => s.channels);
  const titles = useStore((s) => s.titles);

  // On app start, if a provider is persisted but content is empty, re-fetch.
  useEffect(() => {
    if (provider && channels.length === 0 && titles.length === 0) {
      loadContent(provider);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {!provider ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : (
            <Stack.Screen name="Home">
              {(props) => (
                <HomeWithPlayer {...props} />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HomeWithPlayer(_props: any) {
  const [playing, setPlaying] = useState<Title | Channel | null>(null);
  const [seriesDetail, setSeriesDetail] = useState<Title | null>(null);

  function handlePlay(item: Title | Channel) {
    if (isTitle(item) && !isMovie(item) && item.id.startsWith('xt_series_')) {
      setSeriesDetail(item);
      return;
    }
    setPlaying(item);
  }

  if (playing) {
    return <PlayerScreen item={playing} onClose={() => setPlaying(null)} />;
  }
  if (seriesDetail) {
    return (
      <EpisodesScreen
        series={seriesDetail}
        onClose={() => setSeriesDetail(null)}
        onPlayEpisode={(item) => { setSeriesDetail(null); setPlaying(item); }}
      />
    );
  }
  return <HomeScreen onPlay={handlePlay} />;
}
