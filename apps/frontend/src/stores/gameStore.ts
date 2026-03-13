import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import {
  GAME_EVENTS,
  BINGO_EVENTS,
  LOBBY_EVENTS,
  type BingoPlayerView,
  type BingoWinPattern,
} from '@multiplayer-games/shared';

interface GameResult {
  gameId: string;
  winnerId: string;
  pattern: BingoWinPattern;
  winningCells: [number, number][];
}

interface GameState {
  gameId: string | null;
  view: BingoPlayerView | null;
  result: GameResult | null;
  claimRejected: string | null;
  error: string | null;
  markNumber: (number: number) => void;
  claimBingo: (lobbyCode: string) => void;
  initListeners: () => () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  gameId: null,
  view: null,
  result: null,
  claimRejected: null,
  error: null,

  markNumber: (number: number) => {
    const socket = getSocket();
    const { gameId } = get();
    if (!socket || !gameId) return;
    socket.emit(BINGO_EVENTS.MARK_NUMBER, { gameId, number });
  },

  claimBingo: (lobbyCode: string) => {
    const socket = getSocket();
    const { gameId } = get();
    if (!socket || !gameId) return;
    set({ claimRejected: null });
    socket.emit(BINGO_EVENTS.CLAIM, { gameId, lobbyCode });
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

    const onClaimRejected = (data: { message: string }) => {
      set({ claimRejected: data.message });
    };

    const onError = (data: { message: string }) => {
      set({ error: data.message });
    };

    const onGameStarting = (data: { lobbyCode: string }) => {
      // Game is starting — gateway will send GAME_EVENTS.STATE next
      set({ result: null, claimRejected: null, error: null });
    };

    socket.on(GAME_EVENTS.STATE, onState);
    socket.on(GAME_EVENTS.RESULT, onResult);
    socket.on(BINGO_EVENTS.CLAIM_REJECTED, onClaimRejected);
    socket.on(GAME_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

    return () => {
      socket.off(GAME_EVENTS.STATE, onState);
      socket.off(GAME_EVENTS.RESULT, onResult);
      socket.off(BINGO_EVENTS.CLAIM_REJECTED, onClaimRejected);
      socket.off(GAME_EVENTS.ERROR, onError);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    };
  },

  reset: () =>
    set({
      gameId: null,
      view: null,
      result: null,
      claimRejected: null,
      error: null,
    }),
}));
