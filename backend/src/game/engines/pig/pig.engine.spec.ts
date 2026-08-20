import { PigEngine } from './pig.engine';

describe('PigEngine', () => {
  const game = (roll = 4) => {
    const engine = new PigEngine(() => roll);
    return {
      engine,
      state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }),
    };
  };

  it('sets up zero scores and the first player turn', () => {
    const { state } = game();

    expect(state.scores).toEqual({ a: 0, b: 0 });
    expect(state.turnTotal).toBe(0);
    expect(state.currentTurnId).toBe('a');
  });

  it('rejects invalid actions and an empty hold', () => {
    const { engine, state } = game();

    expect(engine.applyAction(state, 'a', { type: 'jump' } as never).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'hold' })).toEqual({
      valid: false,
      reason: 'Nothing to hold',
    });
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();

    expect(engine.applyAction(state, 'b', { type: 'roll' })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('uses only the server die value and accumulates the turn total', () => {
    const { engine, state } = game(4);

    expect(
      engine.applyAction(state, 'a', { type: 'roll', value: 6 } as never).valid,
    ).toBe(true);
    expect(state.lastRoll).toBe(4);
    expect(state.turnTotal).toBe(4);
  });

  it('busts on one and passes the turn without banking', () => {
    const { engine, state } = game(1);
    state.turnTotal = 12;

    expect(engine.applyAction(state, 'a', { type: 'roll' }).valid).toBe(true);
    expect(state.turnTotal).toBe(0);
    expect(state.scores.a).toBe(0);
    expect(state.currentTurnId).toBe('b');
  });

  it('holds to bank the turn total and pass', () => {
    const { engine, state } = game(5);
    engine.applyAction(state, 'a', { type: 'roll' });

    expect(engine.applyAction(state, 'a', { type: 'hold' }).valid).toBe(true);
    expect(state.scores.a).toBe(5);
    expect(state.turnTotal).toBe(0);
    expect(state.currentTurnId).toBe('b');
  });

  it('wins when a hold reaches one hundred', () => {
    const { engine, state } = game(2);
    state.scores.a = 98;
    engine.applyAction(state, 'a', { type: 'roll' });
    const result = engine.applyAction(state, 'a', { type: 'hold' });

    expect(result.result).toMatchObject({
      winnerId: 'a',
      reason: 'target_reached',
      scores: { a: 100, b: 0 },
    });
  });

  it('awards surrender to the other player', () => {
    const { engine, state } = game();

    expect(engine.surrender(state, 'a').result).toMatchObject({
      winnerId: 'b',
      reason: 'surrender',
    });
  });

  it('returns an isolated player view with server-derived controls', () => {
    const { engine, state } = game(3);
    engine.applyAction(state, 'a', { type: 'roll' });
    const view = engine.getPlayerView(state, 'a');
    view.scores.a = 99;
    view.players[0].name = 'Changed';

    expect(state.scores.a).toBe(0);
    expect(state.players[0].name).toBe('Alice');
    expect(view).toMatchObject({
      canAct: true,
      canRoll: true,
      canHold: true,
      targetScore: 100,
    });
  });
});