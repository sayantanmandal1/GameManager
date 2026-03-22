/**
 * Tests for lib/socket.ts
 */

// Mock socket.io-client
const mockSocket = {
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { getSocket, isSocketConnected, connectSocket, disconnectSocket, waitForSocket } from './socket';

describe('Socket Module', () => {
  beforeEach(() => {
    // Reset the module state by disconnecting
    disconnectSocket();
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.disconnect.mockReset();
  });

  describe('getSocket', () => {
    it('should return null when no socket exists', () => {
      expect(getSocket()).toBeNull();
    });

    it('should return socket after connect', () => {
      connectSocket('test-token');
      expect(getSocket()).toBe(mockSocket);
    });
  });

  describe('isSocketConnected', () => {
    it('should return false when no socket exists', () => {
      expect(isSocketConnected()).toBe(false);
    });

    it('should return false when socket is not connected', () => {
      connectSocket('test-token');
      mockSocket.connected = false;
      expect(isSocketConnected()).toBe(false);
    });

    it('should return true when socket is connected', () => {
      connectSocket('test-token');
      mockSocket.connected = true;
      expect(isSocketConnected()).toBe(true);
    });
  });

  describe('connectSocket', () => {
    it('should create a socket with auth token', () => {
      const { io } = require('socket.io-client');
      connectSocket('my-jwt-token');
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'my-jwt-token' },
          transports: ['websocket', 'polling'],
        }),
      );
    });

    it('should return existing socket if already connected', () => {
      connectSocket('token1');
      mockSocket.connected = true;
      const result = connectSocket('token2');
      // Should return the same socket without creating a new one
      expect(result).toBe(mockSocket);
    });

    it('should set up connect and connect_error listeners', () => {
      connectSocket('test-token');
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });
  });

  describe('disconnectSocket', () => {
    it('should disconnect and clear socket', () => {
      connectSocket('test-token');
      disconnectSocket();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(getSocket()).toBeNull();
    });

    it('should handle disconnect when no socket exists', () => {
      expect(() => disconnectSocket()).not.toThrow();
    });
  });

  describe('waitForSocket', () => {
    it('should return null when no socket exists', async () => {
      const result = await waitForSocket();
      expect(result).toBeNull();
    });

    it('should return socket when already connected', async () => {
      connectSocket('test-token');
      mockSocket.connected = true;
      const result = await waitForSocket();
      expect(result).toBe(mockSocket);
    });
  });
});
