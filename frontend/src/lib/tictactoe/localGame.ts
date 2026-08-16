import {
  TicTacToeMode,
  TicTacToePhase,
  type TicTacToeAction,
  type TicTacToeGameState,
  type TicTacToeMark,
} from '@/shared';

const HUMAN_ID = 'human';
const BOT_ID = 'bot';
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

export function createLocalTicTacToe(mode: TicTacToeMode): TicTacToeGameState {
  const state: TicTacToeGameState = {
    players: [
      { id: HUMAN_ID, name: 'You', mark: 'X', isBot: false },
      { id: BOT_ID, name: 'Bot', mark: 'O', isBot: true },
    ],
    board: Array.from({ length: 9 }, () => null),
    currentTurnId: HUMAN_ID,
    mode,
    phase: TicTacToePhase.PLAYING,
    winnerId: null,
    winningLine: null,
    isDraw: false,
    plyCount: 0,
    positionCounts: {},
  };
  state.positionCounts[positionKey(state)] = 1;
  return state;
}

export function applyLocalTicTacToeAction(
  current: TicTacToeGameState,
  playerId: string,
  action: TicTacToeAction,
): { state: TicTacToeGameState; valid: boolean; reason?: string } {
  const state = cloneState(current);
  if (state.phase !== TicTacToePhase.PLAYING) return { state, valid: false, reason: 'Game finished' };
  if (state.currentTurnId !== playerId) return { state, valid: false, reason: 'Not your turn' };
  if (!isIndex(action.to) || state.board[action.to] !== null) {
    return { state, valid: false, reason: 'Choose an empty cell' };
  }
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return { state, valid: false, reason: 'Player not found' };
  const mustMove = state.mode === TicTacToeMode.LIMITED && countMark(state, player.mark) >= 3;
  if (mustMove) {
    if (!isIndex(action.from) || state.board[action.from] !== player.mark) {
      return { state, valid: false, reason: 'Move one of your pieces' };
    }
    state.board[action.from] = null;
  } else if (action.from !== undefined) {
    return { state, valid: false, reason: 'Place a new piece' };
  }
  state.board[action.to] = player.mark;
  state.plyCount += 1;
  const line = winningLine(state, player.mark);
  if (line) {
    state.phase = TicTacToePhase.FINISHED;
    state.winnerId = player.id;
    state.winningLine = line;
    return { state, valid: true };
  }
  if (state.mode === TicTacToeMode.CLASSIC && state.board.every(Boolean)) {
    state.phase = TicTacToePhase.FINISHED;
    state.isDraw = true;
    return { state, valid: true };
  }
  state.currentTurnId = state.players.find((candidate) => candidate.id !== playerId)!.id;
  if (state.mode === TicTacToeMode.LIMITED) {
    const key = positionKey(state);
    state.positionCounts[key] = (state.positionCounts[key] ?? 0) + 1;
    if (state.positionCounts[key] >= 3 || state.plyCount >= 100) {
      state.phase = TicTacToePhase.FINISHED;
      state.isDraw = true;
    }
  }
  return { state, valid: true };
}

export function legalLocalTicTacToeActions(
  state: TicTacToeGameState,
  playerId: string,
): TicTacToeAction[] {
  if (state.phase !== TicTacToePhase.PLAYING || state.currentTurnId !== playerId) return [];
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return [];
  const empty = state.board.flatMap((cell, index) => (cell === null ? [index] : []));
  const mustMove = state.mode === TicTacToeMode.LIMITED && countMark(state, player.mark) >= 3;
  if (!mustMove) return empty.map((to) => ({ to }));
  const owned = state.board.flatMap((cell, index) => (cell === player.mark ? [index] : []));
  return owned.flatMap((from) => empty.map((to) => ({ from, to })));
}

export function chooseTicTacToeBotAction(state: TicTacToeGameState): TicTacToeAction | null {
  const actions = legalLocalTicTacToeActions(state, BOT_ID);
  if (actions.length === 0) return null;
  const depth = state.mode === TicTacToeMode.CLASSIC ? 9 : 5;
  let best = actions[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of orderedActions(actions)) {
    const next = applyLocalTicTacToeAction(state, BOT_ID, action).state;
    const score = minimax(next, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

function minimax(state: TicTacToeGameState, depth: number, alpha: number, beta: number): number {
  if (state.phase === TicTacToePhase.FINISHED) {
    if (state.winnerId === BOT_ID) return 100 + depth;
    if (state.winnerId === HUMAN_ID) return -100 - depth;
    return 0;
  }
  if (depth <= 0) return heuristic(state);
  const maximizing = state.currentTurnId === BOT_ID;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const action of orderedActions(legalLocalTicTacToeActions(state, state.currentTurnId))) {
    const next = applyLocalTicTacToeAction(state, state.currentTurnId, action).state;
    const score = minimax(next, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function heuristic(state: TicTacToeGameState): number {
  let score = 0;
  for (const line of WINNING_LINES) {
    const marks = line.map((index) => state.board[index]);
    const bot = marks.filter((mark) => mark === 'O').length;
    const human = marks.filter((mark) => mark === 'X').length;
    if (human === 0) score += bot * bot;
    if (bot === 0) score -= human * human;
  }
  return score;
}

function orderedActions(actions: TicTacToeAction[]): TicTacToeAction[] {
  const priority = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  return [...actions].sort((a, b) => priority.indexOf(a.to) - priority.indexOf(b.to));
}

function winningLine(state: TicTacToeGameState, mark: TicTacToeMark): number[] | null {
  const line = WINNING_LINES.find((candidate) => candidate.every((index) => state.board[index] === mark));
  return line ? [...line] : null;
}

function countMark(state: TicTacToeGameState, mark: TicTacToeMark): number {
  return state.board.filter((cell) => cell === mark).length;
}

function positionKey(state: TicTacToeGameState): string {
  return `${state.board.map((cell) => cell ?? '-').join('')}:${state.currentTurnId}`;
}

function cloneState(state: TicTacToeGameState): TicTacToeGameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player })) as TicTacToeGameState['players'],
    board: [...state.board],
    winningLine: state.winningLine ? [...state.winningLine] : null,
    positionCounts: { ...state.positionCounts },
  };
}

function isIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < 9;
}