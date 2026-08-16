export enum TicTacToeMode {
  CLASSIC = 'classic',
  LIMITED = 'limited',
}

export enum TicTacToePhase {
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export type TicTacToeMark = 'X' | 'O';
export type TicTacToeCell = TicTacToeMark | null;

export interface TicTacToePlayer {
  id: string;
  name: string;
  mark: TicTacToeMark;
  isBot: boolean;
}

export interface TicTacToeAction {
  /** Required only after this player has placed all three limited-mode pieces. */
  from?: number;
  to: number;
}

export interface TicTacToeGameState {
  players: [TicTacToePlayer, TicTacToePlayer];
  board: TicTacToeCell[];
  currentTurnId: string;
  mode: TicTacToeMode;
  phase: TicTacToePhase;
  winnerId: string | null;
  winningLine: number[] | null;
  isDraw: boolean;
  plyCount: number;
  positionCounts: Record<string, number>;
}

export interface TicTacToePlayerView {
  players: [TicTacToePlayer, TicTacToePlayer];
  board: TicTacToeCell[];
  currentTurnId: string;
  mode: TicTacToeMode;
  phase: TicTacToePhase;
  winnerId: string | null;
  winningLine: number[] | null;
  isDraw: boolean;
  youId: string;
  yourMark: TicTacToeMark | null;
  canAct: boolean;
  mustMovePiece: boolean;
}

export interface TicTacToeResult {
  winnerId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  winningLine: number[] | null;
}