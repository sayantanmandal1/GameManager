export enum ArcadePhase {
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export interface ArcadePlayer {
  id: string;
  name: string;
  score: number;
}

export type ArcadeAction =
  | { type: 'place'; index: number }
  | { type: 'take'; heap: number; count: number }
  | { type: 'roll' }
  | { type: 'flip'; index: number }
  | { type: 'continue' };

export interface ArcadePlayerView {
  gameKey: string;
  family: 'alignment' | 'takeaway' | 'race' | 'memory';
  phase: ArcadePhase;
  players: ArcadePlayer[];
  currentTurn: string;
  canAct: boolean;
  winnerId: string | null;
  isDraw: boolean;
  alignment: {
    board: Array<string | null>;
    size: number;
    connect: number;
    gravity: boolean;
    misere: boolean;
    pieceLimit: number;
  } | null;
  takeaway: { heaps: number[]; maxTake: number; misere: boolean } | null;
  race: {
    boardSize: number;
    dieSides: number;
    exactFinish: boolean;
    positions: Record<string, number>;
    jumps: Record<number, number>;
    lastRoll: { playerId: string; value: number; from: number; to: number } | null;
  } | null;
  memory: {
    tiles: Array<string | null>;
    matchedBy: Array<string | null>;
    revealed: number[];
    pairs: number;
    theme: string;
    pendingContinue: boolean;
  } | null;
}

export interface ArcadeResult {
  winnerId: string | null;
  isDraw: boolean;
  scores: Record<string, number>;
}
