import { create } from 'zustand';
import { getSocket, waitForSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import {
  UNO_EVENTS,
  LOBBY_EVENTS,
  type UnoPlayerView,
  type UnoRoundResult,
  type UnoColor,
} from '@/shared';

interface UnoStoreState {
  gameId: string | null;
  lobbyCode: string | null;
  view: UnoPlayerView | null;
  error: string | null;
  connected: boolean;
  roundResult: UnoRoundResult | null;
  matchResult: UnoRoundResult | null;

  // Client → server (emit-only). Components MUST use these, never socket.emit.
  setLobbyCode: (code: string) => void;
  rejoin: () => Promise<void>;
  play: (cardId: string, chosenColor?: UnoColor) => void;
  draw: () => void;
  pass: () => void;
  take: () => void;
  challenge: () => void;
  callUno: () => void;
  catchPlayer: (targetId: string) => void;
  surrender: () => void;
  chooseSeven: (targetId: string) => void;
  chooseOpeningColor: (color: UnoColor) => void;
  chooseRouletteColor: (color: UnoColor) => void;
  jumpIn: (cardId: string, chosenColor?: UnoColor) => void;
  dismissRoundResult: () => void;

  applyState: (payload: { gameId: string; view: UnoPlayerView }) => void;
  initListeners: () => () => void;
  reset: () => void;
}

const INITIAL = {
  gameId: null,
  lobbyCode: null,
  view: null,
  error: null,
  connected: false,
  roundResult: null,
  matchResult: null,
} satisfies Partial<UnoStoreState>;

export const useUnoStore = create<UnoStoreState>()((set, get) => ({
  ...INITIAL,

  setLobbyCode: (code) =>
    set((state) =>
      state.lobbyCode === code
        ? state
        : {
            gameId: null,
            lobbyCode: code,
            view: null,
            error: null,
            roundResult: null,
            matchResult: null,
          },
    ),

  rejoin: async () => {
    const { lobbyCode } = get();
    if (!lobbyCode) return;
    const socket = await waitForSocket();
    if (!socket) return;
    socket.emit(UNO_EVENTS.REJOIN, { lobbyCode });
  },

  play: (cardId, chosenColor) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    set({ error: null });
    const payload: Record<string, unknown> = { gameId, lobbyCode, cardId };
    if (chosenColor) payload.chosenColor = chosenColor;
    socket.emit(UNO_EVENTS.PLAY, payload);
  },

  draw: () => emit(get, UNO_EVENTS.DRAW),
  pass: () => emit(get, UNO_EVENTS.PASS),
  take: () => emit(get, UNO_EVENTS.TAKE),
  challenge: () => emit(get, UNO_EVENTS.CHALLENGE),
  callUno: () => emit(get, UNO_EVENTS.CALL_UNO),

  catchPlayer: (targetId) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(UNO_EVENTS.CATCH, { gameId, lobbyCode, targetId });
  },

  surrender: () => emit(get, UNO_EVENTS.SURRENDER),

  chooseSeven: (targetId) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(UNO_EVENTS.CHOOSE_SEVEN, { gameId, lobbyCode, targetId });
  },

  chooseOpeningColor: (chosenColor) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(UNO_EVENTS.CHOOSE_OPENING_COLOR, {
      gameId,
      lobbyCode,
      chosenColor,
    });
  },

  chooseRouletteColor: (chosenColor) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    socket.emit(UNO_EVENTS.CHOOSE_ROULETTE_COLOR, {
      gameId,
      lobbyCode,
      chosenColor,
    });
  },

  jumpIn: (cardId, chosenColor) => {
    const socket = getSocket();
    const { gameId, lobbyCode } = get();
    if (!socket || !gameId || !lobbyCode) return;
    const payload: Record<string, unknown> = { gameId, lobbyCode, cardId };
    if (chosenColor) payload.chosenColor = chosenColor;
    socket.emit(UNO_EVENTS.JUMP_IN, payload);
  },

  dismissRoundResult: () => set({ roundResult: null }),

  applyState: (payload) => {
    const { lobbyCode } = get();
    const authenticatedUserId = useAuthStore.getState().user?.id;
    if (
      !lobbyCode ||
      payload.view.lobbyCode !== lobbyCode ||
      payload.view.gameId !== payload.gameId ||
      (payload.view.role === 'player' && payload.view.youId !== authenticatedUserId)
    ) {
      return;
    }
    set((state) => {
      const changedGame = state.gameId !== null && state.gameId !== payload.gameId;
      const result = payload.view.lastResult;
      return {
        gameId: payload.gameId,
        view: payload.view,
        error: null,
        roundResult: result && !result.matchOver
          ? result
          : payload.view.phase === 'playing' || changedGame
            ? null
            : state.roundResult,
        matchResult: result?.matchOver
          ? result
          : changedGame
            ? null
            : state.matchResult,
      };
    });
  },

  initListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    const onState = (data: { gameId: string; view: UnoPlayerView }) =>
      get().applyState(data);
    const onRoundOver = (data: { gameId: string; result: UnoRoundResult }) => {
      if (data.gameId === get().gameId) set({ roundResult: data.result });
    };
    const onGameOver = (data: { gameId: string; result: UnoRoundResult }) => {
      if (data.gameId === get().gameId) {
        set({ matchResult: data.result, roundResult: null });
      }
    };
    const onError = (data: { message: string }) => set({ error: data.message });
    const onGameStarting = (data: { lobbyCode?: string }) => {
      if (data.lobbyCode === get().lobbyCode) {
        set({ error: null, roundResult: null, matchResult: null });
      }
    };
    const onConnect = () => {
      set({ connected: true });
      const { lobbyCode } = get();
      if (lobbyCode) socket.emit(UNO_EVENTS.REJOIN, { lobbyCode });
    };
    const onDisconnect = () => set({ connected: false });

    socket.on(UNO_EVENTS.STATE, onState);
    socket.on(UNO_EVENTS.ROUND_OVER, onRoundOver);
    socket.on(UNO_EVENTS.GAME_OVER, onGameOver);
    socket.on(UNO_EVENTS.ERROR, onError);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const { lobbyCode } = get();
    if (lobbyCode) socket.emit(UNO_EVENTS.REJOIN, { lobbyCode });

    return () => {
      socket.off(UNO_EVENTS.STATE, onState);
      socket.off(UNO_EVENTS.ROUND_OVER, onRoundOver);
      socket.off(UNO_EVENTS.GAME_OVER, onGameOver);
      socket.off(UNO_EVENTS.ERROR, onError);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  },

  reset: () => set({ ...INITIAL }),
}));

/** Emit a simple {gameId, lobbyCode} action. */
function emit(get: () => UnoStoreState, event: string): void {
  const socket = getSocket();
  const { gameId, lobbyCode } = get();
  if (!socket || !gameId || !lobbyCode) return;
  socket.emit(event, { gameId, lobbyCode });
}
