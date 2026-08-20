import { CheckersGameState } from '../../../shared';
import { CheckersEngine } from './checkers.engine';

describe('CheckersEngine', () => {
  let engine: CheckersEngine;

  beforeEach(() => {
    engine = new CheckersEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });
  const empty = (state: CheckersGameState) => {
    state.board = Array.from({ length: 64 }, () => null);
  };

  it('sets up twelve pieces per player on dark squares', () => {
    const state = game();

    expect(state.board.filter((piece) => piece?.playerId === 'a')).toHaveLength(12);
    expect(state.board.filter((piece) => piece?.playerId === 'b')).toHaveLength(12);
    state.board.forEach((piece, cell) => {
      if (piece) expect((Math.floor(cell / 8) + (cell % 8)) % 2).toBe(1);
    });
  });

  it('rejects invalid actions and occupied destinations', () => {
    const state = game();

    expect(engine.applyAction(state, 'a', { from: -1, to: 0 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { from: 40, to: 49 }).valid).toBe(false);
  });

  it('enforces turn ownership', () => {
    expect(engine.applyAction(game(), 'b', { from: 17, to: 24 })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('requires captures and keeps the turn for a multi-jump', () => {
    const state = game();
    empty(state);
    state.board[42] = { playerId: 'a', king: false };
    state.board[33] = { playerId: 'b', king: false };
    state.board[17] = { playerId: 'b', king: false };
    state.board[7] = { playerId: 'b', king: false };

    expect(engine.applyAction(state, 'a', { from: 42, to: 35 })).toEqual({
      valid: false,
      reason: 'Capture is mandatory',
    });
    expect(engine.applyAction(state, 'a', { from: 42, to: 24 }).valid).toBe(true);
    expect(state.mustContinueFrom).toBe(24);
    expect(state.currentTurnId).toBe('a');
    expect(engine.applyAction(state, 'a', { from: 24, to: 10 }).valid).toBe(true);
    expect(state.board[33]).toBeNull();
    expect(state.board[17]).toBeNull();
    expect(state.currentTurnId).toBe('b');
  });

  it('promotes a man on the opponent back rank', () => {
    const state = game();
    empty(state);
    state.board[10] = { playerId: 'a', king: false };
    state.board[7] = { playerId: 'b', king: false };

    expect(engine.applyAction(state, 'a', { from: 10, to: 1 }).valid).toBe(true);
    expect(state.board[1]).toEqual({ playerId: 'a', king: true });
  });

  it('wins when a capture removes the opponent final piece', () => {
    const state = game();
    empty(state);
    state.board[42] = { playerId: 'a', king: false };
    state.board[33] = { playerId: 'b', king: false };
    const result = engine.applyAction(state, 'a', { from: 42, to: 24 });

    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'no_pieces' });
    expect(state.phase).toBe('finished');
  });

  it('awards surrender to the other player', () => {
    expect(engine.surrender(game(), 'b').result).toMatchObject({
      winnerId: 'a',
      reason: 'surrender',
    });
  });

  it('returns an isolated player view with server-derived legal moves', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.board[40]!.king = true;
    view.players[0].name = 'Changed';

    expect(state.board[40]!.king).toBe(false);
    expect(state.players[0].name).toBe('Alice');
    expect(view.canAct).toBe(true);
    expect(view.mandatoryCapture).toBe(false);
    expect(view.legalMoves).toHaveLength(7);
  });
});