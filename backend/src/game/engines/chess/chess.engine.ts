import { Chess } from 'chess.js';
import {
  ChessGameState,
  ChessPlayerView,
  ChessMove,
  ChessStatus,
  ChessTermination,
  ChessResult,
  TimeControl,
} from '../../../shared';
import { STANDARD_START_FEN, toChessMove } from './chess.utils';

/**
 * Result envelope for a move attempt. On success `state` is mutated in place
 * and returned, and `move` holds the just-applied move. On failure `errorCode`
 * is one of the public enum values allowed by `chess:move_rejected`.
 */
export interface ChessMoveResult {
  valid: boolean;
  state: ChessGameState;
  move?: ChessMove;
  errorCode?:
    | 'not_a_seat'
    | 'not_your_turn'
    | 'illegal_move'
    | 'game_not_active';
  errorMessage?: string;
  terminated?: boolean;
}

export interface ChessTickResult {
  state: ChessGameState;
  flagged: boolean;
  flaggedColor?: 'w' | 'b';
  insufficientMaterialForOpponent?: boolean;
}

/**
 * Pure, injectable chess engine. Mirrors BingoEngine/LudoEngine API:
 *   - no I/O, no DI
 *   - state is JSON-serializable (safe for Redis snapshot)
 *   - `chess.js` Chess instances are constructed per call from state.pgn
 */
export class ChessEngine {
  /**
   * Initialize a fresh chess game. Produces a JSON-serializable
   * `ChessGameState` at the standard start position with clocks seeded from
   * `timeControl` (or zero when untimed). Throws if the two seat ids are
   * identical.
   */
  initGame(
    gameId: string,
    lobbyCode: string,
    whitePlayerId: string,
    blackPlayerId: string,
    playerNames: Record<string, string>,
    timeControl: TimeControl | null,
    nowMs: number = Date.now(),
  ): ChessGameState {
    if (whitePlayerId === blackPlayerId) {
      throw new Error('Chess requires two distinct player ids');
    }
    const chess = new Chess();
    return {
      gameId,
      lobbyCode,
      whitePlayerId,
      blackPlayerId,
      whiteName: playerNames[whitePlayerId] ?? 'White',
      blackName: playerNames[blackPlayerId] ?? 'Black',
      startFen: STANDARD_START_FEN,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: 'w',
      history: [],
      timeControl: timeControl ?? null,
      clocks: {
        whiteMs: timeControl ? timeControl.baseMs : 0,
        blackMs: timeControl ? timeControl.baseMs : 0,
        lastTickAt: nowMs,
      },
      status: 'in_progress',
      drawOffer: null,
      result: null,
      termination: null,
      spectators: [],
      startedAt: nowMs,
      endedAt: null,
      lastEmittedTickAt: 0,
    };
  }

  isSeat(state: ChessGameState, userId: string): boolean {
    return userId === state.whitePlayerId || userId === state.blackPlayerId;
  }

  isSpectator(state: ChessGameState, userId: string): boolean {
    return !this.isSeat(state, userId);
  }

  seatColor(state: ChessGameState, userId: string): 'w' | 'b' | null {
    if (userId === state.whitePlayerId) return 'w';
    if (userId === state.blackPlayerId) return 'b';
    return null;
  }

  /**
   * Apply a move. Returns { valid, state, move?, errorCode? }. On success the
   * state is mutated: fen/pgn/turn/history/clocks updated, terminal state
   * detected and flagged.
   */
  applyMove(
    state: ChessGameState,
    userId: string,
    move: { from: string; to: string; promotion?: string | null },
    nowMs: number = Date.now(),
  ): ChessMoveResult {
    if (state.status !== 'in_progress') {
      return {
        valid: false,
        state,
        errorCode: 'game_not_active',
        errorMessage: 'Game is not in progress',
      };
    }
    const color = this.seatColor(state, userId);
    if (!color) {
      return {
        valid: false,
        state,
        errorCode: 'not_a_seat',
        errorMessage: 'Spectators cannot move',
      };
    }
    if (state.turn !== color) {
      return {
        valid: false,
        state,
        errorCode: 'not_your_turn',
        errorMessage: 'Not your turn',
      };
    }

    // Reconstruct chess.js from pgn so repetition history is preserved.
    const chess = this.loadChess(state);

    // Settle opponent/self clock BEFORE attempting the move so that, on
    // legal moves, we can then apply the increment to the mover's clock.
    this.settleClocksToNow(state, nowMs);
    if (this.checkFlagFall(state, chess, nowMs).flagged) {
      return {
        valid: false,
        state,
        errorCode: 'game_not_active',
        errorMessage: 'Game already flagged',
      };
    }

    let raw: ReturnType<Chess['move']> | null;
    try {
      raw = chess.move({
        from: move.from,
        to: move.to,
        // chess.js accepts undefined; normalize empty / null to undefined.
        promotion: move.promotion ?? undefined,
      });
    } catch {
      raw = null;
    }

    if (!raw) {
      return {
        valid: false,
        state,
        errorCode: 'illegal_move',
        errorMessage: 'Illegal move',
      };
    }

    const applied: ChessMove = toChessMove(raw);

    // Apply increment to the player who just moved (Fischer-style on-move).
    if (state.timeControl && state.timeControl.incrementMs > 0) {
      if (color === 'w') state.clocks.whiteMs += state.timeControl.incrementMs;
      else state.clocks.blackMs += state.timeControl.incrementMs;
    }

    state.fen = chess.fen();
    state.pgn = chess.pgn();
    state.turn = chess.turn();
    state.history.push(applied);
    // Any legal move from either side invalidates an outstanding draw offer.
    state.drawOffer = null;

    // Re-anchor tick so the next opponent tick starts from now.
    state.clocks.lastTickAt = nowMs;

    const terminated = this.checkTermination(state, chess, nowMs);

    return {
      valid: true,
      state,
      move: applied,
      terminated,
    };
  }

  /** Player-initiated resignation. Terminal. */
  resign(
    state: ChessGameState,
    userId: string,
    nowMs: number = Date.now(),
  ): { valid: boolean; state: ChessGameState; errorCode?: string } {
    if (state.status !== 'in_progress') {
      return { valid: false, state, errorCode: 'game_not_active' };
    }
    const color = this.seatColor(state, userId);
    if (!color) return { valid: false, state, errorCode: 'not_a_seat' };
    this.settleClocksToNow(state, nowMs);
    state.status = 'finished';
    state.termination = 'resignation';
    state.result = color === 'w' ? '0-1' : '1-0';
    state.endedAt = nowMs;
    state.drawOffer = null;
    return { valid: true, state };
  }

  /** Open a draw offer. Idempotent-guarded by `draw_already_pending`. */
  offerDraw(
    state: ChessGameState,
    userId: string,
  ): { valid: boolean; state: ChessGameState; errorCode?: string } {
    if (state.status !== 'in_progress') {
      return { valid: false, state, errorCode: 'game_not_active' };
    }
    const color = this.seatColor(state, userId);
    if (!color) return { valid: false, state, errorCode: 'not_a_seat' };
    if (state.drawOffer?.active) {
      return { valid: false, state, errorCode: 'draw_already_pending' };
    }
    state.drawOffer = { by: color, active: true };
    return { valid: true, state };
  }

  /**
   * Respond to an open draw offer. `accept=true` ends the game 1/2-1/2 by
   * draw-agreement; `accept=false` clears the offer.
   */
  respondDraw(
    state: ChessGameState,
    userId: string,
    accept: boolean,
    nowMs: number = Date.now(),
  ): {
    valid: boolean;
    state: ChessGameState;
    errorCode?: string;
    accepted?: boolean;
    by?: 'w' | 'b';
  } {
    if (state.status !== 'in_progress') {
      return { valid: false, state, errorCode: 'game_not_active' };
    }
    const color = this.seatColor(state, userId);
    if (!color) return { valid: false, state, errorCode: 'not_a_seat' };
    if (!state.drawOffer?.active) {
      return { valid: false, state, errorCode: 'no_pending_offer' };
    }
    if (state.drawOffer.by === color) {
      return { valid: false, state, errorCode: 'own_offer' };
    }
    const by = state.drawOffer.by;
    if (accept) {
      this.settleClocksToNow(state, nowMs);
      state.status = 'finished';
      state.termination = 'draw-agreement';
      state.result = '1/2-1/2';
      state.endedAt = nowMs;
      state.drawOffer = null;
      return { valid: true, state, accepted: true, by };
    }
    state.drawOffer = null;
    return { valid: true, state, accepted: false, by };
  }

  /**
   * Settle clocks up to nowMs (no move applied). Used by the periodic tick
   * loop. Returns whether flag-fall occurred and maps it to termination.
   */
  tickClocks(state: ChessGameState, nowMs: number = Date.now()): ChessTickResult {
    if (state.status !== 'in_progress' || !state.timeControl) {
      return { state, flagged: false };
    }
    this.settleClocksToNow(state, nowMs);
    const chess = this.loadChess(state);
    return this.checkFlagFall(state, chess, nowMs);
  }

  /**
   * Idempotent terminal-check based on the current position. Sets
   * status/result/termination if applicable. Returns true when terminated.
   */
  checkTermination(
    state: ChessGameState,
    chess?: Chess,
    nowMs: number = Date.now(),
  ): boolean {
    if (state.status !== 'in_progress') return true;
    const c = chess ?? this.loadChess(state);
    if (c.isCheckmate()) {
      // The side to move has been checkmated; the other side wins.
      const winner: 'w' | 'b' = c.turn() === 'w' ? 'b' : 'w';
      state.result = winner === 'w' ? '1-0' : '0-1';
      state.termination = 'checkmate';
      return this.finish(state, nowMs);
    }
    if (c.isStalemate()) {
      state.result = '1/2-1/2';
      state.termination = 'stalemate';
      return this.finish(state, nowMs);
    }
    if (c.isInsufficientMaterial()) {
      state.result = '1/2-1/2';
      state.termination = 'insufficient-material';
      return this.finish(state, nowMs);
    }
    if (c.isThreefoldRepetition()) {
      state.result = '1/2-1/2';
      state.termination = 'threefold';
      return this.finish(state, nowMs);
    }
    // 50-move rule — chess.js exposes this via isDraw but not a dedicated
    // predicate across versions; derive from halfmove clock.
    const halfmove = this.halfmoveClock(state.fen);
    if (halfmove >= 100) {
      state.result = '1/2-1/2';
      state.termination = 'fifty-move';
      return this.finish(state, nowMs);
    }
    return false;
  }

  /** Clamp a server-authoritative player view for a given user. */
  getPlayerView(state: ChessGameState, userId: string): ChessPlayerView {
    const role: 'white' | 'black' | 'spectator' =
      userId === state.whitePlayerId
        ? 'white'
        : userId === state.blackPlayerId
          ? 'black'
          : 'spectator';
    return {
      gameId: state.gameId,
      lobbyCode: state.lobbyCode,
      role,
      fen: state.fen,
      pgn: state.pgn,
      turn: state.turn,
      history: [...state.history],
      clocks: { ...state.clocks },
      timeControl: state.timeControl,
      whitePlayerId: state.whitePlayerId,
      blackPlayerId: state.blackPlayerId,
      whiteName: state.whiteName,
      blackName: state.blackName,
      status: state.status,
      drawOffer: state.drawOffer ? { ...state.drawOffer } : null,
      result: state.result,
      termination: state.termination,
      spectatorCount: state.spectators.length,
    };
  }

  // ─── internal helpers ──────────────────────────────────────────────

  private loadChess(state: ChessGameState): Chess {
    const c = new Chess();
    if (state.pgn && state.pgn.trim().length > 0) {
      try {
        c.loadPgn(state.pgn);
        return c;
      } catch {
        // PGN load failed — fall through to FEN load so we stay playable.
      }
    }
    try {
      c.load(state.fen);
    } catch {
      // Last resort: initial position.
    }
    return c;
  }

  private settleClocksToNow(state: ChessGameState, nowMs: number): void {
    if (!state.timeControl) {
      state.clocks.lastTickAt = nowMs;
      return;
    }
    const elapsed = Math.max(0, nowMs - state.clocks.lastTickAt);
    if (elapsed === 0) return;
    if (state.turn === 'w') {
      state.clocks.whiteMs = Math.max(0, state.clocks.whiteMs - elapsed);
    } else {
      state.clocks.blackMs = Math.max(0, state.clocks.blackMs - elapsed);
    }
    state.clocks.lastTickAt = nowMs;
  }

  private checkFlagFall(
    state: ChessGameState,
    chess: Chess,
    nowMs: number,
  ): ChessTickResult {
    if (!state.timeControl) return { state, flagged: false };
    const ms = state.turn === 'w' ? state.clocks.whiteMs : state.clocks.blackMs;
    if (ms > 0) return { state, flagged: false };
    // Flag-fall: if opponent has insufficient mating material, it's a draw;
    // otherwise the flagged side loses.
    const flaggedColor = state.turn;
    const insufficient = chess.isInsufficientMaterial();
    if (insufficient) {
      state.result = '1/2-1/2';
      state.termination = 'draw-insufficient';
    } else {
      state.result = flaggedColor === 'w' ? '0-1' : '1-0';
      state.termination = 'flagged';
    }
    this.finish(state, nowMs);
    return {
      state,
      flagged: true,
      flaggedColor,
      insufficientMaterialForOpponent: insufficient,
    };
  }

  private finish(state: ChessGameState, nowMs: number): true {
    state.status = 'finished';
    state.endedAt = nowMs;
    state.drawOffer = null;
    return true;
  }

  private halfmoveClock(fen: string): number {
    const parts = fen.split(' ');
    // FEN field 5 (index 4) is halfmove clock.
    const v = Number.parseInt(parts[4] ?? '0', 10);
    return Number.isFinite(v) ? v : 0;
  }
}
