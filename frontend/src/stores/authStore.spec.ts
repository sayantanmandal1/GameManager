/**
 * Tests for stores/authStore.ts
 */

// Need to mock before import
jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

jest.mock('@/lib/socket', () => ({
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
}));

// Mock zustand persist to avoid localStorage issues in tests
const actualZustand = jest.requireActual('zustand');

import { isTokenExpired, useAuthStore } from './authStore';
import { apiPost } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: true,
      isLoading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should have null user', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should not be authenticated', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should not be loading', () => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should have null error', () => {
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('can record completion of persisted-state hydration', () => {
      useAuthStore.getState().setHasHydrated(false);
      expect(useAuthStore.getState().hasHydrated).toBe(false);
      useAuthStore.getState().setHasHydrated(true);
      expect(useAuthStore.getState().hasHydrated).toBe(true);
    });
  });

  describe('persisted token validation', () => {
    const tokenWithExpiry = (expirySeconds: number) => {
      const payload = btoa(JSON.stringify({ exp: expirySeconds }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `header.${payload}.signature`;
    };

    it('accepts an unexpired persisted token', () => {
      expect(isTokenExpired(tokenWithExpiry(Math.floor(Date.now() / 1000) + 60))).toBe(false);
    });

    it('rejects expired and malformed persisted tokens', () => {
      expect(isTokenExpired(tokenWithExpiry(Math.floor(Date.now() / 1000) - 60))).toBe(true);
      expect(isTokenExpired('not-a-jwt')).toBe(true);
    });
  });

  describe('login', () => {
    it('should set user and token on successful login', async () => {
      const mockResponse = {
        user: { id: 'u1', username: 'Alice', avatar: '🦊' },
        token: 'jwt-token-123',
      };
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      await useAuthStore.getState().login('Alice');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe('jwt-token-123');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(connectSocket).toHaveBeenCalledWith('jwt-token-123');
    });

    it('should call apiPost with /auth/guest', async () => {
      (apiPost as jest.Mock).mockResolvedValue({
        user: { id: 'u1', username: 'Test', avatar: '🐱' },
        token: 'token',
      });

      await useAuthStore.getState().login('Test');

      expect(apiPost).toHaveBeenCalledWith('/auth/guest', { username: 'Test' });
    });

    it('should set error on failed login', async () => {
      (apiPost as jest.Mock).mockRejectedValue(new Error('Invalid username'));

      await useAuthStore.getState().login('');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid username');
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle non-Error rejections', async () => {
      (apiPost as jest.Mock).mockRejectedValue('something went wrong');

      await useAuthStore.getState().login('test');

      expect(useAuthStore.getState().error).toBe('Login failed');
    });
  });

  describe('renewSession', () => {
    it('replaces a stale guest identity while preserving the username', async () => {
      useAuthStore.setState({
        user: { id: 'old-id', username: 'Alice', avatar: 'old' },
        token: 'stale-token',
        isAuthenticated: true,
      });
      const renewed = {
        user: { id: 'new-id', username: 'Alice', avatar: 'new' },
        token: 'fresh-token',
      };
      (apiPost as jest.Mock).mockResolvedValue(renewed);

      await useAuthStore.getState().renewSession();

      expect(apiPost).toHaveBeenCalledWith('/auth/guest', { username: 'Alice' });
      expect(connectSocket).toHaveBeenCalledWith('fresh-token');
      expect(useAuthStore.getState()).toMatchObject({
        user: renewed.user,
        token: renewed.token,
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('coalesces simultaneous renewal requests', async () => {
      useAuthStore.setState({
        user: { id: 'old-id', username: 'Alice', avatar: 'old' },
        token: 'stale-token',
        isAuthenticated: true,
      });
      let resolveRequest: ((value: unknown) => void) | undefined;
      (apiPost as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      const first = useAuthStore.getState().renewSession();
      const second = useAuthStore.getState().renewSession();
      resolveRequest?.({
        user: { id: 'new-id', username: 'Alice', avatar: 'new' },
        token: 'fresh-token',
      });
      await Promise.all([first, second]);

      expect(apiPost).toHaveBeenCalledTimes(1);
    });

    it('does not discard the persisted identity on a transient renewal failure', async () => {
      useAuthStore.setState({
        user: { id: 'old-id', username: 'Alice', avatar: 'old' },
        token: 'stale-token',
        isAuthenticated: true,
      });
      (apiPost as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      await useAuthStore.getState().renewSession();

      expect(useAuthStore.getState()).toMatchObject({
        user: { id: 'old-id', username: 'Alice' },
        token: 'stale-token',
        isAuthenticated: true,
        error: 'Service unavailable',
      });
    });
  });

  describe('logout', () => {
    it('should clear state and disconnect socket', () => {
      useAuthStore.setState({
        user: { id: 'u1', username: 'Alice', avatar: '🦊' },
        token: 'token',
        isAuthenticated: true,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(disconnectSocket).toHaveBeenCalled();
    });
  });
});
