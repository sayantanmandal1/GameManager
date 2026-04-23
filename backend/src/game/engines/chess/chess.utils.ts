import { ChessGameState, ChessMove } from '../../../shared';

/** Standard initial position FEN (chess.js default). */
export const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Square-name regex used by both server DTOs and client UI. */
export const SQUARE_RE = /^[a-h][1-8]$/;
export const PROMOTION_RE = /^[qrbn]$/;

/** Validates a square string shape. Does NOT check board occupancy. */
export function isSquare(sq: unknown): sq is string {
  return typeof sq === 'string' && SQUARE_RE.test(sq);
}

/** Validates a promotion piece shape. */
export function isPromotionPiece(p: unknown): p is 'q' | 'r' | 'b' | 'n' {
  return typeof p === 'string' && PROMOTION_RE.test(p);
}

/**
 * Piece-name to human-readable label used for ARIA square labels on the
 * frontend. Kept server-side so the types are authoritative.
 * FEN piece chars: r n b q k p (black lower-case) / R N B Q K P (white).
 */
const PIECE_LABELS: Record<string, string> = {
  r: 'black rook',
  n: 'black knight',
  b: 'black bishop',
  q: 'black queen',
  k: 'black king',
  p: 'black pawn',
  R: 'white rook',
  N: 'white knight',
  B: 'white bishop',
  Q: 'white queen',
  K: 'white king',
  P: 'white pawn',
};

/**
 * Derive ARIA labels (`"e4, white pawn"` / `"e4, empty"`) for every square
 * from a FEN board. Returns a record keyed by algebraic square.
 */
export function fenToAriaLabels(fen: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const board = fen.split(' ')[0] ?? '';
  const ranks = board.split('/');
  if (ranks.length !== 8) return labels;
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      const emptyRun = parseInt(ch, 10);
      if (!Number.isNaN(emptyRun)) {
        for (let i = 0; i < emptyRun; i++) {
          const sq = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - r);
          labels[sq] = `${sq}, empty`;
          file++;
        }
      } else {
        const sq = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - r);
        const label = PIECE_LABELS[ch] ?? 'unknown piece';
        labels[sq] = `${sq}, ${label}`;
        file++;
      }
    }
  }
  return labels;
}

/** Compute remaining clock ms for a colour given a settled state + nowMs. */
export function remainingMsFor(
  state: ChessGameState,
  color: 'w' | 'b',
  nowMs: number,
): number {
  if (!state.timeControl) return Number.POSITIVE_INFINITY;
  if (state.status !== 'in_progress') {
    return color === 'w' ? state.clocks.whiteMs : state.clocks.blackMs;
  }
  const base = color === 'w' ? state.clocks.whiteMs : state.clocks.blackMs;
  if (state.turn !== color) return base;
  const elapsed = Math.max(0, nowMs - state.clocks.lastTickAt);
  return Math.max(0, base - elapsed);
}

/**
 * Map a raw chess.js move object to our wire-level ChessMove. Kept here so
 * the engine and tests share the exact contract.
 */
export function toChessMove(
  raw: {
    from: string;
    to: string;
    promotion?: string | null;
    san: string;
    color: 'w' | 'b';
    captured?: string | null;
  },
): ChessMove {
  return {
    from: raw.from,
    to: raw.to,
    promotion: raw.promotion ?? null,
    san: raw.san,
    color: raw.color,
    captured: raw.captured ?? null,
  };
}
