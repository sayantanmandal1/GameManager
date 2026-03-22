/**
 * Tests for stores/gameStore.ts
 */

// Mock socket module
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

import { useGameStore } from './gameStore';

describe('GameStore', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    useGameStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have null gameId', () => {
      expect(useGameStore.getState().gameId).toBeNull();
    });

    it('should have null lobbyCode', () => {
      expect(useGameStore.getState().lobbyCode).toBeNull();
    });

    it('should have null view', () => {
      expect(useGameStore.getState().view).toBeNull();
    });

    it('should have null result', () => {
      expect(useGameStore.getState().result).toBeNull();
    });

    it('should start nextPlaceNumber at 1', () => {
      expect(useGameStore.getState().nextPlaceNumber).toBe(1);
    });
  });

  describe('setLobbyCode', () => {
    it('should set the lobby code', () => {
      useGameStore.getState().setLobbyCode('ABC123');
      expect(useGameStore.getState().lobbyCode).toBe('ABC123');
    });
  });

  describe('placeNumber', () => {
    it('should emit PLACE_NUMBER event and increment nextPlaceNumber', () => {
      useGameStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useGameStore.getState().placeNumber(0, 0);

      expect(mockSocket.emit).toHaveBeenCalledWith('bingo:place_number', {
        gameId: 'g1',
        lobbyCode: '123456',
        row: 0,
        col: 0,
        number: 1,
      });
      expect(useGameStore.getState().nextPlaceNumber).toBe(2);
    });

    it('should not emit if no gameId', () => {
      useGameStore.setState({ gameId: null, lobbyCode: '123456' });
      useGameStore.getState().placeNumber(0, 0);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should increment nextPlaceNumber sequentially', () => {
      useGameStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useGameStore.getState().placeNumber(0, 0);
      useGameStore.getState().placeNumber(0, 1);
      useGameStore.getState().placeNumber(0, 2);
      expect(useGameStore.getState().nextPlaceNumber).toBe(4);
    });
  });

  describe('randomizeBoard', () => {
    it('should emit RANDOMIZE_BOARD and set nextPlaceNumber to 26', () => {
      useGameStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useGameStore.getState().randomizeBoard();

      expect(mockSocket.emit).toHaveBeenCalledWith('bingo:randomize_board', {
        gameId: 'g1',
        lobbyCode: '123456',
      });
      expect(useGameStore.getState().nextPlaceNumber).toBe(26);
    });

    it('should not emit if no gameId', () => {
      useGameStore.setState({ gameId: null, lobbyCode: '123456' });
      useGameStore.getState().randomizeBoard();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('chooseNumber', () => {
    it('should emit CHOOSE_NUMBER event', () => {
      useGameStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useGameStore.getState().chooseNumber(7);

      expect(mockSocket.emit).toHaveBeenCalledWith('bingo:choose_number', {
        gameId: 'g1',
        lobbyCode: '123456',
        number: 7,
      });
    });

    it('should not emit if no lobbyCode', () => {
      useGameStore.setState({ gameId: 'g1', lobbyCode: null });
      useGameStore.getState().chooseNumber(7);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('backToLobby', () => {
    it('should emit BACK_TO_LOBBY event', () => {
      useGameStore.getState().backToLobby();
      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:back_to_lobby');
    });
  });

  describe('initListeners', () => {
    it('should register game:state, game:result, game:error listeners', () => {
      useGameStore.setState({ lobbyCode: '123456' });
      const cleanup = useGameStore.getState().initListeners();

      expect(mockSocket.on).toHaveBeenCalledWith('game:state', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('game:result', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('game:error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('lobby:game_starting', expect.any(Function));

      cleanup();
      expect(mockSocket.off).toHaveBeenCalledWith('game:state', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('game:result', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('game:error', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('lobby:game_starting', expect.any(Function));
    });

    it('should request state on init when lobbyCode is set', () => {
      useGameStore.setState({ lobbyCode: '123456' });
      useGameStore.getState().initListeners();
      expect(mockSocket.emit).toHaveBeenCalledWith('game:request_state', { lobbyCode: '123456' });
    });

    it('should update state when game:state is received', () => {
      useGameStore.setState({ lobbyCode: '123456' });
      useGameStore.getState().initListeners();

      // Find the onState handler
      const onStateCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'game:state');
      const onState = onStateCall[1];

      onState({ gameId: 'g1', view: { phase: 'setup' } });
      expect(useGameStore.getState().gameId).toBe('g1');
      expect(useGameStore.getState().view).toEqual({ phase: 'setup' });
    });

    it('should set result when game:result is received', () => {
      useGameStore.setState({ lobbyCode: '123456' });
      useGameStore.getState().initListeners();

      const onResultCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'game:result');
      const onResult = onResultCall[1];

      const mockResult = { gameId: 'g1', winnerId: 'p1', winnerName: 'Alice', completedLines: {} };
      onResult(mockResult);
      expect(useGameStore.getState().result).toEqual(mockResult);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      useGameStore.setState({
        gameId: 'g1',
        lobbyCode: '123456',
        view: {} as any,
        result: {} as any,
        error: 'some error',
        nextPlaceNumber: 15,
      });

      useGameStore.getState().reset();

      const state = useGameStore.getState();
      expect(state.gameId).toBeNull();
      expect(state.lobbyCode).toBeNull();
      expect(state.view).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
      expect(state.nextPlaceNumber).toBe(1);
    });
  });
});
