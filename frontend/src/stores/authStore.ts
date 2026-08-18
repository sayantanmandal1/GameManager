import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiPost } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { GuestUser } from '@/shared';

interface AuthState {
  user: { id: string; username: string; avatar: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string) => Promise<void>;
  renewSession: () => Promise<void>;
  logout: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

let renewalPromise: Promise<void> | null = null;

export function isTokenExpired(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

async function createGuestSession(username: string): Promise<{
  user: GuestUser;
  token: string;
}> {
  return apiPost('/auth/guest', { username });
}

function notifyNativeSession(session: { user: GuestUser; token: string }): void {
  if (typeof window === 'undefined') return;
  const bridge = (window as Window & {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify({ type: 'auth-session', session }));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      isLoading: false,
      error: null,

      login: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
          const data = await createGuestSession(username);
          connectSocket(data.token);
          notifyNativeSession(data);
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
        }
      },

      renewSession: async () => {
        if (renewalPromise) return renewalPromise;

        const username = get().user?.username;
        if (!username) {
          get().logout();
          return;
        }

        renewalPromise = (async () => {
          set({ isLoading: true, error: null });
          try {
            const data = await createGuestSession(username);
            connectSocket(data.token);
            notifyNativeSession(data);
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Session renewal failed';
            set({ error: message, isLoading: false });
          } finally {
            renewalPromise = null;
          }
        })();

        return renewalPromise;
      },

      logout: () => {
        disconnectSocket();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.setHasHydrated(true);
        if (state.isAuthenticated && state.token && isTokenExpired(state.token)) {
          void state.renewSession();
        }
      },
    },
  ),
);
