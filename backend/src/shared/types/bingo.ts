export const BINGO_BOARD_SIZE = 5;
export const BINGO_TOTAL_NUMBERS = 25;

export interface BingoCell {
  value: number; // 1-25  (0 = not yet placed during setup)
  marked: boolean;
}

export type BingoBoard = BingoCell[][];

export enum BingoGamePhase {
  SETUP = 'setup',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export interface BingoGameState {
  boards: Record<string, BingoBoard>;
  phase: BingoGamePhase;
  setupDone: string[];
  currentTurn: string | null;
  chosenNumbers: number[];
  completedLines: Record<string, number>;
  playerIds: string[];
  winnerId: string | null;
}

export interface BingoPlayerView {
  board: BingoBoard;
  opponentBoard: BingoBoard | null;
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
