/**
 * Tests for stores/chessStore.ts
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

import {
  useChessStore,
  selectMyColor,
  selectOrientation,
  selectIsMyTurn,
} from './chessStore';
import { CHESS_EVENTS, LOBBY_EVENTS, type ChessPlayerView } from '@/shared';

function makeView(overrides: Partial<ChessPlayerView> = {}): ChessPlayerView {
  return {
    gameId: 'g1',
    lobbyCode: '123456',
    role: 'white',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    turn: 'w',
    history: [],
    clocks: { whiteMs: 60000, blackMs: 60000, lastTickAt: 100 },
    timeControl: { baseMs: 60000, incrementMs: 0 },
    whitePlayerId: 'u1',
    blackPlayerId: 'u2',
    whiteName: 'Alice',
    blackName: 'Bob',
    status: 'in_progress',
    drawOffer: null,
    result: null,
    termination: null,
    spectatorCount: 0,
    ...overrides,
  };
}

describe('chessStore', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    useChessStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with nulls and connected=false', () => {
      const s = useChessStore.getState();
      expect(s.gameId).toBeNull();
      expect(s.lobbyCode).toBeNull();
      expect(s.role).toBeNull();
      expect(s.view).toBeNull();
      expect(s.pendingMove).toBeNull();
      expect(s.result).toBeNull();
      expect(s.connected).toBe(false);
    });
  });

  describe('setLobbyCode', () => {
    it('sets the lobby code', () => {
      useChessStore.getState().setLobbyCode('123456');
      expect(useChessStore.getState().lobbyCode).toBe('123456');
    });
  });

  describe('makeMove', () => {
    it('emits chess:move and sets pendingMove', () => {
      useChessStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useChessStore.getState().makeMove('e2', 'e4');
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.MOVE, {
        gameId: 'g1',
        lobbyCode: '123456',
        from: 'e2',
        to: 'e4',
      });
      expect(useChessStore.getState().pendingMove).toEqual({ from: 'e2', to: 'e4' });
    });

    it('includes promotion when provided', () => {
      useChessStore.setState({ gameId: 'g1', lobbyCode: '123456' });
      useChessStore.getState().makeMove('a7', 'a8', 'q');
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.MOVE, {
        gameId: 'g1',
        lobbyCode: '123456',
        from: 'a7',
        to: 'a8',
        promotion: 'q',
      });
    });

    it('does not emit without gameId', () => {
      useChessStore.setState({ gameId: null, lobbyCode: '123456' });
      useChessStore.getState().makeMove('e2', 'e4');
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('resign/offerDraw/respondDraw', () => {
    beforeEach(() => {
      useChessStore.setState({ gameId: 'g1', lobbyCode: '123456' });
    });

    it('resign emits chess:resign', () => {
      useChessStore.getState().resign();
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.RESIGN, {
        gameId: 'g1',
        lobbyCode: '123456',
      });
    });

    it('offerDraw emits chess:draw_offer', () => {
      useChessStore.getState().offerDraw();
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.DRAW_OFFER, {
        gameId: 'g1',
        lobbyCode: '123456',
      });
    });

    it('respondDraw emits chess:draw_response with payload', () => {
      useChessStore.getState().respondDraw('accept');
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.DRAW_RESPONSE, {
        gameId: 'g1',
        lobbyCode: '123456',
        response: 'accept',
      });
    });
  });

  describe('applyServerState', () => {
    it('sets gameId, role, view, clocks', () => {
      const view = makeView();
      useChessStore.getState().applyServerState({
        gameId: 'g1',
        role: 'white',
        view,
      });
      const s = useChessStore.getState();
      expect(s.gameId).toBe('g1');
      expect(s.role).toBe('white');
      expect(s.view).toEqual(view);
      expect(s.clocks).toEqual(view.clocks);
    });
  });

  describe('applyServerMove', () => {
    it('appends move, updates fen/pgn/turn/clocks, clears pendingMove', () => {
      const view = makeView();
      useChessStore.setState({
        view,
        pendingMove: { from: 'e2', to: 'e4' },
      });
      useChessStore.getState().applyServerMove({
        gameId: 'g1',
        move: {
          from: 'e2',
          to: 'e4',
          promotion: null,
          san: 'e4',
          color: 'w',
          captured: null,
        },
        fen: 'after-fen',
        pgn: '1. e4',
        turn: 'b',
        clocks: { whiteMs: 59000, blackMs: 60000, lastTickAt: 2000 },
        inCheck: false,
        halfmoveClock: 0,
        fullmoveNumber: 1,
      });
      const s = useChessStore.getState();
      expect(s.pendingMove).toBeNull();
      expect(s.view?.fen).toBe('after-fen');
      expect(s.view?.pgn).toBe('1. e4');
      expect(s.view?.turn).toBe('b');
      expect(s.view?.history).toHaveLength(1);
      expect(s.clocks?.whiteMs).toBe(59000);
    });
  });

  describe('applyClockTick', () => {
    it('replaces clocks with server timestamp', () => {
      useChessStore.getState().applyClockTick({
        gameId: 'g1',
        whiteMs: 10000,
        blackMs: 20000,
        turn: 'w',
        serverTs: 5000,
      });
      expect(useChessStore.getState().clocks).toEqual({
        whiteMs: 10000,
        blackMs: 20000,
        lastTickAt: 5000,
      });
    });
  });

  describe('applyMoveRejected', () => {
    it('clears pendingMove and sets localized error', () => {
      useChessStore.setState({ pendingMove: { from: 'e2', to: 'e4' } });
      useChessStore.getState().applyMoveRejected({
        gameId: 'g1',
        code: 'illegal_move',
        message: 'server message — ignored',
      });
      const s = useChessStore.getState();
      expect(s.pendingMove).toBeNull();
      expect(s.error).toBe('Illegal move.');
    });

    it('falls back to generic on unknown code', () => {
      useChessStore.getState().applyMoveRejected({
        gameId: 'g1',
        code: 'mysterious_code_from_server',
      });
      expect(useChessStore.getState().error).toBe('Something went wrong.');
    });
  });

  describe('setDrawOffer / setDrawDeclined', () => {
    it('setDrawOffer writes drawOffer on view', () => {
      useChessStore.setState({ view: makeView() });
      useChessStore.getState().setDrawOffer({ gameId: 'g1', by: 'b' });
      expect(useChessStore.getState().view?.drawOffer).toEqual({ by: 'b', active: true });
    });

    it('setDrawDeclined clears drawOffer', () => {
      useChessStore.setState({
        view: makeView({ drawOffer: { by: 'b', active: true } }),
      });
      useChessStore.getState().setDrawDeclined({ gameId: 'g1', by: 'b' });
      expect(useChessStore.getState().view?.drawOffer).toBeNull();
    });
  });

  describe('setGameOver', () => {
    it('sets result and freezes view to finished', () => {
      useChessStore.setState({ view: makeView() });
      useChessStore.getState().setGameOver({
        gameId: 'g1',
        result: '1-0',
        termination: 'checkmate',
        winnerId: 'u1',
        finalFen: 'final-fen',
        pgn: '1. e4 e5 ...',
        endedAt: 9999,
      });
      const s = useChessStore.getState();
      expect(s.result?.result).toBe('1-0');
      expect(s.result?.termination).toBe('checkmate');
      expect(s.view?.status).toBe('finished');
      expect(s.view?.fen).toBe('final-fen');
    });
  });

  describe('pending move helpers', () => {
    it('setPendingMove/clearPendingMove', () => {
      useChessStore.getState().setPendingMove({ from: 'a2', to: 'a3' });
      expect(useChessStore.getState().pendingMove).toEqual({ from: 'a2', to: 'a3' });
      useChessStore.getState().clearPendingMove();
      expect(useChessStore.getState().pendingMove).toBeNull();
    });
  });

  describe('setOrientation', () => {
    it('sets role', () => {
      useChessStore.getState().setOrientation('black');
      expect(useChessStore.getState().role).toBe('black');
    });
  });

  describe('initListeners', () => {
    it('subscribes to all chess events + lobby GAME_STARTING + connect/disconnect', () => {
      const cleanup = useChessStore.getState().initListeners();
      const names = mockSocket.on.mock.calls.map((c) => c[0]);
      expect(names).toEqual(
        expect.arrayContaining([
          CHESS_EVENTS.STATE,
          CHESS_EVENTS.MOVE_APPLIED,
          CHESS_EVENTS.MOVE_REJECTED,
          CHESS_EVENTS.CLOCK_TICK,
          CHESS_EVENTS.DRAW_OFFER,
          CHESS_EVENTS.DRAW_DECLINED,
          CHESS_EVENTS.GAME_OVER,
          LOBBY_EVENTS.GAME_STARTING,
          'connect',
          'disconnect',
        ]),
      );
      cleanup();
      expect(mockSocket.off).toHaveBeenCalled();
    });

    it('wires chess:state → applyServerState', () => {
      useChessStore.getState().initListeners();
      const handler = mockSocket.on.mock.calls.find(
        (c) => c[0] === CHESS_EVENTS.STATE,
      )![1];
      const view = makeView();
      handler({ gameId: 'g1', role: 'white', view });
      expect(useChessStore.getState().view).toEqual(view);
    });

    it('emits REJOIN if lobbyCode was set before init', () => {
      useChessStore.setState({ lobbyCode: '999999' });
      useChessStore.getState().initListeners();
      expect(mockSocket.emit).toHaveBeenCalledWith(CHESS_EVENTS.REJOIN, {
        lobbyCode: '999999',
      });
    });
  });

  describe('selectors', () => {
    it('selectMyColor returns color for seat, null for spectator', () => {
      useChessStore.setState({ role: 'white' });
      expect(selectMyColor(useChessStore.getState())).toBe('white');
      useChessStore.setState({ role: 'spectator' });
      expect(selectMyColor(useChessStore.getState())).toBeNull();
    });

    it('selectOrientation reflects role; spectators see white at bottom', () => {
      useChessStore.setState({ role: 'black' });
      expect(selectOrientation(useChessStore.getState())).toBe('black');
      useChessStore.setState({ role: 'spectator' });
      expect(selectOrientation(useChessStore.getState())).toBe('white');
    });

    it('selectIsMyTurn is true only on active in-progress + matching turn', () => {
      useChessStore.setState({ role: 'white', view: makeView({ turn: 'w' }) });
      expect(selectIsMyTurn(useChessStore.getState())).toBe(true);
      useChessStore.setState({ role: 'white', view: makeView({ turn: 'b' }) });
      expect(selectIsMyTurn(useChessStore.getState())).toBe(false);
      useChessStore.setState({
        role: 'white',
        view: makeView({ turn: 'w', status: 'finished' }),
      });
      expect(selectIsMyTurn(useChessStore.getState())).toBe(false);
      useChessStore.setState({ role: 'spectator', view: makeView({ turn: 'w' }) });
      expect(selectIsMyTurn(useChessStore.getState())).toBe(false);
    });
  });

  describe('out-of-order events', () => {
    // Covers the "FE chess store handles out-of-order events gracefully"
    // testing requirement: clock_tick / move_applied / game_over arriving
    // before the initial chess:state must not crash, and must not fabricate
    // a view out of thin air. Once state eventually arrives, the store
    // converges normally.
    it('does not crash when clock_tick or move_applied arrive before state', () => {
      // No initial state
      expect(useChessStore.getState().view).toBeNull();

      // clock_tick early: clocks get set, view stays null
      useChessStore.getState().applyClockTick({
        gameId: 'g1',
        whiteMs: 30000,
        blackMs: 30000,
        turn: 'w',
        serverTs: 100,
      });
      expect(useChessStore.getState().clocks).toEqual({
        whiteMs: 30000,
        blackMs: 30000,
        lastTickAt: 100,
      });
      expect(useChessStore.getState().view).toBeNull();

      // move_applied early: view stays null (no fabrication), no throw
      expect(() =>
        useChessStore.getState().applyServerMove({
          gameId: 'g1',
          move: { from: 'e2', to: 'e4', promotion: null, san: 'e4', color: 'w', captured: null },
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          pgn: '1. e4',
          turn: 'b',
          clocks: { whiteMs: 29000, blackMs: 30000, lastTickAt: 500 },
          inCheck: false,
          halfmoveClock: 0,
          fullmoveNumber: 1,
        }),
      ).not.toThrow();
      expect(useChessStore.getState().view).toBeNull();
      expect(useChessStore.getState().clocks?.whiteMs).toBe(29000);

      // game_over early: result recorded, view stays null (no synthetic board)
      expect(() =>
        useChessStore.getState().setGameOver({
          gameId: 'g1',
          result: '1-0',
          termination: 'checkmate',
          winnerId: 'u1',
          finalFen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1',
          pgn: '1. e4 e5 2. Qh5',
          endedAt: 1000,
        }),
      ).not.toThrow();
      expect(useChessStore.getState().result?.result).toBe('1-0');
      expect(useChessStore.getState().view).toBeNull();

      // Now the belated chess:state arrives → store converges
      useChessStore.getState().applyServerState({
        gameId: 'g1',
        role: 'white',
        view: makeView({ status: 'finished' }),
      });
      expect(useChessStore.getState().view?.status).toBe('finished');
      expect(useChessStore.getState().gameId).toBe('g1');
    });
  });

  describe('integration smoke: full server exchange', () => {
    // Drives a realistic sequence state → move_applied → clock_tick → game_over
    // through the store's own socket handlers to prove FE wiring matches the
    // shapes documented in .context/chess-game/bus/api-contracts.json.
    it('applies state, move_applied, clock_tick, and game_over in order', () => {
      useChessStore.getState().initListeners();

      const findHandler = (event: string) =>
        mockSocket.on.mock.calls.find((c) => c[0] === event)![1] as (
          data: unknown,
        ) => void;

      const onState = findHandler(CHESS_EVENTS.STATE);
      const onMoveApplied = findHandler(CHESS_EVENTS.MOVE_APPLIED);
      const onClockTick = findHandler(CHESS_EVENTS.CLOCK_TICK);
      const onGameOver = findHandler(CHESS_EVENTS.GAME_OVER);

      const view = makeView();
      onState({ gameId: 'g1', role: 'white', view });
      expect(useChessStore.getState().gameId).toBe('g1');
      expect(useChessStore.getState().role).toBe('white');

      onMoveApplied({
        gameId: 'g1',
        move: {
          from: 'e2',
          to: 'e4',
          promotion: null,
          san: 'e4',
          color: 'w',
          captured: null,
        },
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        pgn: '1. e4',
        turn: 'b',
        clocks: { whiteMs: 59000, blackMs: 60000, lastTickAt: 1000 },
        inCheck: false,
        halfmoveClock: 0,
        fullmoveNumber: 1,
      });
      expect(useChessStore.getState().view?.turn).toBe('b');
      expect(useChessStore.getState().view?.history).toHaveLength(1);
      expect(useChessStore.getState().clocks?.whiteMs).toBe(59000);

      onClockTick({
        gameId: 'g1',
        whiteMs: 58500,
        blackMs: 60000,
        turn: 'b',
        serverTs: 1500,
      });
      expect(useChessStore.getState().clocks).toEqual({
        whiteMs: 58500,
        blackMs: 60000,
        lastTickAt: 1500,
      });

      onGameOver({
        gameId: 'g1',
        result: '1-0',
        termination: 'checkmate',
        winnerId: 'u1',
        finalFen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1',
        pgn: '1. e4 e5 2. Qh5',
        endedAt: 2000,
      });
      expect(useChessStore.getState().result?.result).toBe('1-0');
      expect(useChessStore.getState().result?.termination).toBe('checkmate');
      expect(useChessStore.getState().view?.status).toBe('finished');
    });
  });

  describe('reset', () => {
    it('resets to INITIAL', () => {
      useChessStore.setState({
        gameId: 'g1',
        lobbyCode: '123456',
        role: 'white',
        view: makeView(),
        clocks: { whiteMs: 1, blackMs: 1, lastTickAt: 1 },
        pendingMove: { from: 'e2', to: 'e4' },
        error: 'err',
      });
      useChessStore.getState().reset();
      const s = useChessStore.getState();
      expect(s.gameId).toBeNull();
      expect(s.lobbyCode).toBeNull();
      expect(s.role).toBeNull();
      expect(s.view).toBeNull();
      expect(s.clocks).toBeNull();
      expect(s.pendingMove).toBeNull();
      expect(s.error).toBeNull();
    });
  });
});
