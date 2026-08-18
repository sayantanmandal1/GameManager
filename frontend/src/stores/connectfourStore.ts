import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  CONNECTFOUR_EVENTS,
  GAME_EVENTS,
  type ConnectFourPlayerView,
  type ConnectFourResult,
} from '@/shared';

interface ConnectFourStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: ConnectFourPlayerView | null;
  result: ConnectFourResult | null;
  error: string | null;
  setLobbyCode: (code: string) => void;
  drop: (column: number) => void;
  surrender: () => void;
  applyState: (payload: {
    gameId: string;
    lobbyCode: string;
    view: ConnectFourPlayerView;
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

export const useConnectFourStore = create<ConnectFourStoreState>()((set, get) => ({
  ...INITIAL,
  setLobbyCode: (lobbyCode) =>
    set((state) => (state.lobbyCode === lobbyCode ? state : { ...INITIAL, lobbyCode })),
  drop: (column) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    socket.emit(CONNECTFOUR_EVENTS.DROP, { gameId, lobbyCode, column });
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
      view: ConnectFourPlayerView;
    }) => get().applyState(payload);
    const onResult = (payload: { gameId: string; result: ConnectFourResult }) => {
      if (payload.gameId === get().gameId) set({ result: payload.result });
    };
    const onError = (payload: { message: string }) => set({ error: payload.message });
    const requestState = () => {
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
    };
    socket.on(CONNECTFOUR_EVENTS.STATE, onState);
    socket.on(CONNECTFOUR_EVENTS.RESULT, onResult);
    socket.on(CONNECTFOUR_EVENTS.ERROR, onError);
    socket.on('connect', requestState);
    requestState();
    return () => {
      socket.off(CONNECTFOUR_EVENTS.STATE, onState);
      socket.off(CONNECTFOUR_EVENTS.RESULT, onResult);
      socket.off(CONNECTFOUR_EVENTS.ERROR, onError);
      socket.off('connect', requestState);
    };
  },
  reset: () => set({ ...INITIAL }),
}));