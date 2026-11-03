import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckMode } from '../../../shared';
import { LiarsDeckEngine } from './liars-deck.engine';

describe('LiarsDeckEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (id: string, rank: LiarsDeckCard['rank']): LiarsDeckCard => ({ id, rank });
  const game = (mode: LiarsDeckMode = 'classic', chamber = 6) => {
    const engine = new LiarsDeckEngine((cards) => cards, () => chamber, () => 'A');
    const state = engine.initGame(players, {});
    expect(engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode }).valid).toBe(true);
    return { engine, state };
  };

  it('deals twenty unique cards, five per seat, from the documented Classic deck', () => {
    const { state } = game();
    const cards = Object.values(state.hands).flat();
    expect(cards).toHaveLength(20);
    expect(new Set(cards.map((entry) => entry.id)).size).toBe(20);
    for (const rank of ['A', 'K', 'Q']) expect(cards.filter((entry) => entry.rank === rank)).toHaveLength(6);
    expect(cards.filter((entry) => entry.rank === 'joker')).toHaveLength(2);
    expect(Object.values(state.hands).every((hand) => hand.length === 5)).toBe(true);
  });

  it('adds exactly one Devil without changing hand size or the number of truthful cards', () => {
    const { state } = game('devil');
    const cards = Object.values(state.hands).flat();
    expect(cards).toHaveLength(20);
    expect(cards.filter((entry) => entry.rank === 'devil')).toHaveLength(1);
    expect(cards.filter((entry) => entry.rank === 'A')).toHaveLength(5);
    expect(cards.filter((entry) => entry.rank === 'joker')).toHaveLength(2);
  });

  it('restricts mode selection to the host before play', () => {
    const engine = new LiarsDeckEngine();
    const state = engine.initGame(players, {});
    expect(engine.applyAction(state, 'b', { type: 'select_liars_deck_mode', mode: 'classic' }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: [] }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode: 'classic' }).valid).toBe(true);
    expect(engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode: 'devil' }).valid).toBe(false);
  });

  it('rejects invalid counts, repeated cards, unknown cards and out-of-turn plays without mutation', () => {
    const { engine, state } = game();
    const before = JSON.stringify(state);
    const hand = state.hands.a;
    for (const cardIds of [[], [hand[0].id, hand[0].id], ['opponent-secret'], hand.slice(0, 4).map((entry) => entry.id)]) {
      expect(engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds }).valid).toBe(false);
    }
    expect(engine.applyAction(state, 'b', { type: 'play_liars_deck', cardIds: [state.hands.b[0].id] }).valid).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('checks only the latest claim, treating mixed claims as lies and jokers as truthful', () => {
    const { engine, state } = game();
    state.hands.a = [card('old-lie', 'Q'), card('old-truth', 'A')];
    state.hands.b = [card('wild', 'joker'), card('b-truth', 'A')];
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['old-lie'] });
    engine.applyAction(state, 'b', { type: 'play_liars_deck', cardIds: ['wild'] });
    engine.applyAction(state, 'c', { type: 'call_liars_deck' });
    expect(state.lastReveal).toMatchObject({ successful: false, riskPlayerIds: ['c'], cards: [card('wild', 'joker')] });
    expect(state.pulls).toMatchObject({ a: 0, c: 1 });
    engine.applyAction(state, 'a', { type: 'next_liars_deck_round' });
    state.hands.c = [card('good', 'A'), card('bad', 'K')];
    engine.applyAction(state, 'c', { type: 'play_liars_deck', cardIds: ['good', 'bad'] });
    engine.applyAction(state, 'd', { type: 'call_liars_deck' });
    expect(state.lastReveal).toMatchObject({ successful: true, riskPlayerIds: ['c'] });
    expect(state.pulls.c).toBe(2);
  });

  it('skips empty hands and gives the last hand a delayed forced challenge', () => {
    const { engine, state } = game();
    state.hands = {
      a: [card('a', 'A')], b: [card('b', 'joker')],
      c: [card('c', 'Q'), card('c2', 'K')], d: [],
    };
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['a'] });
    expect(state.currentTurnId).toBe('b');
    expect(engine.getAutomaticAction(state)).toBeNull();
    engine.applyAction(state, 'b', { type: 'play_liars_deck', cardIds: ['b'] });
    expect(state.currentTurnId).toBe('c');
    expect(engine.getPlayerView(state, 'c')).toMatchObject({ forcedChallenge: true, canChallenge: true, canPlay: false });
    expect(engine.applyAction(state, 'c', { type: 'play_liars_deck', cardIds: ['c'] }).valid).toBe(false);
    const automatic = engine.getAutomaticAction(state)!;
    expect(automatic).toMatchObject({ playerId: 'c', action: { type: 'call_liars_deck' } });
    expect(automatic.delayMs).toBeGreaterThanOrEqual(1_500);
    expect(automatic.delayMs).toBeLessThanOrEqual(3_000);
    expect(engine.applyAction(state, automatic.playerId, automatic.action as LiarsDeckAction).valid).toBe(true);
    expect(state.pulls.c).toBe(1);
  });

  it('keeps chamber positions secret and persistent across redeals', () => {
    const { engine, state } = game('classic', 2);
    state.hands.a = [card('truth', 'A')];
    const view = engine.getPlayerView(state, 'b');
    expect(view).not.toHaveProperty('chambers');
    expect(view).not.toHaveProperty('hands');
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['truth'] });
    const pending = engine.getPlayerView(state, 'b');
    expect(pending.pendingClaim).toEqual({ playerId: 'a', count: 1 });
    expect(pending.pendingClaim).not.toHaveProperty('cards');
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    expect(state.pulls.b).toBe(1);
    engine.applyAction(state, 'a', { type: 'next_liars_deck_round' });
    expect(state.chambers.b).toBe(2);
    expect(state.pulls.b).toBe(1);
    state.currentTurnId = 'a';
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: [state.hands.a[0].id] });
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    expect(state.eliminatedIds).toContain('b');
  });

  it('requires a lone Devil card and exempts hands already safely emptied from a Devil challenge', () => {
    const { engine, state } = game('devil');
    state.hands.a = [card('devil', 'devil'), card('a', 'Q')];
    state.hands.d = [];
    expect(engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['devil', 'a'] }).valid).toBe(false);
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['devil'] });
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    expect(state.lastReveal).toMatchObject({ kind: 'devil', riskPlayerIds: ['b', 'c'] });
    expect(state.pulls).toEqual({ a: 0, b: 1, c: 1, d: 0 });
  });

  it.each([true, false])("resolves Devil's Deal using exactly the last four cards (all lies: %s)", (allLies) => {
    const { engine, state } = game('devil');
    state.hands.a = [card('devil', 'devil'), card('a', 'Q')];
    expect(engine.applyAction(state, 'a', { type: 'devils_deal' }).valid).toBe(false);
    state.pile = [card('ignored-truth', 'A'), card('1', 'K'), card('2', 'Q'), card('3', 'K'), card('4', allLies ? 'Q' : 'joker')];
    expect(engine.applyAction(state, 'a', { type: 'devils_deal' }).valid).toBe(true);
    expect(state.lastReveal?.cards.map((entry) => entry.id)).toEqual(['1', '2', '3', '4']);
    expect(state.lastReveal?.riskPlayerIds).toEqual(allLies ? ['b', 'c', 'd'] : ['a']);
    expect(state.hands.a.some((entry) => entry.rank === 'devil')).toBe(false);
  });

  it('does not end a multiplayer match just because one player resigns', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: [state.hands.a[0].id] });
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    expect(state.lastReveal).not.toBeNull();
    engine.applyAction(state, state.hostId, { type: 'next_liars_deck_round' });
    expect(engine.surrender(state, 'a')).toEqual({ valid: true });
    expect(state.lastReveal).toBeNull();
    expect(state.winnerId).toBeNull();
    expect(state.hostId).toBe('b');
    expect(engine.getAutomaticAction(state)?.action).toEqual({ type: 'next_liars_deck_round' });
  });

  it.each(['classic', 'devil'] as const)('simulates a complete four-player %s match through a final survivor', (mode) => {
    const { engine, state } = game(mode, 1);
    let actions = 0;
    while (state.phase !== 'finished' && actions++ < 100) {
      const automatic = engine.getAutomaticAction(state);
      const action: LiarsDeckAction = automatic ? automatic.action as LiarsDeckAction
        : state.pendingClaim ? { type: 'call_liars_deck' }
          : { type: 'play_liars_deck', cardIds: [state.hands[state.currentTurnId][0].id] };
      expect(engine.applyAction(state, automatic?.playerId ?? state.currentTurnId, action).valid).toBe(true);
    }
    expect(actions).toBeLessThan(100);
    expect(state.eliminatedIds).toHaveLength(3);
    expect(engine.getResult(state)).toMatchObject({ isDraw: false, reason: 'last_player' });
  });
});
