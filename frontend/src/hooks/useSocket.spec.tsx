import { act, renderHook } from '@testing-library/react';
import { GAME_EVENTS, LOBBY_EVENTS } from '@/shared';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from './useSocket';

const mockSocket = {
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('@/lib/socket', () => ({
  connectSocket: jest.fn(() => mockSocket),
  isSocketConnected: jest.fn(() => false),
}));

function tokenExpiringIn(seconds: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('useSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'p1', username: 'Alice', avatar: 'A' },
      token: tokenExpiringIn(60),
      isAuthenticated: true,
      hasHydrated: true,
      isLoading: false,
      error: null,
      renewSession: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('requests fresh authoritative state after an initial game or rematch starts', () => {
    renderHook(() => useSocket());
    const onGameStarting = mockSocket.on.mock.calls.find(
      (call) => call[0] === LOBBY_EVENTS.GAME_STARTING,
    )![1];

    act(() => onGameStarting({ lobbyCode: '123456' }));

    expect(mockSocket.emit).toHaveBeenCalledWith(GAME_EVENTS.REQUEST_STATE, {
      lobbyCode: '123456',
    });
  });

  it('ignores malformed lobby identities in game-start events', () => {
    renderHook(() => useSocket());
    const onGameStarting = mockSocket.on.mock.calls.find(
      (call) => call[0] === LOBBY_EVENTS.GAME_STARTING,
    )![1];

    act(() => onGameStarting({ lobbyCode: '../admin' }));

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
