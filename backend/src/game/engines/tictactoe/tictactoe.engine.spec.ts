import { TicTacToeMode, TicTacToePhase } from '../../../shared';
import { TicTacToeEngine } from './tictactoe.engine';

describe('TicTacToeEngine', () => {
  let engine: TicTacToeEngine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  const game = (mode = TicTacToeMode.CLASSIC) =>
    engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }, mode);

  it('requires exactly two distinct players', () => {
    expect(() => engine.initGame(['a'], { a: 'Alice' })).toThrow();
    expect(() => engine.initGame(['a', 'a'], { a: 'Alice' })).toThrow();
  });

  it('enforces turn ownership, bounds, and empty destinations', () => {
    const state = game();
    expect(engine.applyAction(state, 'b', { to: 0 })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
    expect(engine.applyAction(state, 'a', { to: 9 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { to: 0 }).valid).toBe(true);
    expect(engine.applyAction(state, 'b', { to: 0 }).valid).toBe(false);
  });

  it('detects wins and rejects further moves', () => {
    const state = game();
    engine.applyAction(state, 'a', { to: 0 });
    engine.applyAction(state, 'b', { to: 3 });
    engine.applyAction(state, 'a', { to: 1 });
    engine.applyAction(state, 'b', { to: 4 });
    const result = engine.applyAction(state, 'a', { to: 2 });

    expect(result.result).toMatchObject({ winnerId: 'a', winningLine: [0, 1, 2] });
    expect(state.phase).toBe(TicTacToePhase.FINISHED);
    expect(engine.applyAction(state, 'b', { to: 5 }).valid).toBe(false);
  });

  it('detects a full-board classic draw', () => {
    const state = game();
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    moves.forEach((to, index) => {
      engine.applyAction(state, index % 2 === 0 ? 'a' : 'b', { to });
    });

    expect(state.phase).toBe(TicTacToePhase.FINISHED);
    expect(state.isDraw).toBe(true);
    expect(state.winnerId).toBeNull();
  });

  it('limits each player to three placed pieces before requiring movement', () => {
    const state = game(TicTacToeMode.LIMITED);
    engine.applyAction(state, 'a', { to: 0 });
    engine.applyAction(state, 'b', { to: 1 });
    engine.applyAction(state, 'a', { to: 3 });
    engine.applyAction(state, 'b', { to: 4 });
    engine.applyAction(state, 'a', { to: 7 });
    engine.applyAction(state, 'b', { to: 8 });

    expect(engine.getPlayerView(state, 'a').mustMovePiece).toBe(true);
    expect(engine.applyAction(state, 'a', { to: 2 })).toEqual({
      valid: false,
      reason: 'Select one of your pieces to move',
    });
    expect(engine.applyAction(state, 'a', { from: 1, to: 2 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { from: 7, to: 2 }).valid).toBe(true);
    expect(state.board.filter((cell) => cell === 'X')).toHaveLength(3);
  });

  it('can win by moving an existing limited-mode piece', () => {
    const state = game(TicTacToeMode.LIMITED);
    state.board = ['X', 'X', null, 'O', 'O', null, null, null, 'X'];
    state.currentTurnId = 'a';
    const result = engine.applyAction(state, 'a', { from: 8, to: 2 });

    expect(result.result).toMatchObject({ winnerId: 'a', winningLine: [0, 1, 2] });
  });

  it('returns an isolated player view with server-derived action state', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.board[0] = 'X';

    expect(state.board[0]).toBeNull();
    expect(view).toMatchObject({ yourMark: 'X', canAct: true, mustMovePiece: false });
  });

  it('awards an explicit surrender to the other player', () => {
    const state = game();
    const result = engine.surrender(state, 'a');

    expect(result.result).toMatchObject({ winnerId: 'b', winnerName: 'Bob' });
    expect(state.phase).toBe(TicTacToePhase.FINISHED);
  });
});