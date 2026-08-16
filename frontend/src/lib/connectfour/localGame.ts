import {
  CONNECT_FOUR_COLUMNS,
  CONNECT_FOUR_ROWS,
  ConnectFourPhase,
  type ConnectFourDisc,
  type ConnectFourGameState,
} from '@/shared';

const HUMAN_ID = 'human';
const BOT_ID = 'bot';
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

export function createLocalConnectFour(): ConnectFourGameState {
  return {
    players: [
      { id: HUMAN_ID, name: 'You', disc: 'red', isBot: false },
      { id: BOT_ID, name: 'Bot', disc: 'yellow', isBot: true },
    ],
    board: Array.from({ length: CONNECT_FOUR_ROWS * CONNECT_FOUR_COLUMNS }, () => null),
    currentTurnId: HUMAN_ID,
    phase: ConnectFourPhase.PLAYING,
    winnerId: null,
    winningCells: null,
    isDraw: false,
    lastMove: null,
  };
}

export function validConnectFourColumns(state: ConnectFourGameState): number[] {
  return COLUMN_ORDER.filter((column) => state.board[index(0, column)] === null);
}

export function applyLocalConnectFourDrop(
  current: ConnectFourGameState,
  playerId: string,
  column: number,
): { state: ConnectFourGameState; valid: boolean; reason?: string } {
  const state = cloneState(current);
  if (state.phase !== ConnectFourPhase.PLAYING) return { state, valid: false, reason: 'Game finished' };
  if (state.currentTurnId !== playerId) return { state, valid: false, reason: 'Not your turn' };
  if (!Number.isInteger(column) || column < 0 || column >= CONNECT_FOUR_COLUMNS) {
    return { state, valid: false, reason: 'Invalid column' };
  }
  const row = openRow(state, column);
  if (row < 0) return { state, valid: false, reason: 'Column is full' };
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return { state, valid: false, reason: 'Player not found' };
  state.board[index(row, column)] = player.disc;
  state.lastMove = { row, column, playerId };
  const line = winningCells(state, row, column, player.disc);
  if (line) {
    state.phase = ConnectFourPhase.FINISHED;
    state.winnerId = playerId;
    state.winningCells = line;
    return { state, valid: true };
  }
  if (state.board.every(Boolean)) {
    state.phase = ConnectFourPhase.FINISHED;
    state.isDraw = true;
    return { state, valid: true };
  }
  state.currentTurnId = state.players.find((candidate) => candidate.id !== playerId)!.id;
  return { state, valid: true };
}

export function chooseConnectFourBotColumn(state: ConnectFourGameState): number | null {
  const columns = validConnectFourColumns(state);
  if (columns.length === 0) return null;
  let bestColumn = columns[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const column of columns) {
    const next = applyLocalConnectFourDrop(state, BOT_ID, column).state;
    const score = minimax(next, 4, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }
  return bestColumn;
}

function minimax(state: ConnectFourGameState, depth: number, alpha: number, beta: number): number {
  if (state.phase === ConnectFourPhase.FINISHED) {
    if (state.winnerId === BOT_ID) return 1_000_000 + depth;
    if (state.winnerId === HUMAN_ID) return -1_000_000 - depth;
    return 0;
  }
  if (depth === 0) return evaluate(state);
  const maximizing = state.currentTurnId === BOT_ID;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const column of validConnectFourColumns(state)) {
    const next = applyLocalConnectFourDrop(state, state.currentTurnId, column).state;
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

function evaluate(state: ConnectFourGameState): number {
  let score = 0;
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    if (state.board[index(row, 3)] === 'yellow') score += 5;
    if (state.board[index(row, 3)] === 'red') score -= 5;
  }
  for (const window of allWindows()) {
    const cells = window.map((cellIndex) => state.board[cellIndex]);
    score += scoreWindow(cells, 'yellow');
    score -= scoreWindow(cells, 'red');
  }
  return score;
}

function scoreWindow(cells: Array<ConnectFourDisc | null>, disc: ConnectFourDisc): number {
  const own = cells.filter((cell) => cell === disc).length;
  const empty = cells.filter((cell) => cell === null).length;
  if (own === 4) return 100_000;
  if (own === 3 && empty === 1) return 120;
  if (own === 2 && empty === 2) return 12;
  return 0;
}

function allWindows(): number[][] {
  const windows: number[][] = [];
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    for (let column = 0; column <= CONNECT_FOUR_COLUMNS - 4; column += 1) {
      windows.push([0, 1, 2, 3].map((offset) => index(row, column + offset)));
    }
  }
  for (let row = 0; row <= CONNECT_FOUR_ROWS - 4; row += 1) {
    for (let column = 0; column < CONNECT_FOUR_COLUMNS; column += 1) {
      windows.push([0, 1, 2, 3].map((offset) => index(row + offset, column)));
    }
  }
  for (let row = 0; row <= CONNECT_FOUR_ROWS - 4; row += 1) {
    for (let column = 0; column <= CONNECT_FOUR_COLUMNS - 4; column += 1) {
      windows.push([0, 1, 2, 3].map((offset) => index(row + offset, column + offset)));
      windows.push([0, 1, 2, 3].map((offset) => index(row + 3 - offset, column + offset)));
    }
  }
  return windows;
}

function winningCells(
  state: ConnectFourGameState,
  row: number,
  column: number,
  disc: ConnectFourDisc,
): number[] | null {
  for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [index(row, column)];
    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction;
      let nextColumn = column + columnStep * direction;
      while (
        nextRow >= 0 && nextRow < CONNECT_FOUR_ROWS &&
        nextColumn >= 0 && nextColumn < CONNECT_FOUR_COLUMNS &&
        state.board[index(nextRow, nextColumn)] === disc
      ) {
        cells.push(index(nextRow, nextColumn));
        nextRow += rowStep * direction;
        nextColumn += columnStep * direction;
      }
    }
    if (cells.length >= 4) return cells.sort((a, b) => a - b);
  }
  return null;
}

function openRow(state: ConnectFourGameState, column: number): number {
  for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
    if (state.board[index(row, column)] === null) return row;
  }
  return -1;
}

function cloneState(state: ConnectFourGameState): ConnectFourGameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player })) as ConnectFourGameState['players'],
    board: [...state.board],
    winningCells: state.winningCells ? [...state.winningCells] : null,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
  };
}

function index(row: number, column: number): number {
  return row * CONNECT_FOUR_COLUMNS + column;
}