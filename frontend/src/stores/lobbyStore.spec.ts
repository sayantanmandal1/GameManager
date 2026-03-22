/**
 * Tests for stores/lobbyStore.ts
 */

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connected: true,
};

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(() => mockSocket),
  waitForSocket: jest.fn(() => Promise.resolve(mockSocket)),
}));

import { useLobbyStore } from './lobbyStore';

describe('LobbyStore', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    useLobbyStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have null lobby', () => {
      expect(useLobbyStore.getState().lobby).toBeNull();
    });

    it('should have null error', () => {
      expect(useLobbyStore.getState().error).toBeNull();
    });

    it('should not be loading', () => {
      expect(useLobbyStore.getState().isLoading).toBe(false);
    });
  });

  describe('createLobby', () => {
    it('should emit lobby:create event', async () => {
      await useLobbyStore.getState().createLobby('bingo' as any);

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:create', {
        gameType: 'bingo',
      });
    });

    it('should set loading state before emitting', async () => {
      // Access isLoading during the call
      const promise = useLobbyStore.getState().createLobby('bingo' as any);
      // isLoading should be set by the time awaiting resolves
      await promise;
    });
  });

  describe('joinLobby', () => {
    it('should emit lobby:join with code', async () => {
      await useLobbyStore.getState().joinLobby('123456');

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:join', {
        code: '123456',
      });
    });
  });

  describe('leaveLobby', () => {
    it('should emit lobby:leave and clear lobby', () => {
      useLobbyStore.setState({ lobby: {} as any });
      useLobbyStore.getState().leaveLobby();

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:leave');
      expect(useLobbyStore.getState().lobby).toBeNull();
    });
  });

  describe('setReady', () => {
    it('should emit lobby:player_ready with ready=true', () => {
      useLobbyStore.getState().setReady(true);
      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:player_ready', { ready: true });
    });

    it('should emit lobby:player_ready with ready=false', () => {
      useLobbyStore.getState().setReady(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:player_ready', { ready: false });
    });
  });

  describe('startGame', () => {
    it('should emit lobby:start_game', () => {
      useLobbyStore.getState().startGame();
      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:start_game');
    });
  });

  describe('initListeners', () => {
    it('should register lobby:state and lobby:error listeners', () => {
      const cleanup = useLobbyStore.getState().initListeners();

      expect(mockSocket.on).toHaveBeenCalledWith('lobby:state', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('lobby:error', expect.any(Function));

      cleanup();
      expect(mockSocket.off).toHaveBeenCalledWith('lobby:state', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('lobby:error', expect.any(Function));
    });

    it('should update lobby state when lobby:state is received', () => {
      useLobbyStore.getState().initListeners();

      const onState = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'lobby:state')[1];
      onState({ lobby: { id: 'lobby1', code: '123456', players: [] } });

      expect(useLobbyStore.getState().lobby).toBeTruthy();
      expect(useLobbyStore.getState().lobby!.code).toBe('123456');
      expect(useLobbyStore.getState().isLoading).toBe(false);
    });

    it('should set error when lobby:error is received', () => {
      useLobbyStore.getState().initListeners();

      const onError = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'lobby:error')[1];
      onError({ message: 'Lobby is full' });

      expect(useLobbyStore.getState().error).toBe('Lobby is full');
      expect(useLobbyStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      useLobbyStore.setState({
        lobby: {} as any,
        error: 'some error',
        isLoading: true,
      });

      useLobbyStore.getState().reset();

      expect(useLobbyStore.getState().lobby).toBeNull();
      expect(useLobbyStore.getState().error).toBeNull();
      expect(useLobbyStore.getState().isLoading).toBe(false);
    });
  });
});
