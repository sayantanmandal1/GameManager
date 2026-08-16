import { CONNECT_FOUR_COLUMNS, ConnectFourPhase } from '../../../shared';
import { ConnectFourEngine } from './connectfour.engine';

describe('ConnectFourEngine', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = new ConnectFourEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });

  it('requires two distinct players', () => {
    expect(() => engine.initGame(['a'], { a: 'Alice' })).toThrow();
    expect(() => engine.initGame(['a', 'a'], { a: 'Alice' })).toThrow();
  });

  it('applies gravity and alternates turns', () => {
    const state = game();
    expect(engine.drop(state, 'a', 3).valid).toBe(true);
    expect(state.board[5 * CONNECT_FOUR_COLUMNS + 3]).toBe('red');
    expect(state.currentTurnId).toBe('b');
    expect(engine.drop(state, 'a', 2).reason).toBe('Not your turn');
  });

  it('rejects out-of-range and full columns', () => {
    const state = game();
    expect(engine.drop(state, 'a', 7).reason).toBe('Invalid column');
    for (let turn = 0; turn < 6; turn += 1) {
      engine.drop(state, turn % 2 === 0 ? 'a' : 'b', 0);
    }
    expect(engine.drop(state, 'a', 0).reason).toBe('Column is full');
  });

  it('detects a horizontal win', () => {
    const state = game();
    for (const [player, column] of [
      ['a', 0], ['b', 0], ['a', 1], ['b', 1], ['a', 2], ['b', 2], ['a', 3],
    ] as const) {
      engine.drop(state, player, column);
    }
    expect(state.phase).toBe(ConnectFourPhase.FINISHED);
    expect(state.winnerId).toBe('a');
    expect(state.winningCells).toEqual([35, 36, 37, 38]);
  });

  it('detects a vertical win', () => {
    const state = game();
    for (const [player, column] of [
      ['a', 0], ['b', 1], ['a', 0], ['b', 1], ['a', 0], ['b', 2], ['a', 0],
    ] as const) {
      engine.drop(state, player, column);
    }
    expect(state.winnerId).toBe('a');
    expect(state.winningCells).toEqual([14, 21, 28, 35]);
  });

  it('detects a rising diagonal win', () => {
    const state = game();
    state.board[35] = 'red';
    state.board[29] = 'red';
    state.board[23] = 'red';
    state.board[36] = 'yellow';
    state.board[37] = 'yellow';
    state.board[30] = 'yellow';
    state.board[38] = 'yellow';
    state.board[31] = 'yellow';
    state.board[24] = 'yellow';
    state.currentTurnId = 'a';
    engine.drop(state, 'a', 3);
    expect(state.winnerId).toBe('a');
    expect(state.winningCells).toEqual([17, 23, 29, 35]);
  });

  it('returns isolated views and valid columns', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.board[0] = 'red';
    expect(state.board[0]).toBeNull();
    expect(view.validColumns).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('awards surrender to the opponent', () => {
    const state = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b' });
  });
});