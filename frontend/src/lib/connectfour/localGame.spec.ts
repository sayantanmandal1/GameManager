import { CONNECT_FOUR_COLUMNS, ConnectFourPhase } from '@/shared';
import {
  applyLocalConnectFourDrop,
  chooseConnectFourBotColumn,
  createLocalConnectFour,
} from './localGame';

describe('local Connect Four', () => {
  it('uses gravity and rejects full columns', () => {
    let state = createLocalConnectFour();
    for (let turn = 0; turn < 6; turn += 1) {
      state = applyLocalConnectFourDrop(state, turn % 2 === 0 ? 'human' : 'bot', 0).state;
    }
    expect(state.board[5 * CONNECT_FOUR_COLUMNS]).toBe('red');
    expect(applyLocalConnectFourDrop(state, 'human', 0).valid).toBe(false);
  });

  it('takes an immediate winning column', () => {
    const state = createLocalConnectFour();
    state.board[35] = 'yellow';
    state.board[36] = 'yellow';
    state.board[37] = 'yellow';
    state.currentTurnId = 'bot';
    expect(chooseConnectFourBotColumn(state)).toBe(3);
  });

  it('blocks an immediate human win', () => {
    const state = createLocalConnectFour();
    state.board[35] = 'red';
    state.board[36] = 'red';
    state.board[37] = 'red';
    state.board[38] = 'yellow';
    state.currentTurnId = 'bot';
    expect(chooseConnectFourBotColumn(state)).toBe(3);
  });

  it('detects a local horizontal win', () => {
    let state = createLocalConnectFour();
    for (const [player, column] of [
      ['human', 0], ['bot', 0], ['human', 1], ['bot', 1],
      ['human', 2], ['bot', 2], ['human', 3],
    ] as const) {
      state = applyLocalConnectFourDrop(state, player, column).state;
    }
    expect(state.phase).toBe(ConnectFourPhase.FINISHED);
    expect(state.winnerId).toBe('human');
  });
});