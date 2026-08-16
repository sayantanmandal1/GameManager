// ─── Ludo Type Definitions ───

export enum LudoColor {
  RED = 'red',
  GREEN = 'green',
  YELLOW = 'yellow',
  BLUE = 'blue',
}

export enum LudoGamePhase {
  ROLLING = 'rolling',
  MOVING = 'moving',
  FINISHED = 'finished',
}

// ─── Board Layout Constants ───

export const LUDO_BOARD_SIZE = 52;
export const LUDO_HOME_COLUMN_SIZE = 5;
/** A token branches into its home lane before revisiting the square behind its start. */
export const LUDO_MAIN_TRACK_STEPS = LUDO_BOARD_SIZE - 1;
/** Five colored home-lane cells followed by the center finish. */
export const LUDO_FINISHED_STEPS =
  LUDO_MAIN_TRACK_STEPS + LUDO_HOME_COLUMN_SIZE + 1;
export const LUDO_TOKENS_PER_PLAYER = 4;

/** Absolute board position where each color enters the main track */
export const LUDO_START_POSITIONS: Record<LudoColor, number> = {
  [LudoColor.RED]: 0,
  [LudoColor.GREEN]: 13,
  [LudoColor.YELLOW]: 26,
  [LudoColor.BLUE]: 39,
};

/**
 * Absolute positions on the main track that are safe squares (star markers).
 * Tokens on these squares cannot be captured.
 */
export const LUDO_SAFE_SQUARES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];

/**
 * Color assignment for different player counts.
 * 2 players get opposite colors for symmetry.
 * 3 players skip one color (Blue).
 * 4 players get all colors.
 */
export const LUDO_COLOR_ASSIGNMENTS: Record<number, LudoColor[]> = {
  2: [LudoColor.RED, LudoColor.YELLOW],
  3: [LudoColor.RED, LudoColor.GREEN, LudoColor.YELLOW],
  4: [LudoColor.RED, LudoColor.GREEN, LudoColor.YELLOW, LudoColor.BLUE],
};

// ─── Token & Player State ───

/**
 * Represents a single Ludo token.
 * stepsFromStart: 0 = at base, 1–51 = common track,
 * 52–56 = the five colored home-lane cells, 57 = center/finished.
 */
export interface LudoToken {
  id: number; // 0–3
  state: 'base' | 'active' | 'home';
  stepsFromStart: number;
}

export interface LudoPlayerState {
  id: string;
  username: string;
  color: LudoColor;
  tokens: LudoToken[];
  finishedCount: number;
  isBot: boolean;
}

// ─── Dice & Moves ───

export interface LudoDiceResult {
  gameId: string;
  dice: number;
  playerId: string;
  turnSkipped: boolean;
  turnCanceled: boolean;
}

/** A single atomic move: move one token by N steps */
export interface LudoMoveAction {
  tokenId: number;
  steps: number;
}

export interface LudoTurnState {
  availableMoves: LudoMoveAction[][];
  mustRollAgain: boolean;
  turnCanceled: boolean;
}

// ─── Move History (for animation & audit) ───

export interface LudoMoveRecord {
  playerId: string;
  tokenId: number;
  from: number;
  to: number;
  captured?: string; // captured player's id if any
}

// ─── Game State ───

export interface LudoGameState {
  players: Record<string, LudoPlayerState>;
  playerOrder: string[];
  currentTurn: string;
  dice: number | null;
  phase: LudoGamePhase;
  consecutiveSixes: number;
  turnState: LudoTurnState | null;
  winnerId: string | null;
  rankings: string[];
  moveHistory: LudoMoveRecord[];
}

// ─── Player View (sent to clients) ───

export interface LudoPlayerView {
  myColor: LudoColor;
  players: LudoPlayerState[];
  currentTurn: string;
  dice: number | null;
  phase: LudoGamePhase;
  availableMoves: LudoMoveAction[][] | null;
  rankings: string[];
  winnerId: string | null;
  winnerName: string | null;
  playerNames: Record<string, string>;
  isMyTurn: boolean;
}

// ─── Win Result ───

export interface LudoWinResult {
  winnerId: string;
  winnerName: string;
  rankings: string[];
  surrenderedBy?: string;
}
