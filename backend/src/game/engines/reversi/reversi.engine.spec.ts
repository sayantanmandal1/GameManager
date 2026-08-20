import { ReversiEngine } from './reversi.engine';

describe('ReversiEngine', () => {
  let engine: ReversiEngine;

  beforeEach(() => {
    engine = new ReversiEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });

  it('sets up the standard four center discs and black to move', () => {
    const state = game();

    expect(state.board.filter((cell) => cell === 'black')).toHaveLength(2);
    expect(state.board.filter((cell) => cell === 'white')).toHaveLength(2);
    expect(state.board[27]).toBe('white');
    expect(state.board[28]).toBe('black');
    expect(state.board[35]).toBe('black');
    expect(state.board[36]).toBe('white');
    expect(state.currentTurnId).toBe('a');
  });

  it('rejects invalid cells and moves that do not bracket an opponent disc', () => {
    const state = game();

    expect(engine.applyAction(state, 'a', { cell: -1 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { cell: 0 })).toEqual({
      valid: false,
      reason: 'Move must bracket opponent discs',
    });
  });

  it('enforces turn ownership', () => {
    expect(engine.applyAction(game(), 'b', { cell: 20 })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('flips every bracketed line for a legal move', () => {
    const state = game();
    const result = engine.applyAction(state, 'a', { cell: 19 });

    expect(result.valid).toBe(true);
    expect(state.board[19]).toBe('black');
    expect(state.board[27]).toBe('black');
    expect(engine.getPlayerView(state, 'b').scores).toEqual({ black: 4, white: 1 });
  });

  it('passes automatically when the opponent has no legal move', () => {
    const state = game();
    state.board = Array.from({ length: 64 }, () => 'black');
    state.board[0] = null;
    state.board[1] = 'white';
    state.board[56] = null;
    state.board[57] = 'white';

    expect(engine.applyAction(state, 'a', { cell: 0 }).valid).toBe(true);
    expect(state.currentTurnId).toBe('a');
    expect(state.consecutivePasses).toBe(1);
  });

  it('finishes a full board and chooses the winner by disc count', () => {
    const state = game();
    state.board = Array.from({ length: 64 }, () => 'black');
    state.board[0] = null;
    state.board[1] = 'white';
    const result = engine.applyAction(state, 'a', { cell: 0 });

    expect(result.result).toMatchObject({
      winnerId: 'a',
      isDraw: false,
      reason: 'board_complete',
      scores: { black: 64, white: 0 },
    });
  });

  it('awards surrender to the other player', () => {
    const result = engine.surrender(game(), 'a');

    expect(result.result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });

  it('returns an isolated player view with server-derived legal moves', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.board[27] = null;
    view.players[0].name = 'Changed';

    expect(state.board[27]).toBe('white');
    expect(state.players[0].name).toBe('Alice');
    expect(view).toMatchObject({
      yourDisc: 'black',
      canAct: true,
      legalMoves: [19, 26, 37, 44],
    });
  });

  it('requires exactly two distinct players', () => {
    expect(() => engine.initGame(['a'], { a: 'Alice' })).toThrow();
    expect(() => engine.initGame(['a', 'a'], { a: 'Alice' })).toThrow();
  });
});