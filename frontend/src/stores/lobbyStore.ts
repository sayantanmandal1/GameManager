import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  LOBBY_EVENTS,
  type Lobby,
  type GameType,
  type LobbyTeam,
} from '@/shared';

interface LobbyState {
  lobby: Lobby | null;
  error: string | null;
  isLoading: boolean;
  removedFromLobby: string | null;
  createLobby: (gameType: GameType, gameKey?: Lobby['gameKey']) => Promise<void>;
  joinLobby: (code: string) => Promise<void>;
  leaveLobby: () => void;
  setReady: (ready: boolean) => void;
  selectTeam: (team: LobbyTeam) => void;
  removePlayer: (targetUserId: string) => void;
  startGame: () => void;
  initListeners: () => () => void;
  reset: () => void;
}

export const useLobbyStore = create<LobbyState>()((set) => ({
  lobby: null,
  error: null,
  isLoading: false,
  removedFromLobby: null,

  createLobby: async (gameType: GameType, gameKey = null) => {
    set({ isLoading: true, error: null });
    try {
      const socket = await waitForSocket();
      if (!socket) {
        set({ error: 'Not connected to server. Please try again.', isLoading: false });
        return;
      }
      socket.emit(
        LOBBY_EVENTS.CREATE,
        gameKey ? { gameType, gameKey } : { gameType },
      );
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

  selectTeam: (team: LobbyTeam) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.TEAM_SELECT, { team });
  },

  removePlayer: (targetUserId: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.REMOVE_PLAYER, { targetUserId });
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
      set({ lobby: data.lobby, isLoading: false, removedFromLobby: null });
    };

    const onError = (data: { message: string }) => {
      set({ error: data.message, isLoading: false });
    };

    const onRemoved = (data: { lobbyCode: string }) => {
      set({ lobby: null, removedFromLobby: data.lobbyCode, isLoading: false });
    };

    socket.on(LOBBY_EVENTS.STATE, onState);
    socket.on(LOBBY_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.REMOVED, onRemoved);

    return () => {
      socket.off(LOBBY_EVENTS.STATE, onState);
      socket.off(LOBBY_EVENTS.ERROR, onError);
      socket.off(LOBBY_EVENTS.REMOVED, onRemoved);
    };
  },

  reset: () => set({ lobby: null, error: null, isLoading: false, removedFromLobby: null }),
}));
