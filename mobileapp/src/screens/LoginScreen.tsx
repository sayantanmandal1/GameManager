import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BrandMark } from '../components/BrandMark';
import { loginGuest, validateUsername } from '../services/auth';
import { colors } from '../theme';
import type { GuestSession } from '../types';

export function LoginScreen({ onLogin }: { onLogin: (session: GuestSession) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validationError = useMemo(
    () => (username.length === 0 ? null : validateUsername(username)),
    [username],
  );

  const submit = async () => {
    if (submitting) return;
    const inputError = validateUsername(username);
    if (inputError) {
      setError(inputError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await loginGuest(username);
      await onLogin(session);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <BrandMark size={52} />
            <Text style={styles.brand}>GameVerse</Text>
          </View>

          <View style={styles.scene}>
            <View style={[styles.piece, styles.pieceCoral]} />
            <View style={[styles.piece, styles.pieceMint]} />
            <View style={[styles.card, styles.cardOne]}><Text style={styles.cardText}>7</Text></View>
            <View style={[styles.card, styles.cardTwo]}><Text style={styles.cardText}>4</Text></View>
          </View>

          <Text style={styles.title}>Your table is ready.</Text>
          <Text style={styles.subtitle}>
            Join friends across Android and the web with one guest name.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>PLAYER NAME</Text>
            <TextInput
              value={username}
              onChangeText={(value) => {
                setUsername(value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20));
                setError(null);
              }}
              onSubmitEditing={submit}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              placeholder="e.g. Alex_7"
              placeholderTextColor="#697068"
              returnKeyType="go"
              style={[styles.input, (error || validationError) && styles.inputError]}
              accessibilityLabel="Player name"
            />
            {(error || validationError) && (
              <Text style={styles.error} accessibilityRole="alert">
                {error ?? validationError}
              </Text>
            )}
            <Pressable
              onPress={submit}
              disabled={submitting || !!validationError || username.length < 2}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (submitting || !!validationError || username.length < 2) && styles.disabled,
              ]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color="#17201a" />
              ) : (
                <Text style={styles.primaryButtonText}>Enter GameVerse</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  brand: { color: colors.text, fontSize: 22, fontWeight: '800' },
  scene: {
    height: 150,
    borderRadius: 16,
    backgroundColor: '#17201a',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
    overflow: 'hidden',
  },
  piece: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 6, borderColor: colors.text },
  pieceCoral: { backgroundColor: colors.coral, left: 24, top: 44 },
  pieceMint: { backgroundColor: colors.mint, left: 98, top: 70 },
  card: { position: 'absolute', width: 70, height: 102, borderRadius: 9, borderWidth: 5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  cardOne: { backgroundColor: colors.blue, right: 74, top: 22, transform: [{ rotate: '-10deg' }] },
  cardTwo: { backgroundColor: colors.sun, right: 18, top: 35, transform: [{ rotate: '11deg' }] },
  cardText: { color: '#17201a', fontSize: 38, fontWeight: '900' },
  title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 12 },
  form: { marginTop: 32 },
  label: { color: colors.mint, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { height: 54, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 17, paddingHorizontal: 16 },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  primaryButton: { minHeight: 54, marginTop: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sun },
  primaryButtonText: { color: '#17201a', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});