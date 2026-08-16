import { TicTacToeMode, TicTacToePhase } from '@/shared';
import {
  applyLocalTicTacToeAction,
  chooseTicTacToeBotAction,
  createLocalTicTacToe,
} from './localGame';

describe('local Tic Tac Toe', () => {
  it('uses the same three-piece movement rule as online play', () => {
    let state = createLocalTicTacToe(TicTacToeMode.LIMITED);
    for (const [player, to] of [
      ['human', 0], ['bot', 1], ['human', 3], ['bot', 4], ['human', 7], ['bot', 8],
    ] as const) {
      state = applyLocalTicTacToeAction(state, player, { to }).state;
    }
    expect(applyLocalTicTacToeAction(state, 'human', { to: 2 }).valid).toBe(false);
    const moved = applyLocalTicTacToeAction(state, 'human', { from: 7, to: 2 });
    expect(moved.valid).toBe(true);
    expect(moved.state.board.filter((cell) => cell === 'X')).toHaveLength(3);
  });

  it('takes an immediate winning move', () => {
    const state = createLocalTicTacToe(TicTacToeMode.CLASSIC);
    state.board = ['O', 'O', null, 'X', 'X', null, null, null, null];
    state.currentTurnId = 'bot';
    expect(chooseTicTacToeBotAction(state)).toEqual({ to: 2 });
  });

  it('blocks an immediate classic loss', () => {
    const state = createLocalTicTacToe(TicTacToeMode.CLASSIC);
    state.board = ['X', 'X', null, null, 'O', null, null, null, null];
    state.currentTurnId = 'bot';
    expect(chooseTicTacToeBotAction(state)).toEqual({ to: 2 });
  });

  it('finishes a classic draw without allowing extra actions', () => {
    let state = createLocalTicTacToe(TicTacToeMode.CLASSIC);
    for (const [player, to] of [
      ['human', 0], ['bot', 1], ['human', 2], ['bot', 4], ['human', 3],
      ['bot', 5], ['human', 7], ['bot', 6], ['human', 8],
    ] as const) {
      state = applyLocalTicTacToeAction(state, player, { to }).state;
    }
    expect(state.phase).toBe(TicTacToePhase.FINISHED);
    expect(state.isDraw).toBe(true);
  });
});