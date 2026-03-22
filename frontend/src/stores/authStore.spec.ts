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

import { useAuthStore } from './authStore';
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
