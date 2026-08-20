import type { BluffAction, StandardCard } from '../../../shared';
import { BluffEngine } from './bluff.engine';

describe('BluffEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`,
    suit,
    rank,
  });
  const game = () => {
    const engine = new BluffEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };

  it('deals all cards privately and starts the forced sequence at aces', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('bluff.i-doubt-it-forced-ranks.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(engine.getPlayerView(state, 'a')).toMatchObject({ claimRank: 'A', currentTurnId: 'a', canClaim: true });
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
  });

  it('accepts one to four owned cards and rejects malformed or foreign claims', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'bluff_play', cardIds: [state.hands.b[0].id] })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
    expect(engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [] })).toEqual({
      valid: false,
      reason: 'A claim must contain one to four distinct cards',
    });
    expect(engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: Array(5).fill(state.hands.a[0].id) })).toEqual({
      valid: false,
      reason: 'A claim must contain one to four distinct cards',
    });
    expect(engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [state.hands.b[0].id] })).toEqual({
      valid: false,
      reason: 'Card not in hand',
    });
    expect(engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [state.hands.a[0].id], rank: 'K' } as unknown as BluffAction)).toEqual({
      valid: false,
      reason: 'A claim must contain one to four distinct cards',
    });
  });

  it('hides claimed card identities while publishing count and required rank', () => {
    const { engine, state } = game();
    const hiddenId = state.hands.a.find((entry) => entry.rank !== 'A')!.id;
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [hiddenId] });
    const view = engine.getPlayerView(state, 'b');
    expect(view.pendingClaim).toEqual({ playerId: 'a', count: 1, rank: 'A' });
    expect(view.pileCount).toBe(1);
    expect(JSON.stringify(view)).not.toContain(`"${hiddenId}"`);
    expect(view).toMatchObject({ canAccept: true, canChallenge: true });
    expect(engine.getPlayerView(state, 'c')).toMatchObject({ canAccept: false, canChallenge: true });
    expect(engine.getPlayerView(state, 'a').canChallenge).toBe(false);
  });

  it('lets only the next player accept and advances the forced rank', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [state.hands.a[0].id] });
    expect(engine.applyAction(state, 'c', { type: 'bluff_accept' })).toEqual({
      valid: false,
      reason: 'Only the next player can accept the claim',
    });
    expect(engine.applyAction(state, 'b', { type: 'bluff_accept' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'claiming', currentTurnId: 'b', claimRank: '2', pendingClaim: null });
  });

  it('makes a lying claimant collect the entire pile when challenged', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'K'), card('diamonds', '2')];
    state.pile = [card('hearts', '7')];
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: ['c-clubs-K'] });
    expect(engine.applyAction(state, 'd', { type: 'bluff_challenge' })).toEqual({ valid: true });
    expect(state.hands.a.map((entry) => entry.id)).toEqual(['c-diamonds-2', 'c-hearts-7', 'c-clubs-K']);
    expect(state.pile).toEqual([]);
    expect(state.lastReveal).toMatchObject({ claimantId: 'a', challengerId: 'd', truthful: false, collectorId: 'a' });
    expect(state.claimRank).toBe('2');
    expect(state.currentTurnId).toBe('b');
  });

  it('makes a false challenger collect the entire pile', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'A'), card('diamonds', '2')];
    state.pile = [card('hearts', '7')];
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: ['c-clubs-A'] });
    engine.applyAction(state, 'c', { type: 'bluff_challenge' });
    expect(state.hands.c.slice(-2).map((entry) => entry.id)).toEqual(['c-hearts-7', 'c-clubs-A']);
    expect(state.lastReveal).toMatchObject({ truthful: true, collectorId: 'c' });
  });

  it('rejects a claimant challenging their own play', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [state.hands.a[0].id] });
    expect(engine.applyAction(state, 'a', { type: 'bluff_challenge' })).toEqual({
      valid: false,
      reason: 'A claimant cannot challenge their own play',
    });
  });

  it('wins after the last claim is accepted', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'K')];
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: ['c-clubs-K'] });
    expect(engine.applyAction(state, 'b', { type: 'bluff_accept' }).result).toMatchObject({
      gameKey: 'bluff', winnerId: 'a', reason: 'empty_hand',
    });
  });

  it('wins after the last claim survives a truthful challenge but not a correct one', () => {
    const truthful = game();
    truthful.state.hands.a = [card('clubs', 'A')];
    truthful.engine.applyAction(truthful.state, 'a', { type: 'bluff_play', cardIds: ['c-clubs-A'] });
    expect(truthful.engine.applyAction(truthful.state, 'd', { type: 'bluff_challenge' }).result).toMatchObject({ winnerId: 'a' });

    const liar = game();
    liar.state.hands.a = [card('clubs', 'K')];
    liar.engine.applyAction(liar.state, 'a', { type: 'bluff_play', cardIds: ['c-clubs-K'] });
    expect(liar.engine.applyAction(liar.state, 'd', { type: 'bluff_challenge' })).toEqual({ valid: true });
    expect(liar.state.phase).toBe('claiming');
    expect(liar.state.hands.a).toHaveLength(1);
  });

  it('wraps kings back to aces and keeps opponent hands private', () => {
    const { engine, state } = game();
    state.claimRank = 'K';
    const hiddenId = state.hands.b[0].id;
    engine.applyAction(state, 'a', { type: 'bluff_play', cardIds: [state.hands.a[0].id] });
    engine.applyAction(state, 'b', { type: 'bluff_accept' });
    expect(state.claimRank).toBe('A');
    expect(JSON.stringify(engine.getPlayerView(state, 'a'))).not.toContain(`"${hiddenId}"`);
  });

  it('awards surrender to the next seat', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'b').result).toMatchObject({ winnerId: 'c', reason: 'surrender' });
  });
});