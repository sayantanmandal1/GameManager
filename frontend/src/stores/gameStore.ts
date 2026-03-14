import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import {
  GAME_EVENTS,
  BINGO_EVENTS,
  LOBBY_EVENTS,
  type BingoPlayerView,
} from '@/shared';

interface GameResult {
  gameId: string;
  winnerId: string;
  completedLines: Record<string, number>;
}

interface GameState {
  gameId: string | null;
  lobbyCode: string | null;
  view: BingoPlayerView | null;
  result: GameResult | null;
  error: string | null;
  /** Setup phase: next number the player needs to place (1-25) */
  nextPlaceNumber: number;
  placeNumber: (row: number, col: number) => void;
  chooseNumber: (number: number) => void;
  backToLobby: () => void;
  setLobbyCode: (code: string) => void;
  initListeners: () => () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  gameId: null,
  lobbyCode: null,
  view: null,
  result: null,
  error: null,
  nextPlaceNumber: 1,

  setLobbyCode: (code: string) => set({ lobbyCode: code }),

  /** Setup phase: place the next number at (row, col) */
  placeNumber: (row: number, col: number) => {
    const socket = getSocket();
    const { gameId, lobbyCode, nextPlaceNumber } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(BINGO_EVENTS.PLACE_NUMBER, {
      gameId,
      lobbyCode,
      row,
      col,
      number: nextPlaceNumber,
    });
    set({ nextPlaceNumber: nextPlaceNumber + 1 });
  },

  /** Play phase: choose a number on your turn */
  chooseNumber: (number: number) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(BINGO_EVENTS.CHOOSE_NUMBER, { gameId, lobbyCode, number });
  },

  backToLobby: () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const onState = (data: { gameId: string; view: BingoPlayerView }) => {
      set({ gameId: data.gameId, view: data.view });
    };

    const onResult = (data: GameResult) => {
      set({ result: data });
    };

    const onError = (data: { message: string }) => {
      set({ error: data.message });
    };

    const onGameStarting = () => {
      set({ result: null, error: null, nextPlaceNumber: 1 });
    };

    socket.on(GAME_EVENTS.STATE, onState);
    socket.on(GAME_EVENTS.RESULT, onResult);
    socket.on(GAME_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

    // Request current game state from server (in case we missed the initial emit)
    const { lobbyCode } = get();
    if (lobbyCode) {
      socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
    }

    return () => {
      socket.off(GAME_EVENTS.STATE, onState);
      socket.off(GAME_EVENTS.RESULT, onResult);
      socket.off(GAME_EVENTS.ERROR, onError);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    };
  },

  reset: () =>
    set({
      gameId: null,
      lobbyCode: null,
      view: null,
      result: null,
      error: null,
      nextPlaceNumber: 1,
    }),
}));
