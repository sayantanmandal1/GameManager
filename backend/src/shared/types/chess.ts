// ─── Chess Type Definitions ───

/** Time control for a chess game. null = untimed. */
export interface TimeControl {
  baseMs: number;
  incrementMs: number;
}

/** Live clock snapshot. Clocks are server-authoritative. */
export interface ChessClocks {
  whiteMs: number;
  blackMs: number;
  /** Epoch ms wall-clock the clocks were last settled on the server. */
  lastTickAt: number;
}

export type ChessResult = '1-0' | '0-1' | '1/2-1/2' | null;

/** High-level game status used by the engine + client. */
export type ChessStatus = 'waiting' | 'in_progress' | 'finished';

/**
 * Termination reason — why the game ended. All natural chess endings plus
 * out-of-band outcomes (agreement, resignation, flag-fall).
 */
export type ChessTermination =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'insufficient-material'
  | 'draw-agreement'
  | 'resignation'
  | 'flagged'
  | 'draw-insufficient';

/** A single move record (SAN + raw squares + captured piece if any). */
export interface ChessMove {
  from: string;
  to: string;
  promotion: string | null;
  san: string;
  color: 'w' | 'b';
  captured: string | null;
}

/**
 * Authoritative server-side state. JSON-serializable (safe to snapshot to Redis).
 * The `chess.js` instance is reconstructed on demand from `pgn` / `fen`.
 */
export interface ChessGameState {
  gameId: string;
  lobbyCode: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whiteName: string;
  blackName: string;
  /** Starting FEN (always standard initial position in v1). */
  startFen: string;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  history: ChessMove[];
  timeControl: TimeControl | null;
  clocks: ChessClocks;
  status: ChessStatus;
  drawOffer: { by: 'w' | 'b'; active: boolean } | null;
  result: ChessResult;
  termination: ChessTermination | null;
  /** Non-seat viewers. Bounded server-side. */
  spectators: string[];
  /** Epoch ms the engine created the game. */
  startedAt: number;
  /** Epoch ms the engine marked the game finished (null while active). */
  endedAt: number | null;
  /** Last server clock-tick emission timestamp (epoch ms). Used for 1Hz throttle. */
  lastEmittedTickAt: number;
}

/** Player-safe view; shape broadcast to clients on state events. */
export interface ChessPlayerView {
  gameId: string;
  lobbyCode: string;
  role: 'white' | 'black' | 'spectator';
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  history: ChessMove[];
  clocks: ChessClocks;
  timeControl: TimeControl | null;
  whitePlayerId: string;
  blackPlayerId: string;
  whiteName: string;
  blackName: string;
  status: ChessStatus;
  drawOffer: { by: 'w' | 'b'; active: boolean } | null;
  result: ChessResult;
  termination: ChessTermination | null;
  spectatorCount: number;
}

/** Cap on simultaneous spectators per chess game (OWASP: bound unbounded growth). */
export const CHESS_SPECTATOR_CAP = 50;
/** Rate limit for chess:move per socket (token bucket). */
export const CHESS_MOVE_RATE_CAPACITY = 10;
export const CHESS_MOVE_RATE_REFILL_PER_SEC = 10;
