/**
 * Bingo-specific types
 * Board layout: 5 columns (B, I, N, G, O) × 5 rows
 * Column ranges: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75
 * Center cell (row 2, col 2) is always FREE and marked
 */

export const BINGO_COLUMNS = ['B', 'I', 'N', 'G', 'O'] as const;
export type BingoColumn = (typeof BINGO_COLUMNS)[number];

export const BINGO_COLUMN_RANGES: Record<BingoColumn, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

export const BINGO_BOARD_SIZE = 5;
export const BINGO_TOTAL_NUMBERS = 75;
export const BINGO_FREE_ROW = 2;
export const BINGO_FREE_COL = 2;

export interface BingoCell {
  value: number | 'FREE';
  marked: boolean;
}

/** 5×5 grid, row-major order */
export type BingoBoard = BingoCell[][];

export enum BingoWinPattern {
  ROW = 'row',
  COLUMN = 'column',
  DIAGONAL = 'diagonal',
  FULL_HOUSE = 'full_house',
}

export interface BingoWinResult {
  winnerId: string;
  pattern: BingoWinPattern;
  winningCells: [number, number][];
}

/** Full server-side state — never sent to clients */
export interface BingoGameState {
  boards: Record<string, BingoBoard>; // playerId → board
  calledNumbers: number[];
  currentNumber: number | null;
  remainingNumbers: number[];
  playerIds: string[];
  winnerId: string | null;
  winPattern: BingoWinPattern | null;
}

/** What a single player sees — only their own board */
export interface BingoPlayerView {
  board: BingoBoard;
  calledNumbers: number[];
  currentNumber: number | null;
  players: string[];
  winnerId: string | null;
  winPattern: BingoWinPattern | null;
}

export interface BingoMarkMove {
  number: number;
}

export interface BingoClaimPayload {
  gameId: string;
}
