import { API_URL } from '../config';
import type { GuestSession } from '../types';

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{2,20}$/;
const REQUEST_TIMEOUT_MS = 15_000;

export function validateUsername(username: string): string | null {
  const normalized = username.trim();
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Use 2–20 letters, numbers, underscores, or hyphens.';
  }
  return null;
}

export async function loginGuest(username: string): Promise<GuestSession> {
  const normalized = username.trim();
  const validationError = validateUsername(normalized);
  if (validationError) throw new Error(validationError);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalized }),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(publicApiError(payload, response.status));
    }
    if (!isGuestSession(payload)) {
      throw new Error('The server returned an invalid session.');
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The server took too long to respond.');
    }
    if (error instanceof Error) throw error;
    throw new Error('Unable to connect to GameVerse.');
  } finally {
    clearTimeout(timeout);
  }
}

export function isGuestSession(value: unknown): value is GuestSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GuestSession>;
  const user = candidate.user;
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 20 &&
    candidate.token.length <= 8192 &&
    !!user &&
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    user.id.length <= 128 &&
    typeof user.username === 'string' &&
    USERNAME_PATTERN.test(user.username) &&
    typeof user.avatar === 'string' &&
    user.avatar.length <= 16
  );
}

function publicApiError(payload: unknown, status: number): string {
  if (status === 429) return 'Too many login attempts. Try again in a minute.';
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.length <= 160) return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0].slice(0, 160);
  }
  return 'Unable to sign in right now.';
}