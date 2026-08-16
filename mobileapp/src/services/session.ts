import * as SecureStore from 'expo-secure-store';
import { isGuestSession } from './auth';
import type { GuestSession } from '../types';

const SESSION_KEY = 'gameverse.guest-session.v1';

export async function loadSession(): Promise<GuestSession | null> {
  try {
    const serialized = await SecureStore.getItemAsync(SESSION_KEY);
    if (!serialized || serialized.length > 12_000) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (!isGuestSession(parsed)) {
      await deleteSession();
      return null;
    }
    return parsed;
  } catch {
    await deleteSession().catch(() => undefined);
    return null;
  }
}

export async function saveSession(session: GuestSession): Promise<void> {
  if (!isGuestSession(session)) throw new Error('Cannot store an invalid session.');
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function deleteSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}