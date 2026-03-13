import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiPost } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { GuestUser } from '@multiplayer-games/shared';

interface AuthState {
  user: { id: string; username: string; avatar: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiPost<{ user: GuestUser; token: string }>(
            '/auth/guest',
            { username },
          );
          connectSocket(data.token);
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

      logout: () => {
        disconnectSocket();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
