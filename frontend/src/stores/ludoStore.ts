import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import {
  GAME_EVENTS,
  LUDO_EVENTS,
  LOBBY_EVENTS,
  type LudoPlayerView,
  type LudoMoveAction,
  type LudoWinResult,
  type LudoMoveRecord,
} from '@/shared';

interface LudoResult {
  gameId: string;
  winnerId: string;
  winnerName: string;
  rankings: string[];
}

interface LudoStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: LudoPlayerView | null;
  result: LudoResult | null;
  error: string | null;
  diceRolling: boolean;

  rollDice: () => void;
  moveToken: (moves: LudoMoveAction[]) => void;
  setLobbyCode: (code: string) => void;
  requestGameState: () => Promise<void>;
  initListeners: () => () => void;
  reset: () => void;
}

export const useLudoStore = create<LudoStoreState>()((set, get) => ({
  gameId: null,
  lobbyCode: null,
  view: null,
  result: null,
  error: null,
  diceRolling: false,

  setLobbyCode: (code: string) => set({ lobbyCode: code }),

  requestGameState: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;

    const socket = await waitForSocket();
    if (!socket) return;

    socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode });
  },

  rollDice: () => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ diceRolling: true });
    socket.emit(LUDO_EVENTS.ROLL_DICE, { gameId, lobbyCode });
  },

  moveToken: (moves: LudoMoveAction[]) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(LUDO_EVENTS.MOVE_TOKEN, { gameId, lobbyCode, moves });
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const onState = (data: { gameId: string; view: LudoPlayerView; gameType?: string }) => {
      if (data.gameType !== 'ludo') return;
      set({ gameId: data.gameId, view: data.view, diceRolling: false });
    };

    const onResult = (data: LudoResult) => {
      set({ result: data });
    };

    const onError = (data: { message: string }) => {
      set({ error: data.message, diceRolling: false });
    };

    const onGameStarting = () => {
      set({ result: null, error: null, diceRolling: false });
    };

    socket.on(GAME_EVENTS.STATE, onState);
    socket.on(GAME_EVENTS.RESULT, onResult);
    socket.on(GAME_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

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
      diceRolling: false,
    }),
}));
