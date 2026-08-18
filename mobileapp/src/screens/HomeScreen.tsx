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
import { loadGameCatalog } from '../services/catalog';
import { colors } from '../theme';
import type { GameCategory, GameDefinition, GuestSession, WebDestination } from '../types';

const CATEGORIES: Array<{ id: 'all' | GameCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'board', label: 'Board' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'cards', label: 'Cards' },
  { id: 'race', label: 'Race' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'party', label: 'Party' },
];

interface HomeScreenProps {
  session: GuestSession;
  onOpen: (destination: WebDestination) => void;
  onLogout: () => Promise<void>;
}

export function HomeScreen({ session, onOpen, onLogout }: Readonly<HomeScreenProps>) {
  const { width } = useWindowDimensions();
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | GameCategory>('all');
  const cardWidth = useMemo(() => Math.floor((Math.min(width, 760) - 56) / 2), [width]);

  useEffect(() => {
    let active = true;
    loadGameCatalog()
      .then((catalog) => {
        if (active) setGames(catalog);
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : 'Unable to load games.');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games.filter((game) => {
      if (category !== 'all' && game.category !== category) return false;
      if (!query) return true;
      return `${game.name} ${game.description} ${game.family}`.toLowerCase().includes(query);
    });
  }, [category, games, search]);

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
        data={filteredGames}
        keyExtractor={(game) => game.key}
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
            <Text style={styles.subtitle}>Search 100 multiplayer games plus solo Sudoku.</Text>

            <View style={styles.joinPanel}>
              <View style={styles.joinCopy}>
                <Text style={styles.joinLabel}>JOIN ANY ROOM</Text>
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

            <TextInput
              value={search}
              onChangeText={(value) => setSearch(value.slice(0, 80))}
              placeholder="Search games"
              placeholderTextColor="#697068"
              style={styles.searchInput}
              accessibilityLabel="Search games"
            />

            <View style={styles.categories}>
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={[styles.category, category === item.id && styles.categoryActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item.id }}
                >
                  <Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Choose a game</Text>
              <Text style={styles.sectionMeta}>{catalogLoading ? 'Loading' : `${filteredGames.length} games`}</Text>
            </View>
            {catalogError && <Text style={styles.error}>{catalogError}</Text>}
            {catalogLoading && <ActivityIndicator color={colors.mint} style={styles.loader} />}
          </View>
        }
        ListEmptyComponent={!catalogLoading ? <Text style={styles.empty}>No games match these filters.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void open({ title: item.name, route: item.route })}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, backgroundColor: item.surface },
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardMark, { backgroundColor: item.accent }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cardMarkText}>{item.mark}</Text>
              </View>
              <Text style={styles.cardCategory}>{item.category.toUpperCase()}</Text>
            </View>
            <View>
              <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
              <Text numberOfLines={2} style={styles.cardDescription}>{item.description}</Text>
              <Text style={styles.players}>{item.minPlayers === 1 ? 'SOLO' : `${item.minPlayers}-${item.maxPlayers} PLAYERS`}</Text>
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
  searchInput: { height: 50, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  category: { minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  categoryActive: { borderColor: colors.mint, backgroundColor: '#173126' },
  categoryText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  categoryTextActive: { color: colors.text },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26, marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  error: { color: colors.coral, marginBottom: 14, fontSize: 13 },
  loader: { marginBottom: 20 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 40 },
  card: { minHeight: 202, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ffffff1c', padding: 14, justifyContent: 'space-between' },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  cardMark: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cardMarkText: { color: '#17201a', fontSize: 20, fontWeight: '900' },
  cardCategory: { color: '#ffffff73', fontSize: 8, fontWeight: '900' },
  cardTitle: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  cardDescription: { color: '#c4c9c1', fontSize: 12, lineHeight: 17, marginTop: 5 },
  players: { color: '#ffffff66', fontSize: 9, fontWeight: '900', marginTop: 8 },
});
