import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import {
  DISTINCT_GAME_EVENTS,
  GAME_EVENTS,
  type DistinctGameAction,
  type DistinctGameKey,
  type DistinctGamePlayerView,
  type DistinctGameResult,
} from '@/shared';

interface DistinctGameStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  expectedGameKey: DistinctGameKey | null;
  gameKey: DistinctGameKey | null;
  view: DistinctGamePlayerView | null;
  result: DistinctGameResult | null;
  error: string | null;
  setSession: (lobbyCode: string, gameKey: DistinctGameKey) => void;
  act: (action: DistinctGameAction) => void;
  surrender: () => void;
  initListeners: () => () => void;
  reset: () => void;
}

const INITIAL = {
  gameId: null,
  lobbyCode: null,
  expectedGameKey: null,
  gameKey: null,
  view: null,
  result: null,
  error: null,
};

export const useDistinctGameStore = create<DistinctGameStoreState>()((set, get) => ({
  ...INITIAL,
  setSession: (lobbyCode, expectedGameKey) =>
    set((state) =>
      state.lobbyCode === lobbyCode && state.expectedGameKey === expectedGameKey
        ? state
        : { ...INITIAL, lobbyCode, expectedGameKey },
    ),
  act: (action) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    socket.emit(DISTINCT_GAME_EVENTS.ACTION, { gameId, lobbyCode, action });
  },
  surrender: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(GAME_EVENTS.SURRENDER, { gameId, lobbyCode });
  },
  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};
    const onState = (payload: {
      gameId: string;
      lobbyCode: string;
      gameKey: DistinctGameKey;
      view: DistinctGamePlayerView;
    }) => {
      const current = get();
      if (
        payload.lobbyCode !== current.lobbyCode ||
        payload.gameKey !== current.expectedGameKey
      ) {
        return;
      }
      set((state) => ({
        gameId: payload.gameId,
        gameKey: payload.gameKey,
        view: payload.view,
        result: state.gameId && state.gameId !== payload.gameId ? null : state.result,
        error: null,
      }));
    };
    const onResult = (payload: {
      gameId: string;
      gameKey: DistinctGameKey;
      result: DistinctGameResult;
    }) => {
      if (payload.gameId === get().gameId && payload.gameKey === get().gameKey) {
        set({ result: payload.result });
      }
    };
    const onError = (payload: { message: string }) => set({ error: payload.message });
    const requestState = () => {
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
    };
    socket.on(DISTINCT_GAME_EVENTS.STATE, onState);
    socket.on(DISTINCT_GAME_EVENTS.RESULT, onResult);
    socket.on(DISTINCT_GAME_EVENTS.ERROR, onError);
    socket.on('connect', requestState);
    requestState();
    return () => {
      socket.off(DISTINCT_GAME_EVENTS.STATE, onState);
      socket.off(DISTINCT_GAME_EVENTS.RESULT, onResult);
      socket.off(DISTINCT_GAME_EVENTS.ERROR, onError);
      socket.off('connect', requestState);
    };
  },
  reset: () => set({ ...INITIAL }),
}));