import { LiarsDiceEngine } from './liars-dice.engine';

describe('LiarsDiceEngine', () => {
  const game = (roll = 3) => {
    const engine = new LiarsDiceEngine(() => roll);
    const state = engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });
    expect(engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode: 'classic' }).valid).toBe(true);
    return { engine, state };
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

  it('requires a strictly increasing quantity regardless of the face', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'bid', quantity: 2, face: 3 });
    expect(state.currentBid).toEqual({ quantity: 2, face: 3, bidderId: 'a' });
    expect(state.currentTurnId).toBe('b');
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 2, face: 4 }).valid).toBe(false);
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 3, face: 1 }).valid).toBe(true);
  });

  it('rejects non-increasing, impossible, and premature challenges', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'challenge' })).toEqual({ valid: false, reason: 'There is no bid to challenge' });
    expect(engine.applyAction(state, 'a', { type: 'bid', quantity: 11, face: 3 })).toEqual({ valid: false, reason: 'Invalid bid' });
    engine.applyAction(state, 'a', { type: 'bid', quantity: 2, face: 3 });
    expect(engine.applyAction(state, 'b', { type: 'bid', quantity: 2, face: 3 })).toEqual({ valid: false, reason: 'Bid quantity must increase' });
  });

  it('gives the challenger poison, not die loss, when the bid is true', () => {
    const { engine, state } = game(3);
    engine.applyAction(state, 'a', { type: 'bid', quantity: 10, face: 3 });
    expect(engine.applyAction(state, 'b', { type: 'challenge' }).valid).toBe(true);
    expect(state.dice.b).toHaveLength(5);
    expect(state.penalties.b).toBe(1);
    expect(state.dice.a).toHaveLength(5);
    expect(state.currentTurnId).toBe('b');
    expect(state.phase).toBe('reveal');
    expect(state.lastReveal).toMatchObject({ actual: 10, penalizedIds: ['b'] });
    engine.applyAction(state, 'a', { type: 'next_liars_dice_round' });
    expect(state.round).toBe(2);
    expect(state.dice.b).toHaveLength(5);
  });

  it('gives the bidder poison when the bid is false', () => {
    const { engine, state } = game(2);
    engine.applyAction(state, 'a', { type: 'bid', quantity: 1, face: 6 });
    engine.applyAction(state, 'b', { type: 'challenge' });
    expect(state.dice.a).toHaveLength(5);
    expect(state.penalties.a).toBe(1);
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

  it('finishes when a failed bidder receives a second poison penalty', () => {
    const { engine, state } = game();
    state.penalties.a = 1;
    state.dice.a = [2, 2, 2, 2, 2];
    engine.applyAction(state, 'a', { type: 'bid', quantity: 6, face: 2 });
    const result = engine.applyAction(state, 'b', { type: 'challenge' });
    expect(result.result).toMatchObject({ winnerId: 'b', reason: 'last_player' });
  });

  it('awards surrender to the next surviving player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });

  it('lets only the host select a valid mode and rejects injected action fields', () => {
    const engine = new LiarsDiceEngine(() => 3);
    const state = engine.initGame(['a', 'b'], {});
    expect(engine.applyAction(state, 'b', { type: 'select_liars_dice_mode', mode: 'classic' }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'bid', quantity: 1, face: 2 }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode: 'traditional' }).valid).toBe(true);
    const action = { type: 'bid' as const, quantity: 1, face: 2, dice: [2, 2, 2, 2, 2] };
    expect(engine.applyAction(state, 'a', action).valid).toBe(false);
  });

  it('counts ones as wild only in Traditional and never counts a one twice', () => {
    for (const mode of ['classic', 'traditional'] as const) {
      const engine = new LiarsDiceEngine(() => 1);
      const state = engine.initGame(['a', 'b'], {});
      engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode });
      engine.applyAction(state, 'a', { type: 'bid', quantity: 10, face: 6 });
      engine.applyAction(state, 'b', { type: 'challenge' });
      expect(state.lastReveal?.actual).toBe(mode === 'classic' ? 0 : 10);
    }
    const engine = new LiarsDiceEngine(() => 1);
    const state = engine.initGame(['a', 'b'], {});
    engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode: 'traditional' });
    engine.applyAction(state, 'a', { type: 'bid', quantity: 10, face: 1 });
    engine.applyAction(state, 'b', { type: 'spot_on' });
    expect(state.lastReveal?.actual).toBe(10);
  });

  it('penalizes everyone except a correct Spot-on caller, and only the caller on failure', () => {
    const engine = new LiarsDiceEngine(() => 4);
    const state = engine.initGame(['a', 'b', 'c', 'd'], {});
    engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode: 'traditional' });
    engine.applyAction(state, 'a', { type: 'bid', quantity: 20, face: 4 });
    engine.applyAction(state, 'b', { type: 'spot_on' });
    expect(state.penalties).toEqual({ a: 1, b: 0, c: 1, d: 1 });
    expect(state.lastReveal?.penalizedIds).toEqual(['a', 'c', 'd']);
    engine.applyAction(state, 'a', { type: 'next_liars_dice_round' });
    engine.applyAction(state, 'b', { type: 'bid', quantity: 19, face: 4 });
    engine.applyAction(state, 'c', { type: 'spot_on' });
    expect(state.penalties).toEqual({ a: 1, b: 0, c: 2, d: 1 });
    expect(state.dice.c).toEqual([]);
  });

  it('does not expose new private rolls through a prior reveal or mutable projection', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'bid', quantity: 1, face: 6 });
    engine.applyAction(state, 'b', { type: 'challenge' });
    const view = engine.getPlayerView(state, 'a');
    view.lastReveal!.dice.b[0] = 6;
    view.penalties.b = 2;
    expect(state.lastReveal!.dice.b[0]).toBe(3);
    expect(state.penalties.b).toBe(0);
    engine.applyAction(state, 'a', { type: 'next_liars_dice_round' });
    state.dice.b = [6, 6, 6, 6, 6];
    expect(engine.getPlayerView(state, 'a').lastReveal!.dice.b).toEqual([3, 3, 3, 3, 3]);
    expect(engine.getPlayerView(state, 'a').yourDice).toEqual([3, 3, 3, 3, 3]);
  });

  it('keeps multiplayer matches running when one player resigns', () => {
    const engine = new LiarsDiceEngine(() => 3);
    const state = engine.initGame(['a', 'b', 'c'], {});
    engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode: 'classic' });
    engine.applyAction(state, 'a', { type: 'bid', quantity: 1, face: 6 });
    engine.applyAction(state, 'b', { type: 'challenge' });
    expect(state.lastReveal).not.toBeNull();
    engine.applyAction(state, state.hostId, { type: 'next_liars_dice_round' });
    expect(engine.surrender(state, 'a')).toEqual({ valid: true });
    expect(state.lastReveal).toBeNull();
    expect(state.winnerId).toBeNull();
    expect(state.hostId).toBe('b');
    expect(engine.getAutomaticAction(state)?.action).toEqual({ type: 'next_liars_dice_round' });
  });

  it.each(['classic', 'traditional'] as const)('simulates a complete four-player %s match through elimination', (mode) => {
    const engine = new LiarsDiceEngine(() => 3);
    const state = engine.initGame(['a', 'b', 'c', 'd'], {});
    engine.applyAction(state, 'a', { type: 'select_liars_dice_mode', mode });
    let actions = 0;
    while (state.phase !== 'finished' && actions++ < 100) {
      const automatic = engine.getAutomaticAction(state);
      const action = automatic?.action ?? (state.currentBid
        ? { type: 'challenge' as const } : { type: 'bid' as const, quantity: 1, face: 6 });
      expect(engine.applyAction(state, automatic?.playerId ?? state.currentTurnId, action as Parameters<typeof engine.applyAction>[2]).valid).toBe(true);
      for (const player of state.players) expect(state.dice[player.id]).toHaveLength(state.penalties[player.id] >= 2 ? 0 : 5);
    }
    expect(actions).toBeLessThan(100);
    expect(state.winnerId).toBe('d');
    expect(engine.getResult(state)).toMatchObject({ reason: 'last_player', rounds: 6 });
    expect(Object.values(state.penalties).filter((value) => value === 2)).toHaveLength(3);
  });
});