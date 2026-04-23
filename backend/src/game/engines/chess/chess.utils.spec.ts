import {
  fenToAriaLabels,
  isPromotionPiece,
  isSquare,
  remainingMsFor,
  STANDARD_START_FEN,
  toChessMove,
} from './chess.utils';
import { ChessGameState } from '../../../shared';

describe('chess.utils — square/promotion predicates', () => {
  it('accepts valid squares', () => {
    for (const sq of ['a1', 'h8', 'e4', 'd5']) expect(isSquare(sq)).toBe(true);
  });
  it('rejects invalid squares', () => {
    for (const sq of ['i1', 'a0', 'a9', '', 'A1', 'e4 ', null, undefined, 42])
      expect(isSquare(sq)).toBe(false);
  });
  it('accepts promotion pieces q/r/b/n only', () => {
    for (const p of ['q', 'r', 'b', 'n']) expect(isPromotionPiece(p)).toBe(true);
  });
  it('rejects non-promotion pieces', () => {
    for (const p of ['k', 'p', 'Q', '', null, undefined, 1])
      expect(isPromotionPiece(p)).toBe(false);
  });
});

describe('chess.utils — fenToAriaLabels', () => {
  it('labels every square from the starting FEN', () => {
    const labels = fenToAriaLabels(STANDARD_START_FEN);
    expect(labels.e2).toBe('e2, white pawn');
    expect(labels.e1).toBe('e1, white king');
    expect(labels.e8).toBe('e8, black king');
    expect(labels.a8).toBe('a8, black rook');
    expect(labels.e4).toBe('e4, empty');
    expect(Object.keys(labels)).toHaveLength(64);
  });
  it('returns {} for malformed FEN', () => {
    expect(fenToAriaLabels('garbage')).toEqual({});
  });
});

describe('chess.utils — remainingMsFor', () => {
  function mkState(overrides: Partial<ChessGameState> = {}): ChessGameState {
    return {
      gameId: 'g',
      lobbyCode: 'ABCDEF',
      whitePlayerId: 'w',
      blackPlayerId: 'b',
      whiteName: 'W',
      blackName: 'B',
      startFen: STANDARD_START_FEN,
      fen: STANDARD_START_FEN,
      pgn: '',
      turn: 'w',
      history: [],
      timeControl: { baseMs: 60_000, incrementMs: 0 },
      clocks: { whiteMs: 60_000, blackMs: 60_000, lastTickAt: 1_000 },
      status: 'in_progress',
      drawOffer: null,
      result: null,
      termination: null,
      spectators: [],
      startedAt: 0,
      endedAt: null,
      lastEmittedTickAt: 0,
      ...overrides,
    };
  }
  it('returns Infinity for untimed games', () => {
    const s = mkState({ timeControl: null });
    expect(remainingMsFor(s, 'w', 5_000)).toBe(Number.POSITIVE_INFINITY);
  });
  it('does not drain the side that is not to move', () => {
    const s = mkState();
    expect(remainingMsFor(s, 'b', 5_000)).toBe(60_000);
  });
  it('drains the side to move by (now - lastTickAt)', () => {
    const s = mkState();
    expect(remainingMsFor(s, 'w', 4_000)).toBe(60_000 - 3_000);
  });
  it('clamps at zero', () => {
    const s = mkState();
    expect(remainingMsFor(s, 'w', 10_000_000)).toBe(0);
  });
});

describe('chess.utils — toChessMove', () => {
  it('normalizes missing promotion/captured to null', () => {
    const m = toChessMove({ from: 'e2', to: 'e4', san: 'e4', color: 'w' });
    expect(m.promotion).toBeNull();
    expect(m.captured).toBeNull();
  });
  it('passes through captured/promotion', () => {
    const m = toChessMove({
      from: 'a7',
      to: 'a8',
      san: 'a8=Q',
      color: 'w',
      promotion: 'q',
      captured: 'r',
    });
    expect(m.promotion).toBe('q');
    expect(m.captured).toBe('r');
  });
});
