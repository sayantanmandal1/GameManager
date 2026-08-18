import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  ARCADE_EVENTS,
  GAME_EVENTS,
  type ArcadeAction,
  type ArcadePlayerView,
  type ArcadeResult,
} from '@/shared';

interface ArcadeStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: ArcadePlayerView | null;
  result: ArcadeResult | null;
  error: string | null;
  setLobbyCode: (lobbyCode: string) => void;
  action: (action: ArcadeAction) => void;
  surrender: () => void;
  requestState: () => Promise<void>;
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

export const useArcadeStore = create<ArcadeStoreState>()((set, get) => ({
  ...INITIAL,

  setLobbyCode: (lobbyCode) =>
    set((state) => state.lobbyCode === lobbyCode ? state : { ...INITIAL, lobbyCode }),

  action: (action) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    socket.emit(ARCADE_EVENTS.ACTION, { gameId, lobbyCode, action });
  },

  surrender: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(GAME_EVENTS.SURRENDER, { gameId, lobbyCode });
  },

  requestState: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    socket?.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};
    const onState = (payload: {
      gameId: string;
      lobbyCode: string;
      view: ArcadePlayerView;
    }) => {
      if (payload.lobbyCode !== get().lobbyCode) return;
      set({ gameId: payload.gameId, view: payload.view, result: null, error: null });
    };
    const onResult = (payload: { gameId: string; result: ArcadeResult }) => {
      if (payload.gameId !== get().gameId) return;
      set({ result: payload.result });
    };
    const onError = (payload: { message: string }) => set({ error: payload.message });
    const onConnect = () => void get().requestState();

    socket.on(ARCADE_EVENTS.STATE, onState);
    socket.on(ARCADE_EVENTS.RESULT, onResult);
    socket.on(ARCADE_EVENTS.ERROR, onError);
    socket.on('connect', onConnect);
    onConnect();

    return () => {
      socket.off(ARCADE_EVENTS.STATE, onState);
      socket.off(ARCADE_EVENTS.RESULT, onResult);
      socket.off(ARCADE_EVENTS.ERROR, onError);
      socket.off('connect', onConnect);
    };
  },

  reset: () => set({ ...INITIAL }),
}));
