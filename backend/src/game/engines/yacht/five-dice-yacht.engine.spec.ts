import { YACHT_CATEGORIES } from '../../../shared';
import { FiveDiceYachtEngine } from './five-dice-yacht.engine';

describe('FiveDiceYachtEngine', () => {
  const game = (rolls = [1, 2, 3, 4, 5, 6, 6, 6]) => {
    const values = [...rolls];
    const engine = new FiveDiceYachtEngine(() => values.shift() ?? 6);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('sets up thirteen unused categories for every player', () => {
    const { state } = game();
    expect(Object.keys(state.scorecards.a)).toEqual(YACHT_CATEGORIES);
    expect(Object.values(state.scorecards.a).every((score) => score === null)).toBe(true);
    expect(state).toMatchObject({ currentTurnId: 'a', dice: [], rollsUsed: 0 });
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'roll_dice', heldIndices: [] })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('uses server rolls and preserves only validated held dice', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [] });
    expect(state.dice).toEqual([1, 2, 3, 4, 5]);
    engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [0, 4] });
    expect(state.dice).toEqual([1, 5, 6, 6, 6]);
    expect(state.rollsUsed).toBe(2);
  });

  it('rejects duplicate holds, out-of-range holds, and a fourth roll', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [] });
    expect(engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [0, 0] })).toEqual({ valid: false, reason: 'Invalid held dice' });
    expect(engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [5] })).toEqual({ valid: false, reason: 'Invalid held dice' });
    engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [] });
    engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [] });
    expect(engine.applyAction(state, 'a', { type: 'roll_dice', heldIndices: [] })).toEqual({ valid: false, reason: 'No rolls remaining' });
  });

  it('scores standard full house and advances to the next scorecard', () => {
    const { engine, state } = game();
    state.dice = [2, 2, 3, 3, 3];
    state.rollsUsed = 1;
    expect(engine.applyAction(state, 'a', { type: 'score_category', category: 'full_house' }).valid).toBe(true);
    expect(state.scorecards.a.full_house).toBe(25);
    expect(state.currentTurnId).toBe('b');
    expect(state.dice).toEqual([]);
  });

  it('rejects scoring before a roll and reusing a category', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'score_category', category: 'chance' })).toEqual({ valid: false, reason: 'Roll before scoring' });
    state.dice = [1, 1, 1, 1, 1];
    state.scorecards.a.yacht = 50;
    expect(engine.applyAction(state, 'a', { type: 'score_category', category: 'yacht' })).toEqual({ valid: false, reason: 'Category already used' });
  });

  it('returns an isolated public scorecard view with possible scores', () => {
    const { engine, state } = game();
    state.dice = [1, 2, 3, 4, 5];
    state.rollsUsed = 1;
    const view = engine.getPlayerView(state, 'a');
    expect(view.possibleScores).toMatchObject({ small_straight: 30, large_straight: 40, chance: 15 });
    view.scorecards.a.chance = 99;
    view.dice[0] = 6;
    expect(state.scorecards.a.chance).toBeNull();
    expect(state.dice[0]).toBe(1);
  });

  it('adds the standard thirty-five point upper-section bonus at sixty-three', () => {
    const { engine, state } = game();
    Object.assign(state.scorecards.a, {
      ones: 3,
      twos: 6,
      threes: 9,
      fours: 12,
      fives: 15,
      sixes: 18,
    });

    expect(engine.getPlayerView(state, 'a').totals.a).toBe(98);
  });

  it('finishes with the highest total after every scorecard is complete', () => {
    const { engine, state } = game();
    for (const category of YACHT_CATEGORIES) {
      state.scorecards.a[category] = 0;
      state.scorecards.b[category] = 0;
    }
    state.scorecards.a.chance = null;
    state.dice = [6, 6, 6, 6, 6];
    const result = engine.applyAction(state, 'a', { type: 'score_category', category: 'chance' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'scorecards_complete', totals: { a: 30, b: 0 } });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});