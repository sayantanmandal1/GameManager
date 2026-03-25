export const BINGO_BOARD_SIZE = 5;
export const BINGO_TOTAL_NUMBERS = 25;

export interface BingoCell {
  value: number;
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
  calledBy: Record<number, string>;
  completedLines: Record<string, number>;
  playerIds: string[];
  playerNames: Record<string, string>;
  winnerId: string | null;
}

export interface BingoPlayerView {
  board: BingoBoard;
  phase: BingoGamePhase;
  isSetupDone: boolean;
  opponentSetupDone: boolean;
  currentTurn: string | null;
  chosenNumbers: number[];
  calledBy: Record<number, string>;
  myCompletedLines: number;
  players: string[];
  playerNames: Record<string, string>;
  winnerId: string | null;
  winnerName: string | null;
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
  winnerName: string;
  completedLines: Record<string, number>;
  surrenderedBy?: string;
}
