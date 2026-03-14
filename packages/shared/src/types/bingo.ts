/**
 * Bingo-specific types
 *
 * Game rules:
 *  1. Setup phase — each player places numbers 1-25 on their own 5×5 board.
 *  2. Play phase — players take turns choosing a number 1-25.
 *     The chosen number is crossed off on ALL boards.
 *  3. Win — the first player to complete 5 lines
 *     (any combination of rows, columns, diagonals) spells B-I-N-G-O and wins.
 *     This is detected automatically after every move.
 */

export const BINGO_BOARD_SIZE = 5;
export const BINGO_TOTAL_NUMBERS = 25;

export interface BingoCell {
  value: number; // 1-25  (0 = not yet placed during setup)
  marked: boolean;
}

/** 5×5 grid, row-major order */
export type BingoBoard = BingoCell[][];

export enum BingoGamePhase {
  SETUP = 'setup',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

/** Full server-side state — never sent to clients directly */
export interface BingoGameState {
  boards: Record<string, BingoBoard>; // playerId → board
  phase: BingoGamePhase;
  /** Players who have finished placing all 25 numbers */
  setupDone: string[];
  /** Whose turn it is (playerId).  null during setup / finished. */
  currentTurn: string | null;
  /** Numbers chosen so far (in order) */
  chosenNumbers: number[];
  /** Completed-line count per player: playerId → number of completed lines */
  completedLines: Record<string, number>;
  playerIds: string[];
  winnerId: string | null;
}

/** What a single player sees */
export interface BingoPlayerView {
  board: BingoBoard;
  opponentBoard: BingoBoard | null; // visible only during playing/finished
  phase: BingoGamePhase;
  isSetupDone: boolean;
  opponentSetupDone: boolean;
  currentTurn: string | null;
  chosenNumbers: number[];
  completedLines: Record<string, number>;
  players: string[];
  winnerId: string | null;
}

export interface BingoPlaceMove {
  row: number;
  col: number;
  number: number;
}

export interface BingoChooseMove {
  number: number;
}

export interface BingoWinResult {
  winnerId: string;
  completedLines: Record<string, number>;
}
