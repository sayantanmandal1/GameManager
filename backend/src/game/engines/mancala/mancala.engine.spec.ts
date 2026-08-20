import { MancalaEngine } from './mancala.engine';

describe('MancalaEngine', () => {
  let engine: MancalaEngine;

  beforeEach(() => {
    engine = new MancalaEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });

  it('sets up six pits of four stones and empty stores', () => {
    const state = game();

    expect(state.pits).toEqual([
      [4, 4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4, 4],
    ]);
    expect(state.stores).toEqual([0, 0]);
    expect(state.currentTurnId).toBe('a');
  });

  it('rejects invalid and empty pits', () => {
    const state = game();
    state.pits[0][2] = 0;

    expect(engine.applyAction(state, 'a', { pit: 6 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { pit: 2 })).toEqual({
      valid: false,
      reason: 'Pit is empty',
    });
  });

  it('enforces turn ownership', () => {
    expect(engine.applyAction(game(), 'b', { pit: 0 })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('sows counter-clockwise and skips the opponent store', () => {
    const state = game();
    state.pits = [
      [1, 0, 0, 0, 0, 8],
      [1, 1, 1, 1, 1, 1],
    ];

    expect(engine.applyAction(state, 'a', { pit: 5 }).valid).toBe(true);
    expect(state.stores).toEqual([1, 0]);
    expect(state.pits[0][0]).toBe(2);
  });

  it('captures the opposite stones after landing in an empty own pit', () => {
    const state = game();
    state.pits = [
      [1, 1, 0, 0, 0, 0],
      [1, 1, 1, 4, 1, 1],
    ];

    expect(engine.applyAction(state, 'a', { pit: 1 }).valid).toBe(true);
    expect(state.pits[0][2]).toBe(0);
    expect(state.pits[1][3]).toBe(0);
    expect(state.stores[0]).toBe(5);
  });

  it('grants an extra turn when the final stone lands in the own store', () => {
    const state = game();
    state.pits = [
      [1, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1],
    ];

    expect(engine.applyAction(state, 'a', { pit: 5 }).valid).toBe(true);
    expect(state.currentTurnId).toBe('a');
    expect(state.stores[0]).toBe(1);
  });

  it('sweeps remaining stones and finishes when one side empties', () => {
    const state = game();
    state.pits = [
      [0, 0, 0, 0, 0, 1],
      [2, 0, 0, 0, 0, 0],
    ];
    const result = engine.applyAction(state, 'a', { pit: 5 });

    expect(result.result).toMatchObject({
      winnerId: 'b',
      reason: 'pits_empty',
      scores: { a: 1, b: 2 },
    });
    expect(state.pits).toEqual([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
  });

  it('awards surrender to the other player', () => {
    expect(engine.surrender(game(), 'a').result).toMatchObject({
      winnerId: 'b',
      reason: 'surrender',
    });
  });

  it('returns an isolated player view with server-derived legal pits', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.pits[0][0] = 99;
    view.players[0].name = 'Changed';

    expect(state.pits[0][0]).toBe(4);
    expect(state.players[0].name).toBe('Alice');
    expect(view).toMatchObject({ yourSide: 0, canAct: true, legalPits: [0, 1, 2, 3, 4, 5] });
  });
});