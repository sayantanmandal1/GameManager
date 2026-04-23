import { ChessEngine } from './chess.engine';
import { STANDARD_START_FEN } from './chess.utils';
import { ChessGameState, TimeControl } from '../../../shared';

const WHITE = 'white-user';
const BLACK = 'black-user';
const NAMES = { [WHITE]: 'Alice', [BLACK]: 'Bob' };

function newState(tc: TimeControl | null = null, now = 1_000_000): ChessGameState {
  return new ChessEngine().initGame('game1', 'ABCDEF', WHITE, BLACK, NAMES, tc, now);
}

describe('ChessEngine — initGame', () => {
  it('starts at the standard initial position with both clocks at base', () => {
    const engine = new ChessEngine();
    const tc: TimeControl = { baseMs: 300_000, incrementMs: 2_000 };
    const s = engine.initGame('g', 'ABCDEF', WHITE, BLACK, NAMES, tc, 1_000);
    expect(s.fen).toBe(STANDARD_START_FEN);
    expect(s.turn).toBe('w');
    expect(s.status).toBe('in_progress');
    expect(s.clocks.whiteMs).toBe(300_000);
    expect(s.clocks.blackMs).toBe(300_000);
    expect(s.clocks.lastTickAt).toBe(1_000);
    expect(s.whiteName).toBe('Alice');
    expect(s.blackName).toBe('Bob');
  });

  it('rejects identical white/black playerIds', () => {
    expect(() =>
      new ChessEngine().initGame('g', 'ABCDEF', 'same', 'same', { same: 'x' }, null),
    ).toThrow();
  });
});

describe('ChessEngine — applyMove', () => {
  const engine = new ChessEngine();

  it('accepts a legal opening move and flips the turn', () => {
    const s = newState();
    const res = engine.applyMove(s, WHITE, { from: 'e2', to: 'e4' });
    expect(res.valid).toBe(true);
    expect(res.move?.san).toBe('e4');
    expect(res.state.turn).toBe('b');
    expect(res.state.history).toHaveLength(1);
  });

  it('rejects an illegal geometry', () => {
    const s = newState();
    const res = engine.applyMove(s, WHITE, { from: 'e2', to: 'e5' });
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('illegal_move');
  });

  it('rejects a move when it is not your turn', () => {
    const s = newState();
    const res = engine.applyMove(s, BLACK, { from: 'e7', to: 'e5' });
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('not_your_turn');
  });

  it('rejects non-seat (spectator) writes', () => {
    const s = newState();
    const res = engine.applyMove(s, 'outsider', { from: 'e2', to: 'e4' });
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('not_a_seat');
  });

  it('supports castling king-side for white', () => {
    const s = newState();
    const moves: [string, string, string][] = [
      [WHITE, 'e2', 'e4'],
      [BLACK, 'e7', 'e5'],
      [WHITE, 'g1', 'f3'],
      [BLACK, 'b8', 'c6'],
      [WHITE, 'f1', 'c4'],
      [BLACK, 'g8', 'f6'],
    ];
    for (const [u, f, t] of moves) {
      const r = engine.applyMove(s, u, { from: f, to: t });
      expect(r.valid).toBe(true);
    }
    const castle = engine.applyMove(s, WHITE, { from: 'e1', to: 'g1' });
    expect(castle.valid).toBe(true);
    expect(castle.move?.san).toMatch(/O-O/);
  });

  it('supports en passant', () => {
    const s = newState();
    // 1. e4 a6 2. e5 d5 3. exd6 e.p.
    const plys: [string, string, string][] = [
      [WHITE, 'e2', 'e4'],
      [BLACK, 'a7', 'a6'],
      [WHITE, 'e4', 'e5'],
      [BLACK, 'd7', 'd5'],
    ];
    for (const [u, f, t] of plys) expect(engine.applyMove(s, u, { from: f, to: t }).valid).toBe(true);
    const ep = engine.applyMove(s, WHITE, { from: 'e5', to: 'd6' });
    expect(ep.valid).toBe(true);
    expect(ep.move?.captured).toBe('p');
  });

  it('supports promotion (default queen)', () => {
    const engine2 = new ChessEngine();
    const s = newState();
    // Force a near-promotion by hand via a constructed fen: place white pawn on a7.
    s.fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    s.pgn = '';
    s.turn = 'w';
    const r = engine2.applyMove(s, WHITE, { from: 'a7', to: 'a8', promotion: 'q' });
    expect(r.valid).toBe(true);
    expect(r.move?.promotion).toBe('q');
    expect(r.move?.san).toMatch(/a8=Q/);
  });

  it('detects checkmate and sets result 1-0 for white on fool\'s mate pattern (scholar\'s mate)', () => {
    const s = newState();
    const plys: [string, string, string][] = [
      [WHITE, 'e2', 'e4'],
      [BLACK, 'e7', 'e5'],
      [WHITE, 'f1', 'c4'],
      [BLACK, 'b8', 'c6'],
      [WHITE, 'd1', 'h5'],
      [BLACK, 'g8', 'f6'],
    ];
    for (const [u, f, t] of plys) expect(engine.applyMove(s, u, { from: f, to: t }).valid).toBe(true);
    const mate = engine.applyMove(s, WHITE, { from: 'h5', to: 'f7' });
    expect(mate.valid).toBe(true);
    expect(mate.state.status).toBe('finished');
    expect(mate.state.result).toBe('1-0');
    expect(mate.state.termination).toBe('checkmate');
  });
});

describe('ChessEngine — termination rules', () => {
  const engine = new ChessEngine();

  it('detects stalemate', () => {
    const s = newState();
    // Classic stalemate: black to move, stalemated by Kc7 Qc6 etc.
    s.fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    s.pgn = '';
    s.turn = 'b';
    const done = engine.checkTermination(s);
    expect(done).toBe(true);
    expect(s.status).toBe('finished');
    expect(s.termination).toBe('stalemate');
    expect(s.result).toBe('1/2-1/2');
  });

  it('detects insufficient material (K vs K)', () => {
    const s = newState();
    s.fen = '8/8/4k3/8/8/4K3/8/8 w - - 0 1';
    s.pgn = '';
    s.turn = 'w';
    expect(engine.checkTermination(s)).toBe(true);
    expect(s.termination).toBe('insufficient-material');
    expect(s.result).toBe('1/2-1/2');
  });

  it('detects 50-move rule via FEN halfmove clock', () => {
    const s = newState();
    // K+Q vs K+R — material sufficient; halfmove clock = 100 triggers 50-move.
    s.fen = '4k3/8/8/8/8/8/3r4/3QK3 w - - 100 60';
    s.pgn = '';
    s.turn = 'w';
    expect(engine.checkTermination(s)).toBe(true);
    expect(s.termination).toBe('fifty-move');
  });

  it('detects threefold repetition', () => {
    const s = newState();
    // Ping-pong knights six times → threefold.
    const cycle: [string, string, string][] = [
      [WHITE, 'g1', 'f3'],
      [BLACK, 'g8', 'f6'],
      [WHITE, 'f3', 'g1'],
      [BLACK, 'f6', 'g8'],
    ];
    for (let i = 0; i < 3; i++) {
      for (const [u, f, t] of cycle) {
        const r = engine.applyMove(s, u, { from: f, to: t });
        expect(r.valid).toBe(true);
        if (s.status === 'finished') break;
      }
      if (s.status === 'finished') break;
    }
    expect(s.status).toBe('finished');
    expect(s.termination).toBe('threefold');
  });
});

describe('ChessEngine — resign / draw', () => {
  const engine = new ChessEngine();

  it('resign by white → 0-1', () => {
    const s = newState();
    const r = engine.resign(s, WHITE);
    expect(r.valid).toBe(true);
    expect(s.status).toBe('finished');
    expect(s.result).toBe('0-1');
    expect(s.termination).toBe('resignation');
  });

  it('resign by non-seat rejected', () => {
    const s = newState();
    const r = engine.resign(s, 'nobody');
    expect(r.valid).toBe(false);
    expect(r.errorCode).toBe('not_a_seat');
  });

  it('draw offer + accept ends 1/2-1/2 by agreement', () => {
    const s = newState();
    expect(engine.offerDraw(s, WHITE).valid).toBe(true);
    expect(s.drawOffer).toEqual({ by: 'w', active: true });
    const resp = engine.respondDraw(s, BLACK, true);
    expect(resp.valid).toBe(true);
    expect(resp.accepted).toBe(true);
    expect(s.result).toBe('1/2-1/2');
    expect(s.termination).toBe('draw-agreement');
  });

  it('draw offer + decline clears offer but game continues', () => {
    const s = newState();
    engine.offerDraw(s, WHITE);
    const resp = engine.respondDraw(s, BLACK, false);
    expect(resp.valid).toBe(true);
    expect(resp.accepted).toBe(false);
    expect(s.drawOffer).toBeNull();
    expect(s.status).toBe('in_progress');
  });

  it('rejects responding to your own offer', () => {
    const s = newState();
    engine.offerDraw(s, WHITE);
    const r = engine.respondDraw(s, WHITE, true);
    expect(r.valid).toBe(false);
    expect(r.errorCode).toBe('own_offer');
  });

  it('rejects double draw offers', () => {
    const s = newState();
    engine.offerDraw(s, WHITE);
    const again = engine.offerDraw(s, WHITE);
    expect(again.valid).toBe(false);
    expect(again.errorCode).toBe('draw_already_pending');
  });

  it('any legal move clears an outstanding draw offer', () => {
    const s = newState();
    engine.offerDraw(s, WHITE);
    const move = engine.applyMove(s, WHITE, { from: 'e2', to: 'e4' });
    expect(move.valid).toBe(true);
    expect(s.drawOffer).toBeNull();
  });
});

describe('ChessEngine — clocks', () => {
  const engine = new ChessEngine();

  it('applies on-move Fischer increment to the mover', () => {
    const tc: TimeControl = { baseMs: 60_000, incrementMs: 3_000 };
    const s = newState(tc, 1_000);
    const r = engine.applyMove(s, WHITE, { from: 'e2', to: 'e4' }, 2_000);
    expect(r.valid).toBe(true);
    // White spent 1s; increment 3s → 60_000 - 1000 + 3000 = 62_000.
    expect(s.clocks.whiteMs).toBe(62_000);
    expect(s.clocks.blackMs).toBe(60_000);
  });

  it('ticks clocks for the side on move and flags when zero (sufficient material → flagged)', () => {
    const tc: TimeControl = { baseMs: 1_000, incrementMs: 0 };
    const s = newState(tc, 0);
    const tick = engine.tickClocks(s, 5_000);
    expect(tick.flagged).toBe(true);
    expect(tick.flaggedColor).toBe('w');
    expect(s.status).toBe('finished');
    expect(s.termination).toBe('flagged');
    expect(s.result).toBe('0-1');
  });

  it('flag-fall with insufficient opposing material → draw-insufficient', () => {
    const tc: TimeControl = { baseMs: 100, incrementMs: 0 };
    const s = newState(tc, 0);
    s.fen = '8/8/4k3/8/8/4K3/8/8 w - - 0 1';
    s.pgn = '';
    s.turn = 'w';
    const tick = engine.tickClocks(s, 10_000);
    expect(tick.flagged).toBe(true);
    expect(s.termination).toBe('draw-insufficient');
    expect(s.result).toBe('1/2-1/2');
  });

  it('untimed games never flag', () => {
    const s = newState(null, 0);
    const tick = engine.tickClocks(s, 10_000_000);
    expect(tick.flagged).toBe(false);
    expect(s.status).toBe('in_progress');
  });
});

describe('ChessEngine — views', () => {
  const engine = new ChessEngine();

  it('returns role=white for white player', () => {
    const s = newState();
    const v = engine.getPlayerView(s, WHITE);
    expect(v.role).toBe('white');
  });

  it('returns role=spectator for unknown user', () => {
    const s = newState();
    const v = engine.getPlayerView(s, 'someone-else');
    expect(v.role).toBe('spectator');
  });

  it('isSeat / isSpectator', () => {
    const s = newState();
    expect(engine.isSeat(s, WHITE)).toBe(true);
    expect(engine.isSpectator(s, WHITE)).toBe(false);
    expect(engine.isSeat(s, 'other')).toBe(false);
    expect(engine.isSpectator(s, 'other')).toBe(true);
  });
});
