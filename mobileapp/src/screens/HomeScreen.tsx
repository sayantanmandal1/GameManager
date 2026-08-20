import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BrandMark } from '../components/BrandMark';
import { colors } from '../theme';
import type { GameDefinition, GuestSession, WebDestination } from '../types';
import { getGameCatalog } from '../services/catalog';

interface HomeScreenProps {
  session: GuestSession;
  onOpen: (destination: WebDestination) => void;
  onLogout: () => Promise<void>;
}

export function HomeScreen({ session, onOpen, onLogout }: Readonly<HomeScreenProps>) {
  const { width } = useWindowDimensions();
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const cardWidth = useMemo(() => Math.floor((Math.min(width, 760) - 56) / 2), [width]);

  useEffect(() => {
    const controller = new AbortController();
    getGameCatalog(controller.signal)
      .then((catalog) => {
        setGames(catalog);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(error instanceof Error ? error.message : 'Game catalog unavailable');
      });
    return () => controller.abort();
  }, [catalogAttempt]);

  const open = async (destination: WebDestination) => {
    await Haptics.selectionAsync();
    onOpen(destination);
  };

  const join = () => {
    if (!/^\d{6}$/.test(joinCode)) return;
    void open({ title: `Room ${joinCode}`, route: `/lobby/${joinCode}` });
  };

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'This removes the guest session from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void onLogout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={games}
        keyExtractor={(game) => game.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <BrandMark />
                <View>
                  <Text style={styles.brand}>GameVerse</Text>
                  <Text style={styles.connection}>CROSSPLAY READY</Text>
                </View>
              </View>
              <Pressable onPress={confirmLogout} style={styles.profile} accessibilityLabel="Sign out">
                <Text style={styles.profileText}>{session.user.avatar || session.user.username.slice(0, 1)}</Text>
              </Pressable>
            </View>

            <Text style={styles.hello}>Hello, {session.user.username}</Text>
            <Text style={styles.subtitle}>Pick a table or enter a friend&apos;s room code.</Text>

            <View style={styles.joinPanel}>
              <View style={styles.joinCopy}>
                <Text style={styles.joinLabel}>JOIN A ROOM</Text>
                <TextInput
                  value={joinCode}
                  onChangeText={(value) => setJoinCode(value.replace(/\D/g, '').slice(0, 6))}
                  onSubmitEditing={join}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#697068"
                  style={styles.codeInput}
                  accessibilityLabel="Six digit room code"
                />
              </View>
              <Pressable
                disabled={joinCode.length !== 6}
                onPress={join}
                style={({ pressed }) => [styles.joinButton, joinCode.length !== 6 && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.joinButtonText}>Join</Text>
              </Pressable>
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Choose a game</Text>
              <Text style={styles.sectionMeta}>{games.length || 23} tables</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          catalogError ? (
            <View style={styles.catalogState}>
              <Text style={styles.catalogError}>{catalogError}</Text>
              <Pressable onPress={() => setCatalogAttempt((attempt) => attempt + 1)} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.catalogState}>
              <ActivityIndicator color={colors.mint} />
              <Text style={styles.catalogLoading}>Loading game library</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void open(item)}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, backgroundColor: item.surface },
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
          >
            <View style={[styles.cardMark, { backgroundColor: item.accent }]}>
              <Text style={styles.cardMarkText}>{item.mark}</Text>
            </View>
            <View>
              <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              <Text numberOfLines={2} style={styles.cardDescription}>{item.description}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginBottom: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brand: { color: colors.text, fontSize: 19, fontWeight: '900' },
  connection: { color: colors.mint, fontSize: 9, fontWeight: '900', marginTop: 2 },
  profile: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  profileText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hello: { color: colors.text, fontSize: 31, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6 },
  joinPanel: { marginTop: 22, minHeight: 92, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  joinCopy: { flex: 1 },
  joinLabel: { color: colors.coral, fontSize: 10, fontWeight: '900', marginBottom: 5 },
  codeInput: { height: 42, color: colors.text, fontSize: 25, fontWeight: '900', fontVariant: ['tabular-nums'], padding: 0 },
  joinButton: { minWidth: 76, minHeight: 48, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  joinButtonText: { color: '#17201a', fontWeight: '900' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.78 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  card: { minHeight: 184, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ffffff1c', padding: 14, justifyContent: 'space-between' },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  cardMark: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMarkText: { color: '#17201a', fontSize: 22, fontWeight: '900' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  cardDescription: { color: '#c4c9c1', fontSize: 12, lineHeight: 17, marginTop: 5 },
  catalogState: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  catalogLoading: { color: colors.muted, fontSize: 13, marginTop: 10 },
  catalogError: { color: colors.coral, fontSize: 13, textAlign: 'center' },
  retryButton: { minHeight: 44, minWidth: 104, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  retryText: { color: '#17201a', fontWeight: '900' },
});
