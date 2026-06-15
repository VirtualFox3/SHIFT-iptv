import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import PlayerScreen from './screens/PlayerScreen';
import type { Title, Channel } from './types';

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

function HomeWithPlayer() {
  const [playing, setPlaying] = useState<Title | Channel | null>(null);

  if (playing) {
    return <PlayerScreen item={playing} onClose={() => setPlaying(null)} />;
  }
  return <HomeScreen onPlay={setPlaying} />;
}
