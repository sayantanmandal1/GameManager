export enum ConnectFourPhase {
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export type ConnectFourDisc = 'red' | 'yellow';
export type ConnectFourCell = ConnectFourDisc | null;

export interface ConnectFourPlayer {
  id: string;
  name: string;
  disc: ConnectFourDisc;
  isBot: boolean;
}

export interface ConnectFourMove {
  row: number;
  column: number;
  playerId: string;
}

export interface ConnectFourGameState {
  players: [ConnectFourPlayer, ConnectFourPlayer];
  board: ConnectFourCell[];
  currentTurnId: string;
  phase: ConnectFourPhase;
  winnerId: string | null;
  winningCells: number[] | null;
  isDraw: boolean;
  lastMove: ConnectFourMove | null;
}

export interface ConnectFourPlayerView {
  players: [ConnectFourPlayer, ConnectFourPlayer];
  board: ConnectFourCell[];
  currentTurnId: string;
  phase: ConnectFourPhase;
  winnerId: string | null;
  winningCells: number[] | null;
  isDraw: boolean;
  lastMove: ConnectFourMove | null;
  youId: string;
  yourDisc: ConnectFourDisc | null;
  canAct: boolean;
  validColumns: number[];
}

export interface ConnectFourResult {
  winnerId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  winningCells: number[] | null;
}

export const CONNECT_FOUR_ROWS = 6;
export const CONNECT_FOUR_COLUMNS = 7;