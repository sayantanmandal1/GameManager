import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  LOBBY_EVENTS,
  type Lobby,
  type GameType,
} from '@/shared';

interface LobbyState {
  lobby: Lobby | null;
  error: string | null;
  isLoading: boolean;
  createLobby: (gameType: GameType) => Promise<void>;
  joinLobby: (code: string) => Promise<void>;
  leaveLobby: () => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  initListeners: () => () => void;
  reset: () => void;
}

export const useLobbyStore = create<LobbyState>()((set, get) => ({
  lobby: null,
  error: null,
  isLoading: false,

  createLobby: async (gameType: GameType) => {
    set({ isLoading: true, error: null });
    try {
      const socket = await waitForSocket();
      if (!socket) {
        set({ error: 'Not connected to server. Please try again.', isLoading: false });
        return;
      }
      socket.emit(LOBBY_EVENTS.CREATE, { gameType });
    } catch {
      set({ error: 'Connection failed. Please try again.', isLoading: false });
    }
  },

  joinLobby: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      const socket = await waitForSocket();
      if (!socket) {
        set({ error: 'Not connected to server. Please try again.', isLoading: false });
        return;
      }
      socket.emit(LOBBY_EVENTS.JOIN, { code });
    } catch {
      set({ error: 'Connection failed. Please try again.', isLoading: false });
    }
  },

  leaveLobby: () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.LEAVE);
    set({ lobby: null });
  },

  setReady: (ready: boolean) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.PLAYER_READY, { ready });
  },

  startGame: () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.START_GAME);
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const onState = (data: { lobby: Lobby }) => {
      set({ lobby: data.lobby, isLoading: false });
    };

    const onError = (data: { message: string }) => {
      set({ error: data.message, isLoading: false });
    };

    socket.on(LOBBY_EVENTS.STATE, onState);
    socket.on(LOBBY_EVENTS.ERROR, onError);

    return () => {
      socket.off(LOBBY_EVENTS.STATE, onState);
      socket.off(LOBBY_EVENTS.ERROR, onError);
    };
  },

  reset: () => set({ lobby: null, error: null, isLoading: false }),
}));
