import { CARD_RANKS, type BluffAction, type BluffGameState, type CardRank, type StandardCard } from '../../../shared';
import { BluffEngine } from './bluff.engine';

describe('BluffEngine chosen-rank rounds', () => {
  const card = (rank: CardRank, suit: StandardCard['suit'] = 'clubs'): StandardCard => ({
    id: `c-${suit}-${rank}`, suit, rank,
  });
  const game = (players = ['a', 'b', 'c']) => {
    const engine = new BluffEngine((cards) => cards);
    const state = engine.initGame(players, {});
    return { engine, state };
  };
  const play = (engine: BluffEngine, state: BluffGameState, playerId: string, cards: StandardCard[], rank: CardRank) =>
    engine.applyAction(state, playerId, { type: 'bluff_play', cardIds: cards.map((entry) => entry.id), rank });
  const pass = (engine: BluffEngine, state: BluffGameState, playerId: string) =>
    engine.applyAction(state, playerId, { type: 'bluff_pass' });

  it.each([2, 3, 8])('deals 52 unique cards among %i players and sorts private hands without mutating state', (count) => {
    const players = Array.from({ length: count }, (_, index) => `${index}`);
    const { engine, state } = game(players);
    expect(engine.rulesetId).toBe('bluff.chosen-rank-passing.v2');
    const dealt = players.flatMap((id) => state.hands[id]);
    expect(dealt).toHaveLength(52);
    expect(new Set(dealt.map((entry) => entry.id)).size).toBe(52);
    state.hands['0'] = [card('K'), card('2'), card('A'), card('2', 'hearts')];
    const original = JSON.stringify(state);
    const view = engine.getPlayerView(state, '0');
    expect(view.yourHand.map((entry) => entry.rank)).toEqual(['A', '2', '2', 'K']);
    view.yourHand[0].rank = 'Q';
    expect(JSON.stringify(state)).toBe(original);
    expect(view).toMatchObject({ claimRank: null, canClaim: true, canPass: false, discardedCount: 0 });
  });

  it('rejects invalid player counts and outsider permissions', () => {
    const { engine, state } = game();
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
    expect(() => engine.initGame(['a', 'a'], {})).toThrow('two to eight');
    play(engine, state, 'a', [state.hands.a[0]], '5');
    expect(engine.getPlayerView(state, 'outsider')).toMatchObject({
      canAct: false, canClaim: false, canPass: false, canAccept: false, canChallenge: false, yourHand: [],
    });
    expect(engine.applyAction(state, 'outsider', { type: 'bluff_challenge' }).valid).toBe(false);
  });

  it('rejects malformed, unowned, duplicate, oversized, out-of-turn and rank-changing claims without mutation', () => {
    const { engine, state } = game();
    const invalid: object[] = [
      { type: 'bluff_play', cardIds: [], rank: '5' },
      { type: 'bluff_play', cardIds: [state.hands.a[0].id, state.hands.a[0].id], rank: '5' },
      { type: 'bluff_play', cardIds: state.hands.a.slice(0, 5).map((entry) => entry.id), rank: '5' },
      { type: 'bluff_play', cardIds: [state.hands.b[0].id], rank: '5' },
      { type: 'bluff_play', cardIds: [state.hands.a[0].id], rank: 'invalid' },
      { type: 'bluff_play', cardIds: [state.hands.a[0].id] },
      { type: 'bluff_play', cardIds: [state.hands.a[0].id], rank: '5', extra: true },
    ];
    const original = JSON.stringify(state);
    for (const action of invalid) {
      expect(engine.applyAction(state, 'a', action as BluffAction).valid).toBe(false);
      expect(JSON.stringify(state)).toBe(original);
    }
    expect(play(engine, state, 'b', [state.hands.b[0]], '5').valid).toBe(false);
    expect(pass(engine, state, 'a').valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'bluff_challenge' }).valid).toBe(false);
    play(engine, state, 'a', [state.hands.a[0]], '5');
    const after = JSON.stringify(state);
    expect(play(engine, state, 'b', [state.hands.b[0]], 'K').valid).toBe(false);
    expect(pass(engine, state, 'c').valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'bluff_challenge' }).valid).toBe(false);
    expect(engine.applyAction(state, 'b', { type: 'bluff_accept' }).valid).toBe(false);
    expect(JSON.stringify(state)).toBe(after);
  });

  it('reproduces J/Q/K claimed as fives, followed by an ace claimed as five: only the latest play is checked', () => {
    const { engine, state } = game();
    state.hands.a = [card('J'), card('Q'), card('K'), card('2')];
    state.hands.b = [card('A'), card('3')];
    expect(play(engine, state, 'a', state.hands.a.slice(0, 3), '5').valid).toBe(true);
    const view = engine.getPlayerView(state, 'b');
    expect(view).toMatchObject({ claimRank: '5', canClaim: true, canPass: true, canChallenge: true });
    expect(view.pendingClaim).toEqual({ playerId: 'a', count: 3, rank: '5' });
    expect(JSON.stringify(view)).not.toContain('c-clubs-J');
    expect(play(engine, state, 'b', [card('A')], '5').valid).toBe(true);
    expect(engine.applyAction(state, 'c', { type: 'bluff_challenge' }).valid).toBe(true);
    expect(state.lastReveal).toMatchObject({ cards: [card('A')], truthful: false, collectorId: 'b' });
    expect(state.hands.b).toHaveLength(5);
    expect(state.pile).toEqual([]);
    expect(state).toMatchObject({ currentTurnId: 'c', claimRank: null, consecutivePasses: 0 });
  });

  it('lets the last claimant play again after others pass, then clears only after every player passes', () => {
    const { engine, state } = game();
    const kings = ['clubs', 'diamonds', 'hearts', 'spades'].map((suit) => card('K', suit as StandardCard['suit']));
    state.hands.a = [card('2'), card('3'), card('4'), card('5'), ...kings, card('6')];
    play(engine, state, 'a', state.hands.a.slice(0, 4), 'K');
    pass(engine, state, 'b');
    pass(engine, state, 'c');
    expect(state).toMatchObject({ currentTurnId: 'a', claimRank: 'K', consecutivePasses: 2, discardedCount: 0 });
    expect(play(engine, state, 'a', kings, 'K').valid).toBe(true);
    expect(state.consecutivePasses).toBe(0);
    pass(engine, state, 'b');
    pass(engine, state, 'c');
    expect(state.pile).toHaveLength(8);
    pass(engine, state, 'a');
    expect(state).toMatchObject({ currentTurnId: 'b', claimRank: null, pendingClaim: null, discardedCount: 8, pile: [] });
    expect(play(engine, state, 'b', [state.hands.b[0]], 'Q').valid).toBe(true);
    engine.applyAction(state, 'c', { type: 'bluff_challenge' });
    expect(state.discardedCount).toBe(8);
    expect(state.lastReveal!.cards).toHaveLength(1);
  });

  it('allows re-entry after passing and preserves the latest claim through passes', () => {
    const { engine, state } = game();
    play(engine, state, 'a', [state.hands.a[0]], 'Q');
    pass(engine, state, 'b');
    play(engine, state, 'c', [state.hands.c[0]], 'Q');
    pass(engine, state, 'a');
    expect(state.currentTurnId).toBe('b');
    expect(play(engine, state, 'b', [state.hands.b[0]], 'Q').valid).toBe(true);
    pass(engine, state, 'c');
    expect(engine.getPlayerView(state, 'a').canChallenge).toBe(true);
    expect(state.pendingClaim!.playerId).toBe('b');
  });

  it('makes an incorrect challenger collect all cards even if an earlier claim was a bluff, and lets the truthful claimant lead', () => {
    const { engine, state } = game();
    state.hands.a = [card('J'), card('2')];
    state.hands.b = [card('5'), card('3')];
    play(engine, state, 'a', [card('J')], '5');
    play(engine, state, 'b', [card('5')], '5');
    const count = state.hands.c.length;
    engine.applyAction(state, 'c', { type: 'bluff_challenge' });
    expect(state.hands.c).toHaveLength(count + 2);
    expect(state.lastReveal).toMatchObject({ truthful: true, collectorId: 'c', cards: [card('5')] });
    expect(state).toMatchObject({ currentTurnId: 'b', claimRank: null, pile: [] });
  });

  it('gives every opponent a final challenge opportunity, not just the next seat', () => {
    const { engine, state } = game();
    state.hands.a = [card('K')];
    expect(play(engine, state, 'a', [card('K')], '5')).toEqual({ valid: true });
    expect(state.phase).toBe('challenge');
    expect(pass(engine, state, 'b').valid).toBe(false);
    expect(play(engine, state, 'b', [state.hands.b[0]], '5').valid).toBe(false);
    expect(engine.applyAction(state, 'c', { type: 'bluff_accept' }).valid).toBe(false);
    expect(engine.applyAction(state, 'b', { type: 'bluff_accept' })).toEqual({ valid: true });
    expect(state.phase).toBe('challenge');
    expect(state.currentTurnId).toBe('c');
    expect(engine.applyAction(state, 'c', { type: 'bluff_challenge' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'claiming', winnerId: null, currentTurnId: 'c', claimRank: null });
    expect(state.hands.a).toEqual([card('K')]);
  });

  it('wins when every opponent accepts the final claim, and blocks subsequent actions', () => {
    const { engine, state } = game();
    state.hands.a = [card('K')];
    play(engine, state, 'a', [card('K')], '5');
    engine.applyAction(state, 'b', { type: 'bluff_accept' });
    expect(engine.applyAction(state, 'c', { type: 'bluff_accept' }).result).toEqual({
      gameKey: 'bluff', winnerId: 'a', isDraw: false, reason: 'empty_hand',
    });
    expect(engine.applyAction(state, 'b', { type: 'bluff_challenge' }).valid).toBe(false);
    expect(engine.getPlayerView(state, 'b').canAct).toBe(false);
  });

  it.each(CARD_RANKS)('wins on a truthful final %s challenge', (rank) => {
    const { engine, state } = game(['a', 'b']);
    state.hands.a = [card(rank)];
    play(engine, state, 'a', [card(rank)], rank);
    expect(engine.applyAction(state, 'b', { type: 'bluff_challenge' }).result).toMatchObject({ winnerId: 'a' });
  });

  it('conserves all cards through round clearance and challenge collection', () => {
    const { engine, state } = game();
    play(engine, state, 'a', state.hands.a.slice(0, 4), 'K');
    for (const id of ['b', 'c', 'a']) pass(engine, state, id);
    play(engine, state, 'b', state.hands.b.slice(0, 3), 'Q');
    engine.applyAction(state, 'c', { type: 'bluff_challenge' });
    const inPlay = Object.values(state.hands).flat().concat(state.pile);
    expect(inPlay.length + state.discardedCount).toBe(52);
    expect(new Set(inPlay.map((entry) => entry.id)).size).toBe(inPlay.length);
  });

  it('preserves surrender behavior', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'b').result).toMatchObject({ winnerId: 'c', reason: 'surrender' });
  });
});
