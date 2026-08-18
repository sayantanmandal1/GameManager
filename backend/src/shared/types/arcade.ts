import type { GameFamily } from '../game-catalog';

export enum ArcadePhase {
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export interface ArcadePlayer {
  id: string;
  name: string;
  score: number;
}

export interface ArcadeAlignmentState {
  board: Array<string | null>;
  size: number;
  connect: number;
  gravity: boolean;
  misere: boolean;
  pieceLimit: number;
  placements: Record<string, number[]>;
}

export interface ArcadeTakeawayState {
  heaps: number[];
  maxTake: number;
  misere: boolean;
}

export interface ArcadeRaceState {
  boardSize: number;
  dieSides: number;
  exactFinish: boolean;
  positions: Record<string, number>;
  jumps: Record<number, number>;
  lastRoll: { playerId: string; value: number; from: number; to: number } | null;
}

export interface ArcadeMemoryState {
  deck: string[];
  matchedBy: Array<string | null>;
  revealed: number[];
  pairs: number;
  theme: string;
  pendingContinue: boolean;
}

export interface ArcadeGameState {
  gameId: string;
  lobbyCode: string;
  gameKey: string;
  family: Extract<GameFamily, 'alignment' | 'takeaway' | 'race' | 'memory'>;
  phase: ArcadePhase;
  players: ArcadePlayer[];
  playerOrder: string[];
  currentTurn: string;
  winnerId: string | null;
  isDraw: boolean;
  alignment: ArcadeAlignmentState | null;
  takeaway: ArcadeTakeawayState | null;
  race: ArcadeRaceState | null;
  memory: ArcadeMemoryState | null;
}

export type ArcadeAction =
  | { type: 'place'; index: number }
  | { type: 'take'; heap: number; count: number }
  | { type: 'roll' }
  | { type: 'flip'; index: number }
  | { type: 'continue' };

export interface ArcadePlayerView {
  gameKey: string;
  family: ArcadeGameState['family'];
  phase: ArcadePhase;
  players: ArcadePlayer[];
  currentTurn: string;
  canAct: boolean;
  winnerId: string | null;
  isDraw: boolean;
  alignment: Omit<ArcadeAlignmentState, 'placements'> | null;
  takeaway: ArcadeTakeawayState | null;
  race: ArcadeRaceState | null;
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
