import { LiarsDiceEngine } from './liars-dice.engine';

describe('LiarsDiceEngine', () => {
  const game = (roll = 3) => {
    const engine = new LiarsDiceEngine(() => roll);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('rolls five private server dice per player', () => {
    const { state } = game(4);
    expect(state.dice).toEqual({ a: [4, 4, 4, 4, 4], b: [4, 4, 4, 4, 4] });
    expect(state).toMatchObject({ currentTurnId: 'a', currentBid: null, round: 1 });
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 1, face: 3 })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('accepts ascending quantity and face bids and advances the turn', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'bid', quantity: 2, face: 3 });
    expect(state.currentBid).toEqual({ quantity: 2, face: 3, bidderId: 'a' });
    expect(state.currentTurnId).toBe('b');
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 2, face: 4 }).valid).toBe(true);
  });

  it('rejects non-increasing, impossible, and premature challenges', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'challenge' })).toEqual({ valid: false, reason: 'There is no bid to challenge' });
    expect(engine.applyAction(state, 'a', { type: 'bid', quantity: 11, face: 3 })).toEqual({ valid: false, reason: 'Invalid bid' });
    engine.applyAction(state, 'a', { type: 'bid', quantity: 2, face: 3 });
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 2, face: 3 })).toEqual({ valid: false, reason: 'Bid must increase' });
  });

  it('makes the challenger lose a die when the bid is true', () => {
    const { engine, state } = game(3);
    engine.applyAction(state, 'a', { type: 'bid', quantity: 10, face: 3 });
    expect(engine.applyAction(state, 'b', { type: 'challenge' }).valid).toBe(true);
    expect(state.dice.b).toHaveLength(4);
    expect(state.dice.a).toHaveLength(5);
    expect(state.currentTurnId).toBe('b');
    expect(state.round).toBe(2);
  });

  it('makes the bidder lose a die when the bid is false', () => {
    const { engine, state } = game(2);
    engine.applyAction(state, 'a', { type: 'bid', quantity: 1, face: 6 });
    engine.applyAction(state, 'b', { type: 'challenge' });
    expect(state.dice.a).toHaveLength(4);
    expect(state.currentTurnId).toBe('a');
  });

  it('redacts every opponent die while exposing only dice counts', () => {
    const { engine, state } = game();
    state.dice.a = [1, 2, 3, 4, 5];
    state.dice.b = [6, 6, 6, 6, 6];
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourDice).toEqual([1, 2, 3, 4, 5]);
    expect(view.players[1].diceCount).toBe(5);
    expect(Object.prototype.hasOwnProperty.call(view.players[1], 'dice')).toBe(false);
    expect(JSON.stringify(view.players)).not.toContain('[6,6,6,6,6]');
  });

  it('finishes when a failed bidder loses the final die', () => {
    const { engine, state } = game();
    state.dice.a = [2];
    state.dice.b = [3];
    engine.applyAction(state, 'a', { type: 'bid', quantity: 2, face: 2 });
    const result = engine.applyAction(state, 'b', { type: 'challenge' });
    expect(result.result).toMatchObject({ winnerId: 'b', reason: 'last_player' });
  });

  it('awards surrender to the next surviving player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});