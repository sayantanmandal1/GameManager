import { FarkleEngine } from './farkle.engine';

describe('FarkleEngine', () => {
  const game = (rolls = [1, 2, 3, 4, 5, 6]) => {
    const values = [...rolls];
    const engine = new FarkleEngine(() => values.shift() ?? 2);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('sets up six dice to roll, zero scores, and a 500-point entry gate', () => {
    const { state, engine } = game();
    expect(state).toMatchObject({ scores: { a: 0, b: 0 }, entered: { a: false, b: false }, diceRemaining: 6, phase: 'rolling' });
    expect(engine.getPlayerView(state, 'a').canBank).toBe(false);
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'roll_farkle' })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('uses only server dice and scores a straight as hot dice', () => {
    const { engine, state } = game([1, 2, 3, 4, 5, 6]);
    expect(engine.applyAction(state, 'a', { type: 'roll_farkle', dice: [6, 6, 6, 6, 6, 6] } as never).valid).toBe(true);
    expect(state.dice).toEqual([1, 2, 3, 4, 5, 6]);
    expect(engine.applyAction(state, 'a', { type: 'select_dice', indices: [0, 1, 2, 3, 4, 5] }).valid).toBe(true);
    expect(state).toMatchObject({ turnScore: 1500, diceRemaining: 6, phase: 'rolling' });
  });

  it('scores triples plus single ones and fives', () => {
    const { engine, state } = game();
    state.phase = 'selecting';
    state.dice = [2, 2, 2, 1, 5, 6];
    engine.applyAction(state, 'a', { type: 'select_dice', indices: [0, 1, 2, 3, 4] });
    expect(state.turnScore).toBe(350);
    expect(state.diceRemaining).toBe(1);
  });

  it('scores three pairs, two triplets, and extended same-face groups', () => {
    const cases = [
      { dice: [1, 1, 2, 2, 3, 3], expected: 1500 },
      { dice: [2, 2, 2, 3, 3, 3], expected: 2500 },
      { dice: [4, 4, 4, 4], expected: 1000 },
      { dice: [5, 5, 5, 5, 5], expected: 2000 },
      { dice: [6, 6, 6, 6, 6, 6], expected: 3000 },
    ];

    for (const { dice, expected } of cases) {
      const { engine, state } = game();
      state.phase = 'selecting';
      state.dice = dice;
      engine.applyAction(state, 'a', {
        type: 'select_dice',
        indices: dice.map((_, index) => index),
      });
      expect(state.turnScore).toBe(expected);
    }
  });

  it('rejects duplicate indices and selections containing non-scoring dice', () => {
    const { engine, state } = game();
    state.phase = 'selecting';
    state.dice = [2, 3, 4, 6, 1, 5];
    expect(engine.applyAction(state, 'a', { type: 'select_dice', indices: [4, 4] })).toEqual({ valid: false, reason: 'Invalid dice selection' });
    expect(engine.applyAction(state, 'a', { type: 'select_dice', indices: [0] })).toEqual({ valid: false, reason: 'Every selected die must score' });
  });

  it('loses the turn score and advances on a farkle', () => {
    const { engine, state } = game([2, 3, 4, 6, 2, 3]);
    state.turnScore = 400;
    expect(engine.applyAction(state, 'a', { type: 'roll_farkle' }).valid).toBe(true);
    expect(state).toMatchObject({ turnScore: 0, currentTurnId: 'b', phase: 'rolling' });
  });

  it('requires five hundred to enter before banking', () => {
    const { engine, state } = game();
    state.turnScore = 450;
    expect(engine.applyAction(state, 'a', { type: 'bank_farkle' })).toEqual({ valid: false, reason: 'Five hundred points are required to enter' });
    state.turnScore = 500;
    expect(engine.applyAction(state, 'a', { type: 'bank_farkle' }).valid).toBe(true);
    expect(state).toMatchObject({ scores: { a: 500, b: 0 }, entered: { a: true, b: false }, currentTurnId: 'b' });
  });

  it('returns an isolated projection with server-derived selectable dice', () => {
    const { engine, state } = game();
    state.phase = 'selecting';
    state.dice = [2, 2, 2, 4, 1, 6];
    const view = engine.getPlayerView(state, 'a');
    expect(view.selectableIndices).toEqual([0, 1, 2, 4]);
    view.scores.a = 999;
    view.dice[0] = 6;
    expect(state.scores.a).toBe(0);
    expect(state.dice[0]).toBe(2);
  });

  it('finishes after every opponent receives one final turn', () => {
    const { engine, state } = game();
    state.scores.a = 9500;
    state.entered.a = true;
    state.turnScore = 500;
    engine.applyAction(state, 'a', { type: 'bank_farkle' });
    expect(state).toMatchObject({ finalTriggerId: 'a', finalTurnsRemaining: 1, currentTurnId: 'b' });
    state.entered.b = true;
    state.turnScore = 600;
    const result = engine.applyAction(state, 'b', { type: 'bank_farkle' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'final_round', scores: { a: 10000, b: 600 } });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});