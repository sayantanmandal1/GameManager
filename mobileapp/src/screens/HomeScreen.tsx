import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
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
import type { GameDefinition, GameModeKey, GuestSession, WebDestination } from '../types';
import { getGameCatalog } from '../services/catalog';

interface HomeScreenProps {
  session: GuestSession;
  onOpen: (destination: WebDestination) => void;
  onLogout: () => Promise<void>;
}

const MODE_LABELS: Partial<Record<GameModeKey, string>> = {
  offline: 'Offline',
  bot: 'Bot',
  solo: 'Solo',
};
const WAKE_HINT_DELAY_MS = 5_000;

export function HomeScreen({ session, onOpen, onLogout }: Readonly<HomeScreenProps>) {
  const { width, fontScale } = useWindowDimensions();
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const columns = width < 360 || fontScale >= 1.5 ? 1 : width >= 700 ? 3 : 2;
  const cardWidth = useMemo(
    () => Math.floor((Math.min(width, 1000) - 32 - 12 * (columns - 1)) / columns),
    [columns, width],
  );
  const query = search.trim().toLowerCase();
  const visibleGames = useMemo(
    () => (query
      ? games.filter((game) => `${game.title} ${game.description}`.toLowerCase().includes(query))
      : games),
    [games, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = setTimeout(() => setSlowLoad(true), WAKE_HINT_DELAY_MS);
    getGameCatalog(controller.signal)
      .then((catalog) => {
        setGames(catalog);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(error instanceof Error ? error.message : 'Game catalog unavailable');
      })
      .finally(() => {
        clearTimeout(slowTimer);
        if (!controller.signal.aborted) {
          setSlowLoad(false);
          setRefreshing(false);
        }
      });
    return () => {
      clearTimeout(slowTimer);
      controller.abort();
    };
  }, [catalogAttempt]);

  const reload = () => {
    setRefreshing(true);
    setCatalogAttempt((attempt) => attempt + 1);
  };

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
        key={`columns-${columns}`}
        data={visibleGames}
        keyExtractor={(game) => game.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={reload}
            colors={[colors.mint]}
            tintColor={colors.mint}
            progressBackgroundColor={colors.surface}
          />
        )}
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
              <Pressable onPress={confirmLogout} style={({ pressed }) => [styles.profile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Sign out">
                <Text style={styles.profileText}>{session.user.avatar || session.user.username.slice(0, 1)}</Text>
              </Pressable>
            </View>

            <Text style={styles.hello} numberOfLines={1}>Hello, {session.user.username}</Text>
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
                  placeholderTextColor={colors.muted}
                  style={styles.codeInput}
                  accessibilityLabel="Six digit room code"
                />
              </View>
              <Pressable
                disabled={joinCode.length !== 6}
                onPress={join}
                accessibilityRole="button"
                style={({ pressed }) => [styles.joinButton, joinCode.length !== 6 && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.joinButtonText}>Join</Text>
              </Pressable>
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Choose a game</Text>
              <Text style={styles.sectionMeta}>
                {games.length === 0 ? 'Loading…' : query ? `${visibleGames.length} of ${games.length}` : `${games.length} games`}
              </Text>
            </View>
            {games.length > 0 && (
              <TextInput
                value={search}
                onChangeText={(value) => setSearch(value.slice(0, 60))}
                placeholder="Search games"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.searchInput}
                accessibilityLabel="Search games"
              />
            )}
          </View>
        }
        ListEmptyComponent={
          catalogError ? (
            <View style={styles.catalogState}>
              <Text style={styles.catalogError}>{catalogError}</Text>
              <Pressable onPress={reload} style={styles.retryButton} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : games.length > 0 ? (
            <View style={styles.catalogState}>
              <Text style={styles.catalogLoading}>No games match “{search.trim()}”.</Text>
            </View>
          ) : (
            <View style={styles.catalogState}>
              <ActivityIndicator color={colors.mint} />
              <Text style={styles.catalogLoading}>
                {slowLoad ? 'Waking up the game server… this can take up to a minute.' : 'Loading game library'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void open(item)}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth },
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardMark, { backgroundColor: item.accent }]}>
                <Text style={styles.cardMarkText} numberOfLines={1} adjustsFontSizeToFit>{item.mark}</Text>
              </View>
              {playersLabel(item) && <Text style={styles.cardPlayers}>{playersLabel(item)}</Text>}
            </View>
            <View>
              <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
              <Text numberOfLines={2} style={styles.cardDescription}>{item.description}</Text>
              {item.modes.some((mode) => MODE_LABELS[mode]) && (
                <View style={styles.badgeRow}>
                  {item.modes.filter((mode) => MODE_LABELS[mode]).map((mode) => (
                    <Text key={mode} style={styles.badge}>{MODE_LABELS[mode]}</Text>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function playersLabel(game: GameDefinition): string | null {
  if (!game.minPlayers || !game.maxPlayers) return null;
  if (game.maxPlayers === 1) return 'Solo';
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} players`
    : `${game.minPlayers}–${game.maxPlayers} players`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 40 },
  row: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginBottom: 40, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brand: { color: colors.text, fontSize: 19, fontWeight: '600', letterSpacing: -0.6 },
  connection: { color: colors.mint, fontSize: 9, fontWeight: '600', marginTop: 4, letterSpacing: 1.2 },
  profile: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  profileText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hello: { color: colors.text, fontSize: 34, fontWeight: '600', letterSpacing: -1.3 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  joinPanel: { marginTop: 28, minHeight: 104, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  joinCopy: { flex: 1 },
  joinLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 6 },
  codeInput: { minHeight: 42, color: colors.text, fontSize: 26, fontWeight: '500', letterSpacing: 4, fontVariant: ['tabular-nums'], padding: 0 },
  joinButton: { minWidth: 76, minHeight: 48, padding: 12, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  joinButtonText: { color: colors.background, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.78 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 36, marginBottom: 18 },
  sectionTitle: { color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.7, flexShrink: 1 },
  sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  searchInput: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 18 },
  card: { minHeight: 224, marginBottom: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, justifyContent: 'space-between', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)' },
  cardPressed: { opacity: 0.72, borderColor: colors.blue },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  cardMark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cardMarkText: { color: '#17201a', fontSize: 22, fontWeight: '900' },
  cardPlayers: { flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '500', textAlign: 'right', marginTop: 3 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '600', letterSpacing: -0.4, marginTop: 22 },
  cardDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { color: colors.blue, backgroundColor: colors.surfaceRaised, fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  catalogState: { minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  catalogLoading: { color: colors.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },
  catalogError: { color: colors.coral, fontSize: 13, textAlign: 'center' },
  retryButton: { minHeight: 44, minWidth: 104, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  retryText: { color: '#17201a', fontWeight: '900' },
});
