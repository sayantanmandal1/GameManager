import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  GAME_EVENTS,
  TICTACTOE_EVENTS,
  type TicTacToeAction,
  type TicTacToePlayerView,
  type TicTacToeResult,
} from '@/shared';

interface TicTacToeStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: TicTacToePlayerView | null;
  result: TicTacToeResult | null;
  error: string | null;
  setLobbyCode: (lobbyCode: string) => void;
  requestState: () => Promise<void>;
  move: (action: TicTacToeAction) => void;
  surrender: () => void;
  applyState: (payload: {
    gameId: string;
    lobbyCode: string;
    view: TicTacToePlayerView;
  }) => void;
  initListeners: () => () => void;
  reset: () => void;
}

const INITIAL = {
  gameId: null,
  lobbyCode: null,
  view: null,
  result: null,
  error: null,
};

export const useTicTacToeStore = create<TicTacToeStoreState>()((set, get) => ({
  ...INITIAL,

  setLobbyCode: (lobbyCode) =>
    set((state) =>
      state.lobbyCode === lobbyCode
        ? state
        : { ...INITIAL, lobbyCode },
    ),

  requestState: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    socket?.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
  },

  move: (action) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    socket.emit(TICTACTOE_EVENTS.MOVE, { gameId, lobbyCode, ...action });
  },

  surrender: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(GAME_EVENTS.SURRENDER, { gameId, lobbyCode });
  },

  applyState: (payload) => {
    if (!get().lobbyCode || payload.lobbyCode !== get().lobbyCode) return;
    set((state) => ({
      gameId: payload.gameId,
      view: payload.view,
      result: state.gameId && state.gameId !== payload.gameId ? null : state.result,
      error: null,
    }));
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};
    const onState = (payload: {
      gameId: string;
      lobbyCode: string;
      view: TicTacToePlayerView;
    }) => get().applyState(payload);
    const onResult = (payload: {
      gameId: string;
      result: TicTacToeResult;
    }) => {
      if (payload.gameId !== get().gameId) return;
      set({ result: payload.result });
    };
    const onError = (payload: { message: string }) => set({ error: payload.message });
    const onConnect = () => {
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
    };
    socket.on(TICTACTOE_EVENTS.STATE, onState);
    socket.on(TICTACTOE_EVENTS.RESULT, onResult);
    socket.on(TICTACTOE_EVENTS.ERROR, onError);
    socket.on('connect', onConnect);
    onConnect();
    return () => {
      socket.off(TICTACTOE_EVENTS.STATE, onState);
      socket.off(TICTACTOE_EVENTS.RESULT, onResult);
      socket.off(TICTACTOE_EVENTS.ERROR, onError);
      socket.off('connect', onConnect);
    };
  },

  reset: () => set({ ...INITIAL }),
}));