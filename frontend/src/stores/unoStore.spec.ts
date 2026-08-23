const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(() => mockSocket),
  waitForSocket: jest.fn(async () => mockSocket),
}));

import { useUnoStore } from './unoStore';
import { useAuthStore } from './authStore';
import type { UnoPlayerView, UnoRoundResult } from '@/shared';

const viewFor = (lobbyCode: string, gameId: string) =>
  ({ lobbyCode, gameId, yourHand: [] }) as unknown as UnoPlayerView;

describe('unoStore state isolation', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    useUnoStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'user-1', username: 'Alice', avatar: 'A' },
      token: 'token',
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('clears private game state when the route changes to another lobby', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('111111');
    store.applyState({ gameId: 'game-1', view: viewFor('111111', 'game-1') });

    useUnoStore.getState().setLobbyCode('222222');

    expect(useUnoStore.getState()).toMatchObject({
      lobbyCode: '222222',
      gameId: null,
      view: null,
      roundResult: null,
      matchResult: null,
    });
  });

  it('ignores a late state payload from a different lobby', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    store.applyState({ gameId: 'game-1', view: viewFor('111111', 'game-1') });

    expect(useUnoStore.getState().view).toBeNull();
    expect(useUnoStore.getState().gameId).toBeNull();
  });

  it('ignores a payload whose envelope and view identify different games', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    store.applyState({ gameId: 'game-2', view: viewFor('222222', 'game-1') });

    expect(useUnoStore.getState().view).toBeNull();
  });

  it('rejects a private player view issued for another authenticated user', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    const view = {
      ...viewFor('222222', 'game-1'),
      role: 'player' as const,
      youId: 'user-2',
    };

    store.applyState({ gameId: 'game-1', view });

    expect(useUnoStore.getState().view).toBeNull();
  });

  it('keeps the winner screen when another lobby starts a game', () => {
    const result = {
      roundWinnerId: 'user-1',
      roundWinnerName: 'Alice',
      points: 0,
      scores: { 'user-1': 0 },
      matchOver: true,
      matchWinnerId: 'user-1',
      reason: 'single',
    } satisfies UnoRoundResult;
    useUnoStore.getState().setLobbyCode('222222');
    useUnoStore.setState({ gameId: 'game-2', matchResult: result });
    const cleanup = useUnoStore.getState().initListeners();
    const onStarting = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'lobby:game_starting',
    )![1] as (data: { lobbyCode: string }) => void;

    onStarting({ lobbyCode: '111111' });
    expect(useUnoStore.getState().matchResult).toEqual(result);

    onStarting({ lobbyCode: '222222' });
    expect(useUnoStore.getState().matchResult).toBeNull();
    cleanup();
  });

  it('ignores late round and match results from another UNO game', () => {
    const result = {
      roundWinnerId: 'user-1',
      roundWinnerName: 'Alice',
      points: 10,
      scores: { 'user-1': 10 },
      matchOver: true,
      matchWinnerId: 'user-1',
      reason: 'target',
    } satisfies UnoRoundResult;
    useUnoStore.getState().setLobbyCode('222222');
    useUnoStore.setState({ gameId: 'game-2' });
    const cleanup = useUnoStore.getState().initListeners();
    const onRoundOver = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'uno:round_over',
    )![1] as (data: { gameId: string; result: UnoRoundResult }) => void;
    const onGameOver = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'uno:game_over',
    )![1] as (data: { gameId: string; result: UnoRoundResult }) => void;

    onRoundOver({ gameId: 'old-game', result });
    onGameOver({ gameId: 'old-game', result });
    expect(useUnoStore.getState().roundResult).toBeNull();
    expect(useUnoStore.getState().matchResult).toBeNull();

    onGameOver({ gameId: 'game-2', result });
    expect(useUnoStore.getState().matchResult).toEqual(result);
    cleanup();
  });

  it('emits a receiver-only roulette color choice for the active game', () => {
    useUnoStore.getState().setLobbyCode('222222');
    useUnoStore.setState({ gameId: 'game-2' });

    useUnoStore.getState().chooseRouletteColor('green');

    expect(mockSocket.emit).toHaveBeenCalledWith('uno:choose_roulette_color', {
      gameId: 'game-2',
      lobbyCode: '222222',
      chosenColor: 'green',
    });
  });

  it('emits a receiver-only opening color choice for the active Flip game', () => {
    useUnoStore.getState().setLobbyCode('222222');
    useUnoStore.setState({ gameId: 'game-2' });

    useUnoStore.getState().chooseOpeningColor('blue');

    expect(mockSocket.emit).toHaveBeenCalledWith('uno:choose_opening_color', {
      gameId: 'game-2',
      lobbyCode: '222222',
      chosenColor: 'blue',
    });
  });

  it('restores a terminal winner screen from state replay without a game-over event', () => {
    const result = {
      roundWinnerId: 'user-1',
      roundWinnerName: 'Alice',
      points: 12,
      scores: { 'user-1': 12 },
      matchOver: true,
      matchWinnerId: 'user-1',
      reason: 'single',
    } satisfies UnoRoundResult;
    useUnoStore.getState().setLobbyCode('222222');
    useUnoStore.getState().applyState({
      gameId: 'game-2',
      view: {
        ...viewFor('222222', 'game-2'),
        role: 'player',
        youId: 'user-1',
        phase: 'finished',
        lastResult: result,
      } as UnoPlayerView,
    });

    expect(useUnoStore.getState().matchResult).toEqual(result);
  });
});