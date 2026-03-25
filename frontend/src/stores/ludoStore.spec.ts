/**
 * Tests for stores/ludoStore.ts
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

import { useLudoStore } from './ludoStore';
import { GAME_EVENTS, LUDO_EVENTS, LOBBY_EVENTS } from '@/shared';

describe('LudoStore', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    useLudoStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have null gameId', () => {
      expect(useLudoStore.getState().gameId).toBeNull();
    });

    it('should have null lobbyCode', () => {
      expect(useLudoStore.getState().lobbyCode).toBeNull();
    });

    it('should have null view', () => {
      expect(useLudoStore.getState().view).toBeNull();
    });

    it('should have null result', () => {
      expect(useLudoStore.getState().result).toBeNull();
    });

    it('should have null error', () => {
      expect(useLudoStore.getState().error).toBeNull();
    });

    it('should have diceRolling false', () => {
      expect(useLudoStore.getState().diceRolling).toBe(false);
    });
  });

  describe('setLobbyCode', () => {
    it('should set the lobby code', () => {
      useLudoStore.getState().setLobbyCode('ABC123');
      expect(useLudoStore.getState().lobbyCode).toBe('ABC123');
    });
  });

  describe('rollDice', () => {
    it('should emit ROLL_DICE event', () => {
      useLudoStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useLudoStore.getState().rollDice();

      expect(mockSocket.emit).toHaveBeenCalledWith(LUDO_EVENTS.ROLL_DICE, {
        gameId: 'g1',
        lobbyCode: '123456',
      });
      expect(useLudoStore.getState().diceRolling).toBe(true);
    });

    it('should not emit if no gameId', () => {
      useLudoStore.setState({ gameId: null, lobbyCode: '123456' });
      useLudoStore.getState().rollDice();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should not emit if no lobbyCode', () => {
      useLudoStore.setState({ gameId: 'g1', lobbyCode: null });
      useLudoStore.getState().rollDice();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('moveToken', () => {
    it('should emit MOVE_TOKEN event with moves', () => {
      useLudoStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      const moves = [{ tokenId: 0, steps: 6 }];
      useLudoStore.getState().moveToken(moves);

      expect(mockSocket.emit).toHaveBeenCalledWith(LUDO_EVENTS.MOVE_TOKEN, {
        gameId: 'g1',
        lobbyCode: '123456',
        moves,
      });
    });

    it('should not emit if no gameId', () => {
      useLudoStore.setState({ gameId: null, lobbyCode: '123456' });
      useLudoStore.getState().moveToken([{ tokenId: 0, steps: 3 }]);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('initListeners', () => {
    it('should register socket listeners', () => {
      useLudoStore.getState().initListeners();

      expect(mockSocket.on).toHaveBeenCalledWith(GAME_EVENTS.STATE, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(GAME_EVENTS.RESULT, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(GAME_EVENTS.ERROR, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(LOBBY_EVENTS.GAME_STARTING, expect.any(Function));
    });

    it('should return a cleanup function that removes listeners', () => {
      const cleanup = useLudoStore.getState().initListeners();
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockSocket.off).toHaveBeenCalledWith(GAME_EVENTS.STATE, expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith(GAME_EVENTS.RESULT, expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith(GAME_EVENTS.ERROR, expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith(LOBBY_EVENTS.GAME_STARTING, expect.any(Function));
    });

    it('should update state on STATE event with ludo gameType', () => {
      useLudoStore.getState().initListeners();

      const onState = mockSocket.on.mock.calls.find(
        (call: [string, Function]) => call[0] === GAME_EVENTS.STATE,
      )![1];

      const mockView = {
        myColor: 'red',
        players: [],
        currentTurn: 'p1',
        dice: null,
        phase: 'rolling',
        availableMoves: null,
        rankings: [],
        winnerId: null,
        winnerName: null,
        playerNames: {},
        isMyTurn: true,
      };

      onState({ gameId: 'g1', view: mockView, gameType: 'ludo' });
      expect(useLudoStore.getState().gameId).toBe('g1');
      expect(useLudoStore.getState().view).toEqual(mockView);
    });

    it('should ignore STATE events from non-ludo games', () => {
      useLudoStore.getState().initListeners();

      const onState = mockSocket.on.mock.calls.find(
        (call: [string, Function]) => call[0] === GAME_EVENTS.STATE,
      )![1];

      onState({ gameId: 'g1', view: {}, gameType: 'bingo' });
      expect(useLudoStore.getState().gameId).toBeNull();
    });

    it('should set result on RESULT event', () => {
      useLudoStore.getState().initListeners();

      const onResult = mockSocket.on.mock.calls.find(
        (call: [string, Function]) => call[0] === GAME_EVENTS.RESULT,
      )![1];

      const mockResult = { gameId: 'g1', winnerId: 'p1', winnerName: 'A', rankings: ['p1', 'p2'] };
      onResult(mockResult);
      expect(useLudoStore.getState().result).toEqual(mockResult);
    });

    it('should set error on ERROR event', () => {
      useLudoStore.getState().initListeners();

      const onError = mockSocket.on.mock.calls.find(
        (call: [string, Function]) => call[0] === GAME_EVENTS.ERROR,
      )![1];

      onError({ message: 'Something went wrong' });
      expect(useLudoStore.getState().error).toBe('Something went wrong');
      expect(useLudoStore.getState().diceRolling).toBe(false);
    });

    it('should emit REQUEST_STATE if lobbyCode is set', () => {
      useLudoStore.setState({ lobbyCode: '999999' });
      useLudoStore.getState().initListeners();

      expect(mockSocket.emit).toHaveBeenCalledWith(GAME_EVENTS.REQUEST_STATE, {
        lobbyCode: '999999',
      });
    });
  });

  describe('requestGameState', () => {
    it('should emit REQUEST_STATE with lobbyCode', async () => {
      useLudoStore.setState({ lobbyCode: '777777' });
      await useLudoStore.getState().requestGameState();

      expect(mockSocket.emit).toHaveBeenCalledWith(GAME_EVENTS.REQUEST_STATE, {
        lobbyCode: '777777',
      });
    });

    it('should not emit if no lobbyCode', async () => {
      await useLudoStore.getState().requestGameState();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useLudoStore.setState({
        gameId: 'g1',
        lobbyCode: '123',
        view: {} as any,
        result: {} as any,
        error: 'err',
        diceRolling: true,
      });

      useLudoStore.getState().reset();
      const state = useLudoStore.getState();
      expect(state.gameId).toBeNull();
      expect(state.lobbyCode).toBeNull();
      expect(state.view).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
      expect(state.diceRolling).toBe(false);
    });
  });
});
