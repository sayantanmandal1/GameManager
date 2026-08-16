import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameWebView } from './src/screens/GameWebView';
import { deleteSession, loadSession, saveSession } from './src/services/session';
import type { GuestSession, WebDestination } from './src/types';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [destination, setDestination] = useState<WebDestination | null>(null);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((stored) => {
        if (active) setSession(stored);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = useCallback(async (nextSession: GuestSession) => {
    await saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const handleLogout = useCallback(async () => {
    setDestination(null);
    setSession(null);
    await deleteSession();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {booting ? (
        <View style={styles.boot}>
          <ActivityIndicator color="#63d5a4" size="large" />
        </View>
      ) : !session ? (
        <LoginScreen onLogin={handleLogin} />
      ) : destination ? (
        <GameWebView
          destination={destination}
          session={session}
          onClose={() => setDestination(null)}
        />
      ) : (
        <HomeScreen
          session={session}
          onOpen={setDestination}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#101310',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
