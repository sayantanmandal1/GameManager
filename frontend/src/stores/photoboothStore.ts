import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  PHOTOBOOTH_EVENTS,
  GAME_EVENTS,
  LOBBY_EVENTS,
  type PhotoboothPlayerView,
  type PhotoboothLayout,
  type PhotoboothThemeId,
  type PhotoboothFilter,
} from '@/shared';

interface PhotoboothStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: PhotoboothPlayerView | null;
  error: string | null;
  connected: boolean;
  /** Set true once the strip is complete (drives the reveal + confetti). */
  complete: boolean;

  // Client → server (emit-only). SECURITY_NOTE: components MUST NOT call
  // socket.emit directly — always go through these typed actions.
  setLobbyCode: (code: string) => void;
  requestState: () => Promise<void>;
  configure: (layout: PhotoboothLayout, theme: PhotoboothThemeId) => void;
  startCapture: () => void;
  capture: (image: string) => void;
  retake: () => void;
  confirm: () => void;
  setFilter: (filter: PhotoboothFilter) => void;

  // Server → store (exposed for tests)
  applyState: (payload: { gameId: string; view: PhotoboothPlayerView }) => void;

  initListeners: () => () => void;
  reset: () => void;
}

const INITIAL = {
  gameId: null,
  lobbyCode: null,
  view: null,
  error: null,
  connected: false,
  complete: false,
} satisfies Partial<PhotoboothStoreState>;

export const usePhotoboothStore = create<PhotoboothStoreState>()((set, get) => ({
  ...INITIAL,

  setLobbyCode: (code) => set({ lobbyCode: code }),

  requestState: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    if (!socket) return;
    socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
  },

  configure: (layout, theme) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(PHOTOBOOTH_EVENTS.CONFIGURE, { gameId, lobbyCode, layout, theme });
  },

  startCapture: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(PHOTOBOOTH_EVENTS.START_CAPTURE, { gameId, lobbyCode });
  },

  capture: (image) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    socket.emit(PHOTOBOOTH_EVENTS.CAPTURE, { gameId, lobbyCode, image });
  },

  retake: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(PHOTOBOOTH_EVENTS.RETAKE, { gameId, lobbyCode });
  },

  confirm: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(PHOTOBOOTH_EVENTS.CONFIRM, { gameId, lobbyCode });
  },

  setFilter: (filter) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(PHOTOBOOTH_EVENTS.SET_FILTER, { gameId, lobbyCode, filter });
  },

  applyState: (payload) => {
    set({
      gameId: payload.gameId,
      view: payload.view,
      error: null,
    });
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const onState = (data: { gameId: string; view: PhotoboothPlayerView }) => {
      get().applyState(data);
    };
    const onComplete = () => set({ complete: true });
    const onError = (data: { message: string }) => set({ error: data.message });
    const onGameStarting = () => set({ error: null, complete: false });
    const onConnect = () => {
      set({ connected: true });
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
    };
    const onDisconnect = () => set({ connected: false });

    socket.on(PHOTOBOOTH_EVENTS.STATE, onState);
    socket.on(PHOTOBOOTH_EVENTS.COMPLETE, onComplete);
    socket.on(GAME_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Pull fresh state on mount (covers a missed initial broadcast after
    // navigation from the lobby).
    const { lobbyCode } = get();
    if (lobbyCode) socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });

    return () => {
      socket.off(PHOTOBOOTH_EVENTS.STATE, onState);
      socket.off(PHOTOBOOTH_EVENTS.COMPLETE, onComplete);
      socket.off(GAME_EVENTS.ERROR, onError);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  },

  reset: () => set({ ...INITIAL }),
}));
