import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckMode } from '../../../shared';
import { LIARS_DECK_DEAL_INTRO_MS, liarsDeckRevealDurationMs, liarsDeckRouletteDurationMs } from '../../../shared';
import { LiarsDeckEngine } from './liars-deck.engine';

describe('LiarsDeckEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (id: string, rank: LiarsDeckCard['rank']): LiarsDeckCard => ({ id, rank });
  /** Each read moves well past every presentation gate unless frozen. */
  const makeClock = () => {
    const clock = { time: 0, frozen: false, now: () => (clock.frozen ? clock.time : (clock.time += 60_000)) };
    return clock;
  };
  const game = (mode: LiarsDeckMode = 'classic', chamber = 6, seats = players) => {
    const clock = makeClock();
    const engine = new LiarsDeckEngine((cards) => cards, () => chamber, () => 'A', clock.now);
    const state = engine.initGame(seats, {});
    expect(engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode }).valid).toBe(true);
    return { engine, state, clock };
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

  it('keeps the standard 20-card deck for up to four seats and scales to 30 cards for five or six', () => {
    const three = game('classic', 6, ['a', 'b', 'c']);
    expect(Object.values(three.state.hands).flat()).toHaveLength(15);
    expect(three.engine.getPlayerView(three.state, 'b').deck).toEqual({ A: 6, K: 6, Q: 6, joker: 2, devil: 0 });

    const six = game('devil', 6, ['a', 'b', 'c', 'd', 'e', 'f']);
    const cards = Object.values(six.state.hands).flat();
    expect(cards).toHaveLength(30);
    expect(new Set(cards.map((entry) => entry.id)).size).toBe(30);
    expect(cards.filter((entry) => entry.rank === 'A')).toHaveLength(8);
    expect(cards.filter((entry) => entry.rank === 'K')).toHaveLength(9);
    expect(cards.filter((entry) => entry.rank === 'joker')).toHaveLength(3);
    expect(cards.filter((entry) => entry.rank === 'devil')).toHaveLength(1);
    expect(Object.values(six.state.hands).every((hand) => hand.length === 5)).toBe(true);
    expect(six.engine.getPlayerView(six.state, 'f').deck).toEqual({ A: 8, K: 9, Q: 9, joker: 3, devil: 1 });

    const five = game('classic', 6, ['a', 'b', 'c', 'd', 'e']);
    expect(Object.values(five.state.hands).flat()).toHaveLength(25);
    expect(five.state.deck).toEqual({ A: 9, K: 9, Q: 9, joker: 3, devil: 0 });
    expect(() => new LiarsDeckEngine().initGame(['a', 'b', 'c', 'd', 'e', 'f', 'g'], {})).toThrow('two to six');
  });

  it('holds every play until the table card and deal have been shown', () => {
    const clock = makeClock();
    clock.frozen = true;
    const engine = new LiarsDeckEngine((cards) => cards, () => 6, () => 'K', clock.now);
    const state = engine.initGame(players, {});
    engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode: 'classic' });
    expect(engine.getPlayerView(state, 'b')).toMatchObject({ tableRank: 'K', roundIntroRemainingMs: LIARS_DECK_DEAL_INTRO_MS });
    const play: LiarsDeckAction = { type: 'play_liars_deck', cardIds: [state.hands.a[0].id] };
    expect(engine.applyAction(state, 'a', play)).toEqual({ valid: false, reason: 'The cards are still being dealt' });
    clock.time = LIARS_DECK_DEAL_INTRO_MS - 1;
    expect(engine.applyAction(state, 'a', play).valid).toBe(false);
    clock.time = LIARS_DECK_DEAL_INTRO_MS;
    expect(engine.getPlayerView(state, 'b').roundIntroRemainingMs).toBe(0);
    expect(engine.applyAction(state, 'a', play).valid).toBe(true);
  });

  it('lets the host skip only the post-revolver pause, never the revolver itself', () => {
    const clock = makeClock();
    clock.frozen = true;
    const engine = new LiarsDeckEngine((cards) => cards, () => 6, () => 'A', clock.now);
    const state = engine.initGame(players, {});
    engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode: 'classic' });
    clock.time = LIARS_DECK_DEAL_INTRO_MS;
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: [state.hands.a[0].id] });
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    const revealedAt = clock.time;
    expect(engine.getAutomaticAction(state)?.delayMs).toBe(liarsDeckRevealDurationMs(1));
    expect(engine.getPlayerView(state, 'c').nextRoundInMs).toBe(liarsDeckRevealDurationMs(1));
    clock.time = revealedAt + liarsDeckRouletteDurationMs(1) - 1;
    expect(engine.applyAction(state, 'a', { type: 'next_liars_deck_round' })).toEqual({ valid: false, reason: 'Wait for the revolver to settle' });
    expect(engine.getAutomaticAction(state)?.delayMs).toBe(liarsDeckRevealDurationMs(1) - liarsDeckRouletteDurationMs(1) + 1);
    clock.time = revealedAt + liarsDeckRouletteDurationMs(1);
    expect(engine.applyAction(state, 'b', { type: 'next_liars_deck_round' }).valid).toBe(false);
    expect(engine.applyAction(state, 'a', { type: 'next_liars_deck_round' }).valid).toBe(true);
    expect(state.round).toBe(2);
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

  it('records each trigger pull in firing order and paces the reveal so every shot can be animated', () => {
    const chambers: Record<string, number> = { a: 6, b: 1, c: 3, d: 6 };
    let seat = 0;
    const clock = makeClock();
    clock.frozen = true;
    const engine = new LiarsDeckEngine((cards) => cards, () => chambers[players[seat++]], () => 'A', clock.now);
    const state = engine.initGame(players, {});
    engine.applyAction(state, 'a', { type: 'select_liars_deck_mode', mode: 'devil' });
    clock.time = LIARS_DECK_DEAL_INTRO_MS;
    state.hands.a = [card('devil', 'devil'), card('a', 'Q')];
    engine.applyAction(state, 'a', { type: 'play_liars_deck', cardIds: ['devil'] });
    engine.applyAction(state, 'b', { type: 'call_liars_deck' });
    expect(state.lastReveal?.shots).toEqual([
      { playerId: 'b', pull: 1, fired: true },
      { playerId: 'c', pull: 1, fired: false },
      { playerId: 'd', pull: 1, fired: false },
    ]);
    expect(state.lastReveal?.eliminatedIds).toEqual(['b']);
    const view = engine.getPlayerView(state, 'c');
    expect(view.lastReveal?.shots).toEqual(state.lastReveal?.shots);
    expect(JSON.stringify(view)).not.toContain('chamber');
    const reveal = engine.getAutomaticAction(state)!;
    expect(reveal.action).toEqual({ type: 'next_liars_deck_round' });
    expect(reveal.delayMs).toBe(liarsDeckRevealDurationMs(3));
    expect(reveal.delayMs).toBeGreaterThan(liarsDeckRevealDurationMs(1));
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

  it.each([
    ['classic', 4], ['devil', 4], ['classic', 6], ['devil', 6], ['devil', 2],
  ] as const)('simulates a complete %s match with %i players through a final survivor', (mode, seats) => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, seats);
    const { engine, state } = game(mode, 1, ids);
    let actions = 0;
    while (state.phase !== 'finished' && actions++ < 200) {
      const automatic = engine.getAutomaticAction(state);
      const action: LiarsDeckAction = automatic ? automatic.action as LiarsDeckAction
        : state.pendingClaim ? { type: 'call_liars_deck' }
          : { type: 'play_liars_deck', cardIds: [state.hands[state.currentTurnId][0].id] };
      expect(engine.applyAction(state, automatic?.playerId ?? state.currentTurnId, action).valid).toBe(true);
    }
    expect(actions).toBeLessThan(200);
    expect(state.eliminatedIds).toHaveLength(seats - 1);
    expect(engine.getResult(state)).toMatchObject({ isDraw: false, reason: 'last_player' });
  });
});
