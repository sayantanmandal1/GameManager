import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  CHESS_EVENTS,
  LOBBY_EVENTS,
  type ChessPlayerView,
  type ChessClocks,
  type ChessMove,
  type ChessResult,
  type ChessTermination,
} from '@/shared';
import { errorStringFor } from '@/components/chess/strings';

export type ChessRole = 'white' | 'black' | 'spectator';

export interface ChessGameResult {
  result: Exclude<ChessResult, null>;
  termination: ChessTermination;
  winnerId: string | null;
  finalFen: string;
  pgn: string;
  endedAt: number;
}

interface ChessStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  role: ChessRole | null;
  view: ChessPlayerView | null;
  clocks: ChessClocks | null;
  pendingMove: { from: string; to: string } | null;
  promotion: { from: string; to: string; color: 'w' | 'b' } | null;
  result: ChessGameResult | null;
  error: string | null;
  connected: boolean;

  // Emit-only (client → server)
  setLobbyCode: (code: string) => void;
  requestRejoin: () => Promise<void>;
  sendRejoin: () => void;
  sendSpectate: () => Promise<void>;
  makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  openPromotion: (from: string, to: string, color: 'w' | 'b') => void;
  cancelPromotion: () => void;
  resign: () => void;
  offerDraw: () => void;
  respondDraw: (response: 'accept' | 'decline') => void;

  // Server → store (also exposed for tests)
  applyServerState: (payload: {
    gameId: string;
    role: ChessRole;
    view: ChessPlayerView;
  }) => void;
  applyServerMove: (payload: {
    gameId: string;
    move: ChessMove;
    fen: string;
    pgn: string;
    turn: 'w' | 'b';
    clocks: ChessClocks;
    inCheck: boolean;
    halfmoveClock: number;
    fullmoveNumber: number;
  }) => void;
  applyClockTick: (payload: {
    gameId: string;
    whiteMs: number;
    blackMs: number;
    turn: 'w' | 'b';
    serverTs: number;
  }) => void;
  applyMoveRejected: (payload: { gameId: string; code: string; message?: string }) => void;
  setDrawOffer: (payload: { gameId: string; by: 'w' | 'b'; byUserId?: string }) => void;
  setDrawDeclined: (payload: { gameId: string; by: 'w' | 'b' }) => void;
  setGameOver: (payload: {
    gameId: string;
    result: Exclude<ChessResult, null>;
    termination: ChessTermination;
    winnerId: string | null;
    finalFen: string;
    pgn: string;
    endedAt: number;
  }) => void;
  setPendingMove: (square: { from: string; to: string } | null) => void;
  clearPendingMove: () => void;
  setOrientation: (color: ChessRole) => void;

  initListeners: () => () => void;
  reset: () => void;
}

const INITIAL: Pick<
  ChessStoreState,
  | 'gameId'
  | 'lobbyCode'
  | 'role'
  | 'view'
  | 'clocks'
  | 'pendingMove'
  | 'promotion'
  | 'result'
  | 'error'
  | 'connected'
> = {
  gameId: null,
  lobbyCode: null,
  role: null,
  view: null,
  clocks: null,
  pendingMove: null,
  promotion: null,
  result: null,
  error: null,
  connected: false,
};

export const useChessStore = create<ChessStoreState>()((set, get) => ({
  ...INITIAL,

  setLobbyCode: (code) => set({ lobbyCode: code }),

  requestRejoin: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    if (!socket) return;
    socket.emit(CHESS_EVENTS.REJOIN, { lobbyCode });
  },

  sendRejoin: () => {
    const socket = getSocket();
    const { lobbyCode } = get();
    if (!socket || !lobbyCode) return;
    socket.emit(CHESS_EVENTS.REJOIN, { lobbyCode });
  },

  sendSpectate: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    if (!socket) return;
    socket.emit(CHESS_EVENTS.SPECTATE, { lobbyCode });
  },

  makeMove: (from, to, promotion) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ pendingMove: { from, to }, error: null });
    const payload: Record<string, unknown> = { gameId, lobbyCode, from, to };
    if (promotion) payload.promotion = promotion;
    socket.emit(CHESS_EVENTS.MOVE, payload);
  },

  openPromotion: (from, to, color) => set({ promotion: { from, to, color } }),
  cancelPromotion: () => set({ promotion: null, pendingMove: null }),

  resign: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(CHESS_EVENTS.RESIGN, { gameId, lobbyCode });
  },

  offerDraw: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(CHESS_EVENTS.DRAW_OFFER, { gameId, lobbyCode });
  },

  respondDraw: (response) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(CHESS_EVENTS.DRAW_RESPONSE, { gameId, lobbyCode, response });
  },

  applyServerState: (payload) => {
    set({
      gameId: payload.gameId,
      role: payload.role,
      view: payload.view,
      clocks: payload.view.clocks,
      pendingMove: null,
      error: null,
    });
  },

  applyServerMove: (payload) => {
    const view = get().view;
    set({
      pendingMove: null,
      error: null,
      clocks: payload.clocks,
      view: view
        ? {
            ...view,
            fen: payload.fen,
            pgn: payload.pgn,
            turn: payload.turn,
            history: [...view.history, payload.move],
            clocks: payload.clocks,
          }
        : view,
    });
  },

  applyClockTick: (payload) => {
    set({
      clocks: {
        whiteMs: payload.whiteMs,
        blackMs: payload.blackMs,
        lastTickAt: payload.serverTs,
      },
    });
  },

  applyMoveRejected: (payload) => {
    set({ pendingMove: null, error: errorStringFor(payload.code) });
  },

  setDrawOffer: (payload) => {
    const view = get().view;
    if (!view) return;
    set({
      view: { ...view, drawOffer: { by: payload.by, active: true } },
    });
  },

  setDrawDeclined: () => {
    const view = get().view;
    if (!view) return;
    set({ view: { ...view, drawOffer: null } });
  },

  setGameOver: (payload) => {
    const view = get().view;
    set({
      result: {
        result: payload.result,
        termination: payload.termination,
        winnerId: payload.winnerId,
        finalFen: payload.finalFen,
        pgn: payload.pgn,
        endedAt: payload.endedAt,
      },
      view: view
        ? {
            ...view,
            fen: payload.finalFen,
            pgn: payload.pgn,
            status: 'finished',
            result: payload.result,
            termination: payload.termination,
            drawOffer: null,
          }
        : view,
    });
  },

  setPendingMove: (square) => set({ pendingMove: square }),
  clearPendingMove: () => set({ pendingMove: null }),

  setOrientation: (role) => set({ role }),

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const {
      applyServerState,
      applyServerMove,
      applyClockTick,
      applyMoveRejected,
      setDrawOffer,
      setDrawDeclined,
      setGameOver,
    } = get();

    const onState = (data: Parameters<ChessStoreState['applyServerState']>[0]) => {
      applyServerState(data);
    };
    const onMoveApplied = (data: Parameters<ChessStoreState['applyServerMove']>[0]) => {
      applyServerMove(data);
    };
    const onMoveRejected = (data: Parameters<ChessStoreState['applyMoveRejected']>[0]) => {
      applyMoveRejected(data);
    };
    const onClockTick = (data: Parameters<ChessStoreState['applyClockTick']>[0]) => {
      applyClockTick(data);
    };
    const onDrawOffer = (data: Parameters<ChessStoreState['setDrawOffer']>[0]) => {
      setDrawOffer(data);
    };
    const onDrawDeclined = (data: Parameters<ChessStoreState['setDrawDeclined']>[0]) => {
      setDrawDeclined(data);
    };
    const onGameOver = (data: Parameters<ChessStoreState['setGameOver']>[0]) => {
      setGameOver(data);
    };
    const onGameStarting = () => {
      set({ result: null, error: null, pendingMove: null });
    };
    const onConnect = () => {
      set({ connected: true });
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(CHESS_EVENTS.REJOIN, { lobbyCode });
    };
    const onDisconnect = () => {
      set({ connected: false, error: errorStringFor('disconnected') });
    };

    socket.on(CHESS_EVENTS.STATE, onState);
    socket.on(CHESS_EVENTS.MOVE_APPLIED, onMoveApplied);
    socket.on(CHESS_EVENTS.MOVE_REJECTED, onMoveRejected);
    socket.on(CHESS_EVENTS.CLOCK_TICK, onClockTick);
    socket.on(CHESS_EVENTS.DRAW_OFFER, onDrawOffer);
    socket.on(CHESS_EVENTS.DRAW_DECLINED, onDrawDeclined);
    socket.on(CHESS_EVENTS.GAME_OVER, onGameOver);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const { lobbyCode } = get();
    if (lobbyCode) socket.emit(CHESS_EVENTS.REJOIN, { lobbyCode });

    return () => {
      socket.off(CHESS_EVENTS.STATE, onState);
      socket.off(CHESS_EVENTS.MOVE_APPLIED, onMoveApplied);
      socket.off(CHESS_EVENTS.MOVE_REJECTED, onMoveRejected);
      socket.off(CHESS_EVENTS.CLOCK_TICK, onClockTick);
      socket.off(CHESS_EVENTS.DRAW_OFFER, onDrawOffer);
      socket.off(CHESS_EVENTS.DRAW_DECLINED, onDrawDeclined);
      socket.off(CHESS_EVENTS.GAME_OVER, onGameOver);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  },

  reset: () => set({ ...INITIAL }),
}));

// ─── Selectors ─────────────────────────────────────────────────────────────
export const selectMyColor = (s: ChessStoreState): 'white' | 'black' | null =>
  s.role === 'white' || s.role === 'black' ? s.role : null;

export const selectOrientation = (s: ChessStoreState): 'white' | 'black' =>
  s.role === 'black' ? 'black' : 'white';

export const selectIsMyTurn = (s: ChessStoreState): boolean => {
  if (!s.view || !s.role || s.role === 'spectator') return false;
  if (s.view.status !== 'in_progress') return false;
  return s.view.turn === (s.role === 'white' ? 'w' : 'b');
};
