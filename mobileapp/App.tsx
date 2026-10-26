import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameWebView } from './src/screens/GameWebView';
import { deleteSession, loadSession, saveSession } from './src/services/session';
import { isTokenExpired, loginGuest } from './src/services/auth';
import type { GuestSession, WebDestination } from './src/types';
import { colors } from './src/theme';
import { BrandMark } from './src/components/BrandMark';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [destination, setDestination] = useState<WebDestination | null>(null);

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async (stored) => {
        if (!stored) return null;
        if (!isTokenExpired(stored.token)) return stored;
        const renewed = await loginGuest(stored.user.username);
        await saveSession(renewed);
        return renewed;
      })
      .then((stored) => {
        if (active) setSession(stored);
      })
      .catch(() => deleteSession().catch(() => undefined))
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

  const handleSessionChange = useCallback(async (nextSession: GuestSession) => {
    setSession(nextSession);
    await saveSession(nextSession);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {booting ? (
        <View style={styles.boot}>
          <BrandMark size={64} />
          <ActivityIndicator color={colors.mint} style={{ marginTop: 24 }} />
        </View>
      ) : !session ? (
        <LoginScreen onLogin={handleLogin} />
      ) : destination ? (
        <GameWebView
          destination={destination}
          session={session}
          onSessionChange={handleSessionChange}
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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
