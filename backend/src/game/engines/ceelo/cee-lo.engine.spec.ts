import type { CeeLoAction } from '../../../shared';
import { CeeLoEngine } from './cee-lo.engine';

describe('CeeLoEngine', () => {
  const game = (rolls: number[], rounds = 1, players = ['a', 'b', 'c']) => {
    const engine = new CeeLoEngine(() => rolls.shift()!, rounds);
    return { engine, state: engine.initGame(players, Object.fromEntries(players.map((id) => [id, id.toUpperCase()]))) };
  };

  it('starts a one-round table with the first player as banker', () => {
    const { engine, state } = game([]);
    expect(engine.rulesetId).toBe('cee-lo.traditional-banker.v1');
    expect(state).toMatchObject({ bankerId: 'a', currentTurnId: 'a', phase: 'banker_roll', roundsToPlay: 1 });
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
  });

  it('enforces turn ownership and exact action shape', () => {
    const { engine, state } = game([2, 2, 5]);
    expect(engine.applyAction(state, 'b', { type: 'roll_ceelo' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'roll_ceelo', face: 6 } as unknown as CeeLoAction)).toEqual({ valid: false, reason: 'Invalid roll action' });
  });

  it('rerolls nonqualifying triples of distinct dice until a result qualifies', () => {
    const { engine, state } = game([1, 2, 4, 2, 2, 5]);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    expect(state.bankerRoll).toEqual({ dice: [2, 2, 5], category: 'point', rank: 5 });
    expect(state.currentTurnId).toBe('b');
  });

  it('ranks triples above points and 1-2-3 below every qualifying hand', () => {
    const { engine, state } = game([2, 2, 4, 1, 1, 1, 1, 2, 3]);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    engine.applyAction(state, 'b', { type: 'roll_ceelo' });
    const outcome = engine.applyAction(state, 'c', { type: 'roll_ceelo' });
    expect(state.outcomes).toEqual({ b: 'challenger', c: 'banker' });
    expect(outcome.result).toMatchObject({ scores: { a: 1, b: 1, c: 0 }, winnerId: null, isDraw: true });
  });

  it('ranks 4-5-6 above a six triple', () => {
    const { engine, state } = game([4, 5, 6, 6, 6, 6], 1, ['a', 'b']);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    expect(engine.applyAction(state, 'b', { type: 'roll_ceelo' }).result).toMatchObject({ winnerId: 'a', scores: { a: 1, b: 0 } });
  });

  it('rotates the banker when configured for another table round', () => {
    const { engine, state } = game([2, 2, 6, 1, 1, 2, 3, 3, 4], 2);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    engine.applyAction(state, 'b', { type: 'roll_ceelo' });
    engine.applyAction(state, 'c', { type: 'roll_ceelo' });
    expect(state).toMatchObject({ currentRound: 2, bankerId: 'b', currentTurnId: 'b', phase: 'banker_roll' });
  });

  it('projects public rolls and scores using defensive copies', () => {
    const { engine, state } = game([2, 2, 5]);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    const view = engine.getPlayerView(state, 'b');
    expect(view.bankerRoll?.dice).toEqual([2, 2, 5]);
    expect(view).not.toHaveProperty('finishReason');
    view.scores.a = 99;
    expect(state.scores.a).toBe(0);
  });

  it('rejects actions after terminal table scoring', () => {
    const { engine, state } = game([2, 2, 2, 1, 1, 6], 1, ['a', 'b']);
    engine.applyAction(state, 'a', { type: 'roll_ceelo' });
    engine.applyAction(state, 'b', { type: 'roll_ceelo' });
    expect(engine.applyAction(state, 'a', { type: 'roll_ceelo' })).toEqual({ valid: false, reason: 'Game already finished' });
  });

  it('awards surrender to a remaining player and returns a ranking', () => {
    const { engine, state } = game([]);
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender', ranking: ['b', 'c', 'a'] });
  });
});